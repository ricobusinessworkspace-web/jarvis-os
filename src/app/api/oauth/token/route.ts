import {
  packe, macheAuf, pkceStimmt, basisAdresse, mcpAdresse, ohneSchraegstrich,
  ZEICHEN_GUELTIG_SEK, ERNEUERUNG_GUELTIG_SEK, SCOPE, OAuthKonfigFehler,
} from '@/lib/mcp/oauth';
import { felderLesen } from '@/lib/mcp/formular';

/**
 * Code gegen Zeichen tauschen.
 *
 * - `authorization_code`: frischer Code von der Zustimmungsseite plus
 *   PKCE-Geheimnis. Ein allein abgefangener Code nützt nichts.
 * - `refresh_token`: das lange Zeichen gegen ein neues kurzes, damit die
 *   Zustimmung nicht alle acht Stunden fällig ist.
 *
 * Jedes Zeichen trägt Aussteller (`iss`) und Empfänger (`aud` = die Adresse
 * von `/api/mcp`). `/api/mcp` prüft beides.
 *
 * Bekannte Grenze: ohne Datenbank lässt sich ein Code innerhalb seiner fünf
 * Minuten nicht als „verbraucht" markieren. PKCE bindet ihn aber an den
 * Connector, der den Vorgang begonnen hat.
 */
export const dynamic = 'force-dynamic';

const KOPF = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store',
};

const panne = (status: number, error: string, error_description: string) =>
  Response.json({ error, error_description }, { status, headers: KOPF });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...KOPF, 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
}

export async function POST(req: Request) {
  const q = await felderLesen(req);
  const ziel = mcpAdresse(req);
  const iss = basisAdresse(req);

  const ausstellen = (client_id: string) =>
    Response.json(
      {
        access_token: packe('zugang', { client_id, aud: ziel, iss, scope: SCOPE }, ZEICHEN_GUELTIG_SEK),
        token_type: 'Bearer',
        expires_in: ZEICHEN_GUELTIG_SEK,
        refresh_token: packe('erneuerung', { client_id, aud: ziel, iss }, ERNEUERUNG_GUELTIG_SEK),
        scope: SCOPE,
      },
      { headers: KOPF },
    );

  // Bittet der Client um ein Zeichen für eine andere Ressource, gibt es keins.
  if (q.resource && ohneSchraegstrich(q.resource) !== ziel) {
    return panne(400, 'invalid_target', 'Dieser Server stellt nur Zeichen für Jarvis aus.');
  }

  try {
    if (q.grant_type === 'authorization_code') {
      const code = macheAuf<{ client_id: string; redirect_uri: string; code_challenge: string; resource: string }>(q.code, 'code');
      if (!code) return panne(400, 'invalid_grant', 'Der Code ist ungültig oder abgelaufen.');
      if (code.resource !== ziel) return panne(400, 'invalid_grant', 'Der Code gehört zu einem anderen Server.');
      if (q.client_id && q.client_id !== code.client_id) {
        return panne(400, 'invalid_grant', 'Der Code gehört zu einem anderen Connector.');
      }
      if (q.redirect_uri && q.redirect_uri !== code.redirect_uri) {
        return panne(400, 'invalid_grant', 'Die Rücksprung-Adresse passt nicht zum Code.');
      }
      if (!pkceStimmt(q.code_verifier, code.code_challenge)) {
        return panne(400, 'invalid_grant', 'PKCE-Prüfung fehlgeschlagen.');
      }
      return ausstellen(code.client_id);
    }

    if (q.grant_type === 'refresh_token') {
      const alt = macheAuf<{ client_id: string; aud: string; iss: string }>(q.refresh_token, 'erneuerung');
      if (!alt) return panne(400, 'invalid_grant', 'Das Erneuerungs-Zeichen ist ungültig oder abgelaufen.');
      if (alt.aud !== ziel || alt.iss !== iss) return panne(400, 'invalid_grant', 'Das Zeichen gehört zu einem anderen Server.');
      if (q.client_id && q.client_id !== alt.client_id) {
        return panne(400, 'invalid_grant', 'Das Zeichen gehört zu einem anderen Connector.');
      }
      return ausstellen(alt.client_id);
    }

    return panne(400, 'unsupported_grant_type', 'Nur authorization_code und refresh_token.');
  } catch (e) {
    if (e instanceof OAuthKonfigFehler) return panne(503, 'temporarily_unavailable', 'Der Jarvis-Zugang ist nicht eingerichtet.');
    throw e;
  }
}
