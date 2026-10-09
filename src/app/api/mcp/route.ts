import { clientKennung, zugangPruefen, wegweiser } from '@/lib/mcp/oauth';
import { koerperBehandeln } from '@/lib/mcp/protocol';
import { WERKZEUGE } from '@/lib/mcp/tools';
import { revalidateTracking } from '@/lib/revalidate';

/**
 * MCP-Server von Jarvis OS — „Streamable HTTP", zustandslos.
 *
 *   POST /api/mcp
 *   Authorization: Bearer <Zeichen vom Anmelde-Server oder JARVIS_MCP_SECRET>
 *
 * Ohne gültige Anmeldung gibt es nichts, auch nicht die Werkzeugliste. Fehlt
 * `JARVIS_MCP_SECRET`, bleibt der Server geschlossen (503) — eine vergessene
 * Variable darf ihn nicht offen stehen lassen.
 *
 * Einrichtung, Variablen und Testfragen: `docs/mcp-server.md`.
 */
export const dynamic = 'force-dynamic';

const KEIN_CACHE = { 'Cache-Control': 'no-store' };

function abgewiesen(req: Request, zugang: 'fehlt' | 'ungueltig'): Response {
  const fehler = zugang === 'ungueltig'
    ? { code: 'invalid_token', text: 'Das Zeichen ist ungültig, abgelaufen oder nicht für Jarvis ausgestellt.' }
    : undefined;
  return Response.json(
    { error: zugang === 'ungueltig' ? 'invalid_token' : 'unauthorized', error_description: 'Anmeldung erforderlich.' },
    { status: 401, headers: { ...KEIN_CACHE, 'WWW-Authenticate': wegweiser(req, fehler) } },
  );
}

export async function POST(req: Request) {
  const zugang = zugangPruefen(req);
  if (zugang === 'unkonfiguriert') {
    return Response.json(
      { error: 'Der Jarvis-MCP-Server ist nicht eingerichtet (JARVIS_MCP_SECRET fehlt).' },
      { status: 503, headers: KEIN_CACHE },
    );
  }
  if (zugang !== 'ok') return abgewiesen(req, zugang);

  let koerper: unknown;
  try {
    koerper = await req.json();
  } catch {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Der Inhalt ist kein gültiges JSON.' } },
      { status: 400, headers: KEIN_CACHE },
    );
  }

  try {
    const antwort = await koerperBehandeln(koerper, WERKZEUGE, text => console.warn(text), {
      client: clientKennung(req),
      nachSchreiben: revalidateTracking,
    });
    // Nur Mitteilungen im Körper: angenommen, nichts zu antworten.
    if (antwort === null) return new Response(null, { status: 202, headers: KEIN_CACHE });
    return Response.json(antwort, { headers: KEIN_CACHE });
  } catch (e) {
    console.error('[mcp] Interner Fehler:', e instanceof Error ? e.name : 'unbekannt');
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Interner Fehler.' } },
      { status: 500, headers: KEIN_CACHE },
    );
  }
}

/**
 * Kein Ereignisstrom: der Server hält zwischen zwei Anfragen keinen Zustand,
 * es gibt also nichts, was er von sich aus senden könnte. 405 sagt das dem
 * Client nach Spezifikation.
 */
export function GET() {
  return new Response(null, { status: 405, headers: { ...KEIN_CACHE, Allow: 'POST' } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { ...KEIN_CACHE, Allow: 'POST' } });
}
