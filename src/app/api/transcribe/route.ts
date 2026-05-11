import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Allow larger request bodies for audio data (up to 5MB)
export const maxDuration = 30;

// Create a fresh ZAI instance per request to avoid stale connections
async function createZAI() {
  return await ZAI.create();
}

export async function POST(request: NextRequest) {
  try {
    let body: { audio_base64?: string; language?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { audio_base64, language } = body;

    if (!audio_base64 || typeof audio_base64 !== 'string') {
      return NextResponse.json({ error: 'No valid audio data provided' }, { status: 400 });
    }

    // Sanity check — audio should be at least a few KB of base64 (1 second of 16kHz mono = ~32KB WAV = ~43KB base64)
    if (audio_base64.length < 1000) {
      return NextResponse.json({ error: 'Audio data too short' }, { status: 400 });
    }

    // Max ~15 seconds of 16kHz mono audio (~480KB WAV = ~640KB base64)
    if (audio_base64.length > 2_000_000) {
      return NextResponse.json({ error: 'Audio data too large' }, { status: 400 });
    }

    // Validate base64 format
    if (!/^[A-Za-z0-9+/=\s]+$/.test(audio_base64)) {
      return NextResponse.json({ error: 'Invalid base64 encoding' }, { status: 400 });
    }

    // Clean base64 (remove whitespace/newlines)
    const cleanBase64 = audio_base64.replace(/\s/g, '');

    let lastError: Error | null = null;

    // Retry up to 2 times with fresh SDK instances
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const zai = await createZAI();

        const response = await zai.audio.asr.create({
          file_base64: cleanBase64,
        });

        const text = response?.text || '';

        if (!text.trim()) {
          return NextResponse.json({
            success: true,
            text: '',
            timestamp: new Date().toISOString(),
            warning: 'No speech detected in audio',
          });
        }

        return NextResponse.json({
          success: true,
          text,
          timestamp: new Date().toISOString(),
        });
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`ASR attempt ${attempt} failed:`, lastError.message);

        // Don't retry on client errors (4xx)
        if (lastError.message.includes('400') || lastError.message.includes('Invalid')) {
          break;
        }

        // Wait before retry
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }

    const message = lastError?.message || 'ASR service unavailable after retries';
    console.error('ASR Error (all retries failed):', message);
    return NextResponse.json({ error: message }, { status: 502 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    console.error('Transcribe route error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
