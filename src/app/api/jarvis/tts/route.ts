import { NextRequest } from 'next/server';
import { generateTTS } from '@/lib/gemini';
import { base64ToArrayBuffer } from '@/lib/voice'; // Wait, server side doesn't have window.atob. I need to convert it differently.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { audioData, mimeType } = await generateTTS(text);
    
    // Convert base64 to buffer for the response
    const audioBuffer = Buffer.from(audioData, 'base64');

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('TTS API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
