'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAudioRecorder } from '@/hooks/use-audio-recorder';
import { useTranscriptStore, type TranscriptEntry } from '@/stores/transcript-store';
import CreatorSignature from '@/components/CreatorSignature';
import {
  Mic,
  MicOff,
  Globe,
  Copy,
  Download,
  Trash2,
  Volume2,
  Loader2,
  Languages,
  Check,
  Type,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

// ─── Types & Constants ───────────────────────────────────

type SupportedLanguage = { code: string; name: string; flag: string };

const SOURCE_LANGUAGES: SupportedLanguage[] = [
  { code: 'auto', name: 'Auto Detect', flag: '🌐' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
];

const TARGET_LANGUAGES: SupportedLanguage[] = SOURCE_LANGUAGES.filter((l) => l.code !== 'auto');

// ─── Helpers ─────────────────────────────────────────────

let entryCounter = 0;
const createEntry = (partial?: Partial<TranscriptEntry>): TranscriptEntry => ({
  id: `entry-${++entryCounter}-${Date.now()}`,
  originalText: '',
  translatedText: '',
  timestamp: new Date(),
  isFinal: false,
  isTranslating: false,
  ...partial,
});

const isSentenceEnd = (text: string): boolean => /[.!?。！？]\s*$/.test(text.trim());

const formatTime = (date: Date): string =>
  date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

// ─── Auto-scroll hook for Radix ScrollArea ──────────────
// Radix ScrollArea wraps content in a viewport div — the ref
// on <ScrollArea> points at the outer root, NOT the scrollable
// viewport. We need to find [data-radix-scroll-area-viewport]
// to actually scroll.

function useAutoScroll(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The ScrollArea's viewport is a child with this data attribute
    const viewport = containerRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

// ─── Audio Level Bars Component ──────────────────────────

function AudioLevelBars({ level, barCount = 24 }: { level: number; barCount?: number }) {
  return (
    <div className="flex items-center justify-center gap-[2px] h-8">
      {Array.from({ length: barCount }).map((_, i) => {
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const height = Math.max(3, level * 32 * (1 - dist * 0.6) + Math.random() * level * 6);
        const opacity = Math.max(0.15, level * (1 - dist * 0.5));
        const isActive = level > 0.05;
        return (
          <div
            key={i}
            className="w-[2px] rounded-full transition-all duration-75"
            style={{
              height: `${height}px`,
              backgroundColor: isActive ? `rgba(16, 185, 129, ${opacity})` : 'rgba(100, 116, 139, 0.2)',
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Transcript Panel (with auto-scroll) ────────────────

function TranscriptPanel({
  title,
  icon,
  entries,
  accentColor,
}: {
  title: string;
  icon: React.ReactNode;
  entries: TranscriptEntry[];
  accentColor: string;
}) {
  const scrollRef = useAutoScroll([entries]);

  const validEntries = entries.filter((e) => e.originalText.trim().length > 0);

  return (
    <Card className="flex-1 min-w-0 min-h-0 flex flex-col border-slate-700/50 bg-slate-800/30 backdrop-blur">
      <CardHeader className="shrink-0 pb-2 px-4 pt-3">
        <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto text-xs bg-slate-700/50 text-slate-400">
            {validEntries.length} {validEntries.length === 1 ? 'line' : 'lines'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 px-4 pb-3 pt-0 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="space-y-2 pr-2">
            {validEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <Volume2 className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">Waiting for speech...</p>
              </div>
            ) : (
              validEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="group relative rounded-lg border border-slate-700/40 bg-slate-800/50 px-3 py-2 transition-colors hover:bg-slate-800/80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm leading-relaxed flex-1 ${
                        entry.isFinal ? 'text-slate-100' : 'text-slate-400 italic'
                      }`}
                    >
                      {title === 'Original Transcript'
                        ? entry.originalText
                        : entry.translatedText || (
                            <span className="flex items-center gap-1.5 text-slate-500">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Translating...
                            </span>
                          )}
                    </p>
                    {!entry.isFinal && title === 'Original Transcript' && (
                      <Badge variant="outline" className="shrink-0 text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                        listening
                      </Badge>
                    )}
                    {entry.isTranslating && title === 'Translation' && (
                      <Badge variant="outline" className="shrink-0 text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/10">
                        translating
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">{formatTime(entry.timestamp)}</p>
                  <div className="absolute top-0 left-2 right-2 h-[2px] rounded-b opacity-40" style={{ backgroundColor: accentColor }} />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ─── Text Translation Mode ──────────────────────────────

function TextTranslationPanel({ targetLang }: { sourceLang: string; targetLang: string }) {
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [history, setHistory] = useState<{ source: string; target: string; timestamp: Date }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const historyScrollRef = useAutoScroll([history]);

  const handleTranslate = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isTranslating) return;
    setIsTranslating(true);
    setTranslatedText('');
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage: targetLang }),
        signal: abortRef.current.signal,
      });
      const data = await res.json();
      if (data.success && data.translation) {
        const translation = data.translation.trim();
        setTranslatedText(translation);
        setHistory((prev) => [{ source: text, target: translation, timestamp: new Date() }, ...prev.slice(0, 49)]);
      } else {
        setTranslatedText('[Translation failed. Please try again.]');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setTranslatedText('[Translation error. Please check your connection and try again.]');
    } finally {
      setIsTranslating(false);
    }
  }, [inputText, targetLang, isTranslating]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTranslate(); }
    },
    [handleTranslate]
  );

  const copyToClipboard = useCallback(async (text: string, setter: (v: boolean) => void) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setter(true);
      setTimeout(() => setter(false), 2000);
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col md:flex-row gap-2.5 min-h-0 overflow-hidden">
        {/* Input */}
        <Card className="flex-1 min-w-0 min-h-0 flex flex-col border-slate-700/50 bg-slate-800/30 backdrop-blur">
          <CardHeader className="shrink-0 pb-2 px-4 pt-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-emerald-400" />
              Source Text
              <Badge variant="secondary" className="ml-auto text-[10px] bg-slate-700/50 text-slate-400 tabular-nums">
                {inputText.length} chars
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col px-4 pb-3 pt-0 overflow-hidden">
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type or paste text here to translate... (Enter to translate, Shift+Enter for new line)"
              className="flex-1 min-h-0 resize-none bg-slate-900/50 border-slate-700/50 text-slate-100 placeholder:text-slate-600 text-sm leading-relaxed rounded-lg px-3 py-2.5 focus:border-emerald-500/50 focus:ring-emerald-500/20"
            />
            <div className="flex items-center gap-1.5 mt-2 shrink-0">
              <Button onClick={handleTranslate} disabled={!inputText.trim() || isTranslating}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 px-4 h-7 text-xs shadow-lg shadow-emerald-900/30">
                {isTranslating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Translating...</> : <><ArrowRight className="w-3.5 h-3.5" />Translate</>}
              </Button>
              <Button onClick={() => copyToClipboard(inputText, setCopiedSource)} variant="ghost" size="sm"
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 gap-1 h-7 px-2 text-xs" disabled={!inputText.trim()}>
                {copiedSource ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedSource ? 'Copied' : 'Copy'}
              </Button>
              <Button onClick={() => { setInputText(''); setTranslatedText(''); if (abortRef.current) abortRef.current.abort(); }}
                variant="ghost" size="sm" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-1 h-7 px-2 text-xs ml-auto"
                disabled={!inputText && !translatedText}>
                <Trash2 className="w-3 h-3" />Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output */}
        <Card className="flex-1 min-w-0 min-h-0 flex flex-col border-slate-700/50 bg-slate-800/30 backdrop-blur">
          <CardHeader className="shrink-0 pb-2 px-4 pt-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Languages className="w-3.5 h-3.5 text-violet-400" />
              Translation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 flex flex-col px-4 pb-3 pt-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-700/50 bg-slate-900/50 px-3 py-2.5">
              {isTranslating ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm h-full">
                  <Loader2 className="w-4 h-4 animate-spin text-violet-400" />Translating...
                </div>
              ) : translatedText ? (
                <p className="text-sm leading-relaxed text-slate-100 whitespace-pre-wrap">{translatedText}</p>
              ) : (
                <p className="text-sm text-slate-600">Translation will appear here...</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2 shrink-0">
              <Button onClick={() => copyToClipboard(translatedText, setCopiedResult)} variant="ghost" size="sm"
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 gap-1 h-7 px-2 text-xs" disabled={!translatedText || isTranslating}>
                {copiedResult ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedResult ? 'Copied' : 'Copy Translation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card className="shrink-0 border-slate-700/50 bg-slate-800/20 backdrop-blur max-h-[180px] flex flex-col">
          <CardHeader className="shrink-0 pb-1 px-4 pt-2">
            <CardTitle className="text-xs font-medium text-slate-500 flex items-center gap-2">
              <RefreshCw className="w-3 h-3" />
              Recent Translations
              <Badge variant="secondary" className="ml-auto text-[10px] bg-slate-700/50 text-slate-500">{history.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-4 pb-2 pt-0 overflow-hidden">
            <ScrollArea className="h-full" ref={historyScrollRef}>
              <div className="space-y-1.5 pr-2">
                {history.slice(0, 10).map((item, idx) => (
                  <button key={`${idx}-${item.timestamp.getTime()}`}
                    onClick={() => { setInputText(item.source); setTranslatedText(item.target); }}
                    className="w-full text-left rounded-lg border border-slate-700/30 bg-slate-800/40 px-3 py-1.5 transition-colors hover:bg-slate-800/70 hover:border-slate-600/50">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400 flex-1 truncate">{item.source}</p>
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                      <p className="text-xs text-slate-200 flex-1 truncate">{item.target}</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Voice Mode ──────────────────────────────────────────

function VoiceMode({ sourceLang, targetLang }: { sourceLang: string; targetLang: string }) {
  // Use Zustand store — persists across mode switches and tab navigation
  const rawEntries = useTranscriptStore((s) => s.entries);
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const setEntries = useTranscriptStore((s) => s.setEntries);
  const updateEntry = useTranscriptStore((s) => s.updateEntry);

  // Fix corrupted store state if needed
  useEffect(() => {
    if (!Array.isArray(useTranscriptStore.getState().entries)) {
      useTranscriptStore.getState().clearEntries();
    }
  }, []);

  const [copied, setCopied] = useState(false);

  const bufferRef = useRef('');
  const activeInterimRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);
  const pendingAudioRef = useRef<string | null>(null);
  const autoFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFinalizedTextRef = useRef('');
  const [, forceRender] = useState(0);

  const translateEntry = useCallback(
    async (entryId: string, text: string) => {
      try {
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetLanguage: targetLang }),
        });
        const data = await res.json();
        if (data.success) {
          updateEntry(entryId, { translatedText: data.translation, isTranslating: false });
        } else {
          updateEntry(entryId, { translatedText: '[Translation failed]', isTranslating: false });
        }
      } catch {
        updateEntry(entryId, { translatedText: '[Translation error]', isTranslating: false });
      }
    },
    [targetLang, updateEntry]
  );

  const translateEntryRef = useRef(translateEntry);
  useEffect(() => { translateEntryRef.current = translateEntry; }, [translateEntry]);

  const finalizeBuffer = useCallback((force = false) => {
    const text = bufferRef.current.trim();
    if (!text) return;
    if (!force && text === lastFinalizedTextRef.current) return;

    bufferRef.current = '';
    lastFinalizedTextRef.current = text;
    activeInterimRef.current = null;

    const entryId = `final-${++entryCounter}-${Date.now()}`;
    setEntries((prev) => {
      const cleaned = prev.some((e) => !e.isFinal) ? prev.slice(0, -1) : prev;
      return [...cleaned, createEntry({ id: entryId, originalText: text, isFinal: true, isTranslating: true })];
    });

    translateEntryRef.current(entryId, text);
  }, [setEntries]);

  const finalizeBufferRef = useRef(finalizeBuffer);
  useEffect(() => { finalizeBufferRef.current = finalizeBuffer; }, [finalizeBuffer]);

  const resetAutoFinalizeTimer = useCallback(() => {
    if (autoFinalizeTimerRef.current) clearTimeout(autoFinalizeTimerRef.current);
    autoFinalizeTimerRef.current = setTimeout(() => finalizeBufferRef.current(true), 5000);
  }, []);

  const retryCountRef = useRef(0);

  const processAudio = useCallback(async (base64Audio: string, attempt = 0) => {
    if (isProcessingRef.current && attempt === 0) { pendingAudioRef.current = base64Audio; return; }
    if (attempt === 0) isProcessingRef.current = true;
    forceRender((v) => v + 1);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_base64: base64Audio, language: sourceLang }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Retry on rate limit (429) or server errors (502, 503)
      if (res.status === 429 || res.status === 502 || res.status === 503) {
        if (attempt < 2) {
          const delay = res.status === 429 ? 2000 : 1500 * (attempt + 1);
          setTimeout(() => processAudioRef.current(base64Audio, attempt + 1), delay);
          return;
        }
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error('Transcribe API error:', res.status, errorData);
        return;
      }

      retryCountRef.current = 0;
      const data = await res.json();
      if (data.success && data.text && data.text.trim()) {
        const text = data.text.trim();
        bufferRef.current += (bufferRef.current ? ' ' : '') + text;

        setEntries((prev) => {
          const last = prev[prev.length - 1];
          if (last && !last.isFinal) {
            return prev.map((e, i) => (i === prev.length - 1 ? { ...e, originalText: bufferRef.current } : e));
          }
          const entry = createEntry({ originalText: bufferRef.current, isFinal: false });
          activeInterimRef.current = entry.id;
          return [...prev, entry];
        });

        resetAutoFinalizeTimer();
        if (isSentenceEnd(bufferRef.current)) finalizeBufferRef.current(false);
      }
    } catch (err) {
      // Retry on network errors (fetch failed, abort, etc.)
      if (attempt < 2 && !(err instanceof DOMException && err.name === 'AbortError')) {
        setTimeout(() => processAudioRef.current(base64Audio, attempt + 1), 2000 * (attempt + 1));
        return;
      }
      console.error('Transcription error (all retries failed):', err);
    } finally {
      if (attempt === 0 || attempt >= 2) {
        isProcessingRef.current = false;
        forceRender((v) => v + 1);
        if (pendingAudioRef.current) {
          const next = pendingAudioRef.current;
          pendingAudioRef.current = null;
          setTimeout(() => processAudioRef.current(next), 300);
        }
      }
    }
  }, [sourceLang, resetAutoFinalizeTimer, setEntries]);

  const processAudioRef = useRef(processAudio);
  useEffect(() => { processAudioRef.current = processAudio; }, [processAudio]);

  const handleAudioChunk = useCallback((base64Audio: string) => {
    setEntries((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.isFinal) return prev;
      const entry = createEntry({ isFinal: false });
      activeInterimRef.current = entry.id;
      return [...prev, entry];
    });
    processAudioRef.current(base64Audio);
  }, [setEntries]);

  const { state: recorderState, startRecording, stopRecording } = useAudioRecorder(handleAudioChunk, {
    checkIntervalMs: 500,
    speechThreshold: 0.015,
    silenceSendTimeoutMs: 2000,
    minSpeechDurationMs: 2500,
    maxChunkDurationMs: 10000,
  });

  const handleStop = useCallback(() => {
    if (autoFinalizeTimerRef.current) { clearTimeout(autoFinalizeTimerRef.current); autoFinalizeTimerRef.current = null; }
    finalizeBufferRef.current(true);
    stopRecording();
  }, [stopRecording]);

  const handleClear = useCallback(() => {
    useTranscriptStore.getState().clearEntries();
    bufferRef.current = '';
    activeInterimRef.current = null;
    lastFinalizedTextRef.current = '';
    entryCounter = 0;
  }, []);

  const handleCopy = useCallback(async () => {
    const text = entries.filter((e) => e.isFinal).map((e) => `${e.originalText} → ${e.translatedText}`).join('\n\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [entries]);

  const handleExport = useCallback(() => {
    const text = entries.filter((e) => e.isFinal)
      .map((e) => `[${formatTime(e.timestamp)}]\nOriginal: ${e.originalText}\nTranslation: ${e.translatedText}`)
      .join('\n\n---\n\n');
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [entries]);

  const finalEntries = entries.filter((e) => e.isFinal);

  return (
    <>
      {/* Controls */}
      <Card className="shrink-0 border-slate-700/50 bg-slate-800/20 backdrop-blur">
        <CardContent className="py-2.5 px-4">
          <div className="flex items-center gap-4">
            <AudioLevelBars level={recorderState.audioLevel} barCount={32} />
            <div className="flex items-center gap-2 shrink-0">
              {recorderState.isRecording && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {recorderState.error
                  ? recorderState.error
                  : recorderState.isRecording
                    ? isProcessingRef.current ? 'Processing...' : 'Listening'
                    : 'Ready'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {!recorderState.isRecording ? (
                <Button onClick={startRecording}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 px-4 h-7 text-xs shadow-lg shadow-emerald-900/30">
                  <Mic className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Start Recording</span>
                  <span className="sm:hidden">Start</span>
                </Button>
              ) : (
                <Button onClick={handleStop} variant="destructive" className="gap-1.5 px-4 h-7 text-xs">
                  <MicOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stop Recording</span>
                  <span className="sm:hidden">Stop</span>
                </Button>
              )}
              <Separator orientation="vertical" className="h-6 bg-slate-700/50 mx-0.5" />
              <Button onClick={handleCopy} variant="ghost" size="sm"
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 gap-1 h-7 px-2 text-xs" disabled={finalEntries.length === 0}>
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button onClick={handleExport} variant="ghost" size="sm"
                className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 gap-1 h-7 px-2 text-xs" disabled={finalEntries.length === 0}>
                <Download className="w-3 h-3" />Export
              </Button>
              <Button onClick={handleClear} variant="ghost" size="sm"
                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 gap-1 h-7 px-2 text-xs" disabled={entries.length === 0}>
                <Trash2 className="w-3 h-3" />Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panels */}
      <div className="flex-1 flex flex-col md:flex-row gap-2.5 min-h-0 overflow-hidden">
        <TranscriptPanel title="Original Transcript" icon={<Mic className="w-3.5 h-3.5 text-emerald-400" />} entries={entries} accentColor="#10b981" />
        <TranscriptPanel title="Translation" icon={<Languages className="w-3.5 h-3.5 text-violet-400" />} entries={entries} accentColor="#8b5cf6" />
      </div>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────

export default function Home() {
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');

  return (
    <div className="h-dvh flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Languages className="w-4 h-4 text-emerald-400" />
            </div>
            <h1 className="text-sm font-semibold text-slate-100">VoxTranslate</h1>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-0.5 border border-slate-700/40">
            <button onClick={() => setMode('voice')}
              className={`flex items-center gap-1.5 px-3 h-6 rounded-md text-xs font-medium transition-all ${mode === 'voice' ? 'bg-emerald-600/90 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              <Mic className="w-3 h-3" /><span className="hidden sm:inline">Voice</span>
            </button>
            <button onClick={() => setMode('text')}
              className={`flex items-center gap-1.5 px-3 h-6 rounded-md text-xs font-medium transition-all ${mode === 'text' ? 'bg-violet-600/90 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>
              <Type className="w-3 h-3" /><span className="hidden sm:inline">Text</span>
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger className="w-[130px] h-7 text-xs bg-slate-800/50 border-slate-700/50 text-slate-300">
                <Globe className="w-3 h-3 mr-1.5 text-slate-500" /><SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {SOURCE_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} className="text-slate-200 focus:bg-slate-700 focus:text-white">
                    {lang.flag} {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-slate-600 text-sm">→</span>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="w-[130px] h-7 text-xs bg-slate-800/50 border-slate-700/50 text-slate-300">
                <Globe className="w-3 h-3 mr-1.5 text-emerald-500" /><SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                {TARGET_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} className="text-slate-200 focus:bg-slate-700 focus:text-white">
                    {lang.flag} {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 py-2.5 gap-2.5 min-h-0 overflow-hidden">
        {mode === 'voice' ? (
          <VoiceMode sourceLang={sourceLang} targetLang={targetLang} />
        ) : (
          <TextTranslationPanel sourceLang={sourceLang} targetLang={targetLang} />
        )}
      </main>

      {/* Footer */}
      <footer className="shrink-0 border-t border-slate-800/40 py-1.5">
        <p className="text-center text-[10px] text-slate-600">
          VoxTranslate — Real-time speech-to-text with instant translation.
        </p>
      </footer>

      {/* Creator Signature */}
      <CreatorSignature variant="badge" projectName="VoxTranslate" />
    </div>
  );
}
