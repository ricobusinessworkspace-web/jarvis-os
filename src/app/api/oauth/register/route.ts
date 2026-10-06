import { packe, rueckSprungErlaubt, KUNDE_GUELTIG_SEK, SCOPE, OAuthKonfigFehler } from '@/lib/mcp/oauth';

/**
 * Connector meldet sich selbst an (RFC 7591).
 *
 * ChatGPT und Claude kennen Jarvis vorher nicht. Sie schicken ihre
 * Rücksprung-Adressen und bekommen eine Kennung zurück. Gespeichert wird
 * nichts: die Kennung trägt die Adressen unterschrieben in sich.
 *
 * Kein Geheimnis für den Connector — die Absicherung macht PKCE.
 */
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const panne = (status: number, error: string, error_description: string) =>
  Response.json({ error, error_description }, { status, headers: CORS });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}

export async function POST(req: Request) {
  let koerper: { redirect_uris?: unknown; client_name?: unknown } | null = null;
  try {
    koerper = await req.json();
  } catch {
    return panne(400, 'invalid_client_metadata', 'Kein gültiges JSON.');
  }

  const adressen = Array.isArray(koerper?.redirect_uris) ? koerper!.redirect_uris as unknown[] : [];
  if (adressen.length === 0) return panne(400, 'invalid_redirect_uri', 'redirect_uris fehlt.');
  if (adressen.length > 10) return panne(400, 'invalid_redirect_uri', 'Zu viele Rücksprung-Adressen.');

  const unerlaubt = adressen.find(a => !rueckSprungErlaubt(a));
  if (unerlaubt !== undefined) {
    return panne(400, 'invalid_redirect_uri', `Nicht erlaubte Rücksprung-Adresse: ${String(unerlaubt).slice(0, 200)}`);
  }

  const name = typeof koerper?.client_name === 'string' ? koerper.client_name.slice(0, 100) : 'MCP Client';

  try {
    const client_id = packe('kunde', { redirect_uris: adressen, name }, KUNDE_GUELTIG_SEK);
    return Response.json(
      {
        client_id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: name,
        redirect_uris: adressen,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        scope: SCOPE,
      },
      { status: 201, headers: CORS },
    );
  } catch (e) {
    if (e instanceof OAuthKonfigFehler) return panne(503, 'temporarily_unavailable', 'Der Jarvis-Zugang ist nicht eingerichtet.');
    throw e;
  }
}
