import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  yo: 'Yoruba',
  ig: 'Igbo',
  ha: 'Hausa',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, targetLanguage } = body;

    if (!text || !targetLanguage) {
      return NextResponse.json(
        { error: 'Text and target language are required' },
        { status: 400 }
      );
    }

    const langName = LANGUAGE_MAP[targetLanguage] || targetLanguage;

    const zai = await getZAI();

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a translator. Rules:
1. Output ONLY the translation. Nothing else.
2. No explanations, notes, definitions, or examples.
3. No bullet points, no numbered lists, no markdown.
4. If it is a name or proper noun, transliterate it as-is.
5. Keep the same tone and meaning.
6. One sentence max. No filler.`,
        },
        {
          role: 'user',
          content: `${text}`,
        },
        {
          role: 'system',
          content: `Target language: ${langName}. Reply with ONLY the translated text.`,
        },
      ],
      temperature: 0,
      max_tokens: 80,
    });

    let translation =
      completion.choices?.[0]?.message?.content?.trim() || '';

    // Strip any markdown formatting the model might still output
    translation = translation
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .trim();

    // Truncate to prevent essay-like responses
    if (translation.length > text.length * 3) {
      // If the response is way longer than the input, something went wrong
      // Just take the first sentence
      const firstSentence = translation.split(/[.!?]\s/)[0];
      translation = firstSentence || translation.slice(0, text.length * 2);
    }

    return NextResponse.json({
      success: true,
      translation,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Translation failed';
    console.error('Translation Error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
