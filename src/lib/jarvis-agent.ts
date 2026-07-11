// ============================================================================
// Jarvis Agent — Client-Side Agent Loop Engine
// ============================================================================
// The heart of the new architecture. Orchestrates the Gemini ↔ Tool loop
// entirely in the browser. Each LLM call and tool call is a separate HTTP
// request — no Vercel timeout risk. Rate-limit retries happen client-side
// where there is no timeout.
// ============================================================================

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentCallbacks {
  /** Called for each text chunk as it streams from Gemini */
  onTextChunk?: (chunk: string, accumulated: string) => void;
  /** Called when Jarvis decides to use a tool */
  onToolCall?: (toolName: string) => void;
  /** Called when a tool result comes back */
  onToolResult?: (toolName: string, result: unknown) => void;
  /** Called when the full response is complete */
  onComplete?: (fullText: string) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

export interface AgentOptions {
  messages: AgentMessage[];
  systemPrompt?: string;
  callbacks: AgentCallbacks;
  signal?: AbortSignal;
  /** Maximum agent loop iterations (safety guard). Default: 5 */
  maxIterations?: number;
}

// ---------------------------------------------------------------------------
// Client-side fetch with retry (rate-limit aware)
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  signal?: AbortSignal,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const response = await fetch(url, { ...options, signal });

      // 429 — Rate limited. Wait and retry (client-side, no timeout risk!)
      if (response.status === 429 && attempt < maxRetries) {
        const waitTime = Math.min(4 * Math.pow(2, attempt), 16); // 4s, 8s, 16s
        console.warn(`[Agent] Rate limited (429). Waiting ${waitTime}s before retry ${attempt + 1}/${maxRetries}...`);
        await sleep(waitTime * 1000, signal);
        continue;
      }

      // 5xx — Server error. Brief retry.
      if (response.status >= 500 && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt); // 1s, 2s, 4s
        console.warn(`[Agent] Server error (${response.status}). Retrying in ${waitTime}s...`);
        await sleep(waitTime * 1000, signal);
        continue;
      }

      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;

      // Network error — retry
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt);
        console.warn(`[Agent] Network error. Retrying in ${waitTime}s...`, err.message);
        await sleep(waitTime * 1000, signal);
        continue;
      }
      throw err;
    }
  }

  throw new Error('Max retries exceeded');
}

/** Abortable sleep */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// ---------------------------------------------------------------------------
// NDJSON Stream Parser
// ---------------------------------------------------------------------------

interface LLMStreamResult {
  text: string;
  functionCalls?: any[];
}

/**
 * Calls the /api/jarvis/llm endpoint and parses the NDJSON stream.
 * Invokes onTextChunk for each text fragment as it arrives.
 */
async function callLLMStreaming(
  contents: any[],
  systemPrompt: string | undefined,
  signal: AbortSignal | undefined,
  onTextChunk?: (chunk: string, accumulated: string) => void
): Promise<LLMStreamResult> {
  const response = await fetchWithRetry(
    '/api/jarvis/llm',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, systemPrompt }),
    },
    signal
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`LLM API error (${response.status}): ${errorBody}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let functionCalls: any[] | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse complete NDJSON lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        continue; // Skip malformed JSON
      }

      switch (event.type) {
        case 'text':
          accumulated += event.text;
          onTextChunk?.(event.text, accumulated);
          break;

        case 'function_calls':
          functionCalls = event.calls;
          break;

        case 'error':
          throw new Error(event.error || 'LLM stream error');

        case 'done':
          // Stream complete
          break;
      }
    }
  }

  return { text: accumulated, functionCalls };
}

// ---------------------------------------------------------------------------
// Tool Executor (calls /api/jarvis/tools)
// ---------------------------------------------------------------------------

async function executeTools(
  calls: any[],
  signal?: AbortSignal
): Promise<Array<{ name: string; result: unknown }>> {
  const response = await fetchWithRetry(
    '/api/jarvis/tools',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calls }),
    },
    signal
  );

  if (!response.ok) {
    throw new Error(`Tools API error (${response.status})`);
  }

  const { results } = await response.json();
  return results;
}

// ---------------------------------------------------------------------------
// Agent Loop — The Core
// ---------------------------------------------------------------------------

/**
 * Runs the Jarvis agent loop:
 * 1. Send messages to Gemini (streaming)
 * 2. If Gemini wants to call tools → execute them server-side
 * 3. Feed tool results back to Gemini → get final text response
 * 4. Stream text chunks to the UI for live display + TTS
 *
 * Each step is a separate HTTP request. No single request takes >5s.
 * Rate-limit retries happen in the browser (no timeout). 
 */
export async function runAgent(options: AgentOptions): Promise<string> {
  const {
    messages,
    systemPrompt,
    callbacks,
    signal,
    maxIterations = 5,
  } = options;

  // Messages are already mostly in the correct format, but we keep a local array
  // to append tool calls and results during the loop.
  const conversationHistory: any[] = [...messages];

  let fullText = '';

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // ── Step 1: Call LLM (streaming) ──
    const { text, functionCalls } = await callLLMStreaming(
      conversationHistory,
      systemPrompt,
      signal,
      callbacks.onTextChunk
    );

    // ── Step 2: Handle function calls ──
    if (functionCalls && functionCalls.length > 0) {
      // Notify about tool calls
      for (const call of functionCalls) {
        callbacks.onToolCall?.(call.name);
      }

      // Add model's tool_calls to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: null,
        tool_calls: functionCalls.map((c: any) => ({
          id: c.id || `call_${c.name}`,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args || {}) }
        })),
      });

      // Execute tools server-side
      const results = await executeTools(functionCalls, signal);

      // Notify about results
      for (const r of results) {
        callbacks.onToolResult?.(r.name, r.result);
      }

      // Add tool results to conversation history (OpenAI tool message format)
      for (const r of results) {
        // Find the matching call ID
        const matchedCall = functionCalls.find((c: any) => c.name === r.name);
        conversationHistory.push({
          role: 'tool',
          tool_call_id: matchedCall?.id || `call_${r.name}`,
          name: r.name,
          content: JSON.stringify(r.result),
        });
      }

      // Loop continues → next iteration calls LLM with tool results
      continue;
    }

    // ── Step 3: Got text response — done! ──
    fullText = text;
    break;
  }

  callbacks.onComplete?.(fullText);
  return fullText;
}
