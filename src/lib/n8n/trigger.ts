/**
 * n8n Outbound Trigger Service
 * ----------------------------
 * Sends event payloads to n8n webhook endpoints.
 * Designed to fail silently when n8n is unreachable (offline-first).
 */

/** Supported outbound event types */
export type N8nEventType =
  | 'task-completed'
  | 'routine-completed'
  | 'kpi-updated'
  | 'knowledge-created'
  | 'jarvis-action';

/** Result of a trigger attempt */
export interface TriggerResult {
  success: boolean;
  status?: number;
  error?: string;
}

// ANSI colour codes for console output
const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
} as const;

/**
 * Fire a POST request to an n8n webhook endpoint.
 *
 * @param event   - The event slug (becomes part of the URL path)
 * @param payload - Arbitrary JSON payload to send
 * @returns       - A TriggerResult indicating success/failure
 */
export async function triggerN8nWebhook(
  event: N8nEventType | string,
  payload: Record<string, unknown>,
): Promise<TriggerResult> {
  const baseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
  const url = `${baseUrl}/webhook/${event}`;

  console.log(
    `${COLORS.cyan}[n8n-trigger]${COLORS.reset} Firing event ${COLORS.green}${event}${COLORS.reset} → ${url}`,
  );

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
      // Short timeout so we don't block the main flow if n8n is down
      signal: AbortSignal.timeout(5_000),
    });

    if (response.ok) {
      console.log(
        `${COLORS.green}[n8n-trigger]${COLORS.reset} ✅ Event "${event}" delivered (HTTP ${response.status})`,
      );
      return { success: true, status: response.status };
    }

    console.warn(
      `${COLORS.yellow}[n8n-trigger]${COLORS.reset} ⚠️  Event "${event}" returned HTTP ${response.status}`,
    );
    return { success: false, status: response.status };
  } catch (err) {
    // Expected when n8n is not running — log but don't throw
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `${COLORS.red}[n8n-trigger]${COLORS.reset} ❌ Could not reach n8n for event "${event}": ${message}`,
    );
    return { success: false, error: message };
  }
}
