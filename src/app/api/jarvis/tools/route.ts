import { NextRequest } from 'next/server';
import { executeJarvisTool } from '@/lib/jarvis-tool-executor';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// POST /api/jarvis/tools
// ---------------------------------------------------------------------------
// Isolated tool executor. Receives tool calls from the client-side agent,
// runs them server-side (DB queries etc.), and returns results.
// Each request is a fast DB query (~50-200ms). No LLM calls, no timeout risk.
// ---------------------------------------------------------------------------

interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  try {
    const { calls } = await req.json() as { calls: ToolCall[] };

    if (!calls || !Array.isArray(calls) || calls.length === 0) {
      return Response.json(
        { error: 'Invalid or empty calls array' },
        { status: 400 }
      );
    }

    // Execute all tool calls in parallel for maximum speed
    const results = await Promise.all(
      calls.map(async (call) => {
        console.log(`[Tools] Executing: ${call.name}`);
        const result = await executeJarvisTool(call);
        return { name: call.name, result };
      })
    );

    return Response.json({ results });
  } catch (error: any) {
    console.error('[Tools] Error:', error);
    return Response.json(
      { error: error.message || 'Tool execution failed' },
      { status: 500 }
    );
  }
}
