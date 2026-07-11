import { NextRequest } from 'next/server';
import { callGeminiStream, GEMINI_CONFIG, SYSTEM_PROMPT } from '@/lib/gemini';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// POST /api/jarvis/llm
// ---------------------------------------------------------------------------
// Thin proxy: Calls Gemini with streaming and returns NDJSON.
// NO retry logic, NO tool execution — the client-side agent handles that.
// Each Vercel request = 1 Gemini call = ~2-5 seconds. No timeout risk.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { contents, systemPrompt } = await req.json();

    if (!contents || !Array.isArray(contents)) {
      return new Response(
        JSON.stringify({ error: 'Invalid contents array' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build config — use custom system prompt if provided, otherwise default
    const config = {
      ...GEMINI_CONFIG,
      ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
    };

    const stream = await callGeminiStream(contents, config);

    // Stream as NDJSON (newline-delimited JSON)
    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        };

        try {
          for await (const chunk of stream) {
            // Function calls — sent as a single event
            const functionCalls = chunk.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              send({ type: 'function_calls', calls: functionCalls });
            }

            // Text chunk
            const text = chunk.text;
            if (text) {
              send({ type: 'text', text });
            }
          }

          send({ type: 'done' });
          controller.close();
        } catch (err: any) {
          // Stream the error as an NDJSON event so the client can handle it
          console.error('[LLM Proxy] Stream error:', err);
          send({
            type: 'error',
            error: err.message || 'Unknown error',
            status: err.status || 500,
          });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (error: any) {
    console.error('[LLM Proxy] Error:', error);

    // If Gemini returns 429 before streaming starts, pass it through
    if (error?.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', retryAfter: 4 }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
