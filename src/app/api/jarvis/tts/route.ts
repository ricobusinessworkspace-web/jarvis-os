import { NextRequest } from 'next/server';
import { generateTTS } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
// Node.js runtime required for Gemini SDK fallback (Edge doesn't support it)
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// POST /api/jarvis/tts
// ---------------------------------------------------------------------------
// Primary:  ElevenLabs (eleven_multilingual_v2)
// Fallback: Gemini TTS (gemini-3.1-flash-tts-preview)
// Client can force a provider via ?provider=gemini
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Allow client to force a specific provider
    const provider = req.nextUrl.searchParams.get('provider');

    if (provider === 'gemini') {
      return await handleGeminiTTS(text.trim());
    }

    // --- Try ElevenLabs first ---
    try {
      return await handleElevenLabsTTS(text.trim());
    } catch (elevenLabsError: any) {
      console.warn('[TTS] ElevenLabs failed, falling back to Gemini TTS:', elevenLabsError.message);
      
      // --- Fallback to Gemini TTS ---
      try {
        return await handleGeminiTTS(text.trim());
      } catch (geminiError: any) {
        console.error('[TTS] Gemini TTS fallback also failed:', geminiError.message);
        return new Response(
          JSON.stringify({ 
            error: 'All TTS providers failed',
            elevenlabs: elevenLabsError.message,
            gemini: geminiError.message,
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error: any) {
    console.error('[TTS] Request error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ---------------------------------------------------------------------------
// ElevenLabs TTS Handler
// ---------------------------------------------------------------------------

async function handleElevenLabsTTS(text: string): Promise<Response> {
  // CRITICAL: .trim() to strip any trailing whitespace/newlines from env vars
  // This is a common issue with Vercel CLI-injected environment variables
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = (process.env.ELEVENLABS_VOICE_ID?.trim()) || 'pNInz6obpgDQGcFmaJgB'; // default: Adam

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  // Debug logging (key length only, never log the key itself!)
  console.log(`[TTS] ElevenLabs request — key length: ${apiKey.length}, voice: ${voiceId}`);

  const elevenlabsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!elevenlabsRes.ok) {
    const errorText = await elevenlabsRes.text();
    console.error(`[TTS] ElevenLabs API error (${elevenlabsRes.status}):`, errorText);
    throw new Error(`ElevenLabs ${elevenlabsRes.status}: ${errorText}`);
  }

  // Stream the response directly to the client (zero-copy)
  if (elevenlabsRes.body) {
    return new Response(elevenlabsRes.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // Fallback: buffer the response if streaming isn't available
  const arrayBuffer = await elevenlabsRes.arrayBuffer();
  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// ---------------------------------------------------------------------------
// Gemini TTS Handler (Free fallback)
// ---------------------------------------------------------------------------

async function handleGeminiTTS(text: string): Promise<Response> {
  console.log(`[TTS] Using Gemini TTS for: "${text.substring(0, 50)}..."`);

  const { audioData, mimeType } = await generateTTS(text);

  // audioData is a base64 string — convert to binary
  const binaryData = Buffer.from(audioData, 'base64');

  return new Response(binaryData, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
