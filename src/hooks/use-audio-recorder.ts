'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderOptions {
  checkIntervalMs?: number;
  speechThreshold?: number;
  silenceSendTimeoutMs?: number;
  minSpeechDurationMs?: number;
  maxChunkDurationMs?: number;
}

interface AudioRecorderState {
  isRecording: boolean;
  audioLevel: number;
  error: string | null;
}

interface AudioRecorderReturn {
  state: AudioRecorderState;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

// Encode Float32 PCM samples into a 16-bit WAV blob
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');

  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function wavBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      if (base64) resolve(base64);
      else reject(new Error('Failed to encode WAV to base64'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useAudioRecorder(
  onAudioChunk: (base64Audio: string) => void,
  options: AudioRecorderOptions = {}
): AudioRecorderReturn {
  const {
    checkIntervalMs = 500,
    speechThreshold = 0.015,
    silenceSendTimeoutMs = 2000,
    minSpeechDurationMs = 2500,
    maxChunkDurationMs = 10000,
  } = options;

  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    audioLevel: 0,
    error: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const onChunkRef = useRef(onAudioChunk);
  const startingRef = useRef(false); // guard against concurrent start calls

  // Speech tracking
  const sampleBufferRef = useRef<Float32Array[]>([]);
  const speechDurationMsRef = useRef(0);
  const chunkStartTimeRef = useRef(0);
  const silenceStartRef = useRef<number | null>(null);
  const hadSpeechRef = useRef(false);
  const smoothLevelRef = useRef(0);

  useEffect(() => {
    onChunkRef.current = onAudioChunk;
  }, [onAudioChunk]);

  const getAudioLevel = useCallback((): number => {
    if (!analyserRef.current) return 0;
    const analyser = analyserRef.current;
    const dataArray = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    return Math.sqrt(sum / dataArray.length) * 5;
  }, []);

  const startAudioLevelMonitor = useCallback(() => {
    const monitor = () => {
      if (!audioContextRef.current) return; // guard if context was closed
      const rawLevel = getAudioLevel();
      smoothLevelRef.current = smoothLevelRef.current * 0.7 + rawLevel * 0.3;
      const level = Math.min(smoothLevelRef.current, 1);
      setState((prev) => ({ ...prev, audioLevel: level }));

      if (level > speechThreshold) {
        hadSpeechRef.current = true;
        silenceStartRef.current = null;
        if (hadSpeechRef.current) {
          speechDurationMsRef.current += 16;
        }
      } else if (hadSpeechRef.current && silenceStartRef.current === null) {
        silenceStartRef.current = Date.now();
      }

      animFrameRef.current = requestAnimationFrame(monitor);
    };
    animFrameRef.current = requestAnimationFrame(monitor);
  }, [getAudioLevel, speechThreshold]);

  const stopAudioLevelMonitor = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setState((prev) => ({ ...prev, audioLevel: 0 }));
  }, []);

  const flushAudio = useCallback(async () => {
    const samples = sampleBufferRef.current;
    if (samples.length === 0) return;

    const totalLength = samples.reduce((acc, buf) => acc + buf.length, 0);
    if (totalLength < 16000) {
      sampleBufferRef.current = [];
      return;
    }
    if (!hadSpeechRef.current) {
      sampleBufferRef.current = [];
      return;
    }

    const flat = new Float32Array(totalLength);
    let offset = 0;
    for (const buf of samples) {
      flat.set(buf, offset);
      offset += buf.length;
    }

    sampleBufferRef.current = [];
    speechDurationMsRef.current = 0;
    chunkStartTimeRef.current = Date.now();
    silenceStartRef.current = null;
    hadSpeechRef.current = false;

    try {
      const wavBlob = encodeWav(flat, 16000);
      const base64 = await wavBlobToBase64(wavBlob);
      onChunkRef.current(base64);
    } catch (err) {
      console.error('Audio encoding error:', err);
    }
  }, []);

  const startChunkChecker = useCallback(() => {
    checkTimerRef.current = setInterval(() => {
      const now = Date.now();
      const chunkAge = now - chunkStartTimeRef.current;
      const speechMs = speechDurationMsRef.current;
      const silenceDuration = silenceStartRef.current
        ? now - silenceStartRef.current
        : 0;

      const shouldSend =
        (speechMs >= minSpeechDurationMs && silenceDuration >= 800) ||
        (hadSpeechRef.current && silenceDuration >= silenceSendTimeoutMs) ||
        (chunkAge >= maxChunkDurationMs && speechMs >= 1500);

      if (shouldSend) {
        flushAudio();
      }
    }, checkIntervalMs);
  }, [checkIntervalMs, minSpeechDurationMs, silenceSendTimeoutMs, maxChunkDurationMs, flushAudio]);

  const startRecording = useCallback(async () => {
    // Guard against concurrent starts (e.g. double-click)
    if (startingRef.current) return;
    startingRef.current = true;

    // If already recording, stop first to clean up
    if (audioContextRef.current) {
      if (checkTimerRef.current) { clearInterval(checkTimerRef.current); checkTimerRef.current = null; }
      stopAudioLevelMonitor();
      if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
      if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      if (audioContextRef.current.state !== 'closed') { audioContextRef.current.close(); }
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    try {
      setState((prev) => ({ ...prev, error: null }));

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      let audioContext = new AudioContext({ sampleRate: 16000 });
      // If browser suspended the context (e.g. background tab), resume it
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        sampleBufferRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      sampleBufferRef.current = [];
      speechDurationMsRef.current = 0;
      chunkStartTimeRef.current = Date.now();
      silenceStartRef.current = null;
      hadSpeechRef.current = false;
      smoothLevelRef.current = 0;

      startAudioLevelMonitor();
      startChunkChecker();

      setState((prev) => ({ ...prev, isRecording: true }));
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to start recording';
      setState((prev) => ({
        ...prev,
        error: message.includes('Permission')
          ? 'Microphone permission denied. Please allow microphone access.'
          : message,
      }));
    } finally {
      startingRef.current = false;
    }
  }, [startAudioLevelMonitor, startChunkChecker, stopAudioLevelMonitor]);

  const stopRecording = useCallback(() => {
    if (checkTimerRef.current !== null) {
      clearInterval(checkTimerRef.current);
      checkTimerRef.current = null;
    }

    stopAudioLevelMonitor();

    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    sampleBufferRef.current = [];
    speechDurationMsRef.current = 0;
    silenceStartRef.current = null;
    hadSpeechRef.current = false;
    smoothLevelRef.current = 0;

    setState((prev) => ({ ...prev, isRecording: false, audioLevel: 0 }));
  }, [stopAudioLevelMonitor]);

  // ── Resume AudioContext when tab regains focus ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
        // Restart the animation frame monitor (it stops when tab is backgrounded)
        if (animFrameRef.current === null && audioContextRef.current) {
          startAudioLevelMonitor();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startAudioLevelMonitor]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    state,
    startRecording,
    stopRecording,
  };
}
