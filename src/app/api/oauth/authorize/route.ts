import {
  packe, macheAuf, geheimnisStimmt, rueckSprungErlaubt, basisAdresse, mcpAdresse,
  ohneSchraegstrich, istKonfiguriert, CODE_GUELTIG_SEK,
} from '@/lib/mcp/oauth';
import { felderLesen } from '@/lib/mcp/formular';

/**
 * Die eine Seite, auf der Rico einem Connector Zugriff gibt.
 *
 * Einzelplatz: die „Anmeldung" ist das Geheimnis `JARVIS_MCP_SECRET`. Stimmt
 * es, gibt es einen Code für fünf Minuten, und der Browser springt zum
 * Connector zurück — mit `iss` (RFC 9207), damit ChatGPT seine feste
 * Rücksprung-Adresse nutzen darf.
 *
 * Die Seite sagt nüchtern, was gleich erlaubt wird. Eine Zustimmung, die
 * niemand liest, ist keine.
 */
export const dynamic = 'force-dynamic';

const html = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]!);

const SEITEN_KOPF = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  // Die Seite nimmt ein Geheimnis entgegen — nie in einem fremden Rahmen zeigen.
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
};

function seite(felder: Record<string, string>, fehler: string | null, status = 200): Response {
  const versteckt = Object.entries(felder)
    .map(([k, v]) => `<input type="hidden" name="${html(k)}" value="${html(v)}">`)
    .join('\n    ');

  const body = `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jarvis OS — Zugriff erlauben</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#000; color:#f2f2f7; padding:24px;
         font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif; }
  .karte { width:100%; max-width:380px; background:#111113; border:1px solid rgba(255,255,255,0.08);
           border-radius:14px; padding:28px 24px; }
  h1 { margin:0 0 6px; font-size:17px; font-weight:600; text-align:center; }
  p  { margin:0 0 18px; font-size:13px; line-height:1.45; color:#8e8e93; text-align:center; }
  ul { margin:0 0 20px; padding:0 0 0 18px; font-size:13px; line-height:1.7; color:#8e8e93; }
  li strong { color:#f2f2f7; font-weight:500; }
  label { display:block; font-size:12px; font-weight:600; margin-bottom:6px; color:#8e8e93; }
  input[type=password] { width:100%; box-sizing:border-box; padding:11px 12px; border-radius:10px;
         border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03);
         color:#f2f2f7; font:inherit; font-size:14px; }
  input[type=password]:focus { outline:2px solid #0a84ff; outline-offset:-1px; }
  button { width:100%; margin-top:16px; padding:11px; border:none; border-radius:10px;
         background:#0a84ff; color:#fff; font:inherit; font-size:14px; font-weight:600; cursor:pointer; }
  .fehler { margin:0 0 16px; padding:10px 12px; border-radius:10px; font-size:13px;
         background:rgba(255,69,58,0.12); border:1px solid #ff453a; color:#ff453a; }
</style></head>
<body>
  <form class="karte" method="POST">
    <h1>Zugriff auf Jarvis OS erlauben?</h1>
    <p>Ein Connector möchte mit deinen Jarvis-Daten arbeiten.</p>
    ${fehler ? `<div class="fehler">${html(fehler)}</div>` : ''}
    <ul>
      <li>Tagesüberblick, Routinen und Ziele <strong>lesen</strong></li>
      <li>Aufgaben aus CRM und Erinnerungen <strong>lesen</strong></li>
      <li>Mail-Warteschlange mit Empfängern <strong>lesen</strong></li>
      <li>Mail-Entwürfe <strong>speichern</strong> — nie freigeben, nie senden</li>
    </ul>
    <label for="geheimnis">Jarvis-Zugangswort</label>
    <input type="password" id="geheimnis" name="geheimnis" autocomplete="current-password" autofocus required>
    ${versteckt}
    <button type="submit">Erlauben</button>
  </form>
</body></html>`;

  return new Response(body, { status, headers: SEITEN_KOPF });
}

const text = (status: number, nachricht: string) =>
  new Response(nachricht, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

async function behandeln(req: Request): Promise<Response> {
  if (!istKonfiguriert()) return text(503, 'Der Jarvis-Zugang ist nicht eingerichtet (JARVIS_MCP_SECRET fehlt).');

  const q: Record<string, string> = req.method === 'POST'
    ? await felderLesen(req)
    : Object.fromEntries(new URL(req.url).searchParams);

  const { client_id, redirect_uri, state, code_challenge, code_challenge_method, scope, resource } = q;

  // ── Prüfungen, nach denen NICHT zurückgesprungen werden darf ─────────────
  // Solange die Rücksprung-Adresse nicht als vertrauenswürdig erwiesen ist,
  // geht kein Fehler dorthin — sonst wäre das eine offene Weiterleitung.
  if (!rueckSprungErlaubt(redirect_uri)) return text(400, 'Ungültige oder nicht erlaubte Rücksprung-Adresse.');

  const kunde = macheAuf<{ redirect_uris: string[] }>(client_id, 'kunde');
  if (!kunde) return text(400, 'Unbekannte oder abgelaufene Connector-Kennung.');
  if (!Array.isArray(kunde.redirect_uris) || !kunde.redirect_uris.includes(redirect_uri)) {
    return text(400, 'Diese Rücksprung-Adresse gehört nicht zu dieser Connector-Kennung.');
  }

  // ── Ab hier ist ein Rücksprung erlaubt ─────────────────────────────────
  const issuer = basisAdresse(req);
  const zurueck = (parameter: Record<string, string>) => {
    const u = new URL(redirect_uri);
    for (const [k, v] of Object.entries(parameter)) u.searchParams.set(k, v);
    if (state !== undefined) u.searchParams.set('state', state);
    u.searchParams.set('iss', issuer);
    return new Response(null, { status: 302, headers: { Location: u.toString(), 'Cache-Control': 'no-store' } });
  };

  if (code_challenge_method !== 'S256' || !code_challenge) {
    return zurueck({ error: 'invalid_request', error_description: 'PKCE mit S256 ist erforderlich.' });
  }

  // Ein Zeichen für eine andere Ressource stellt dieser Server nicht aus.
  const ziel = mcpAdresse(req);
  if (resource && ohneSchraegstrich(resource) !== ziel) {
    return zurueck({ error: 'invalid_target', error_description: 'Dieser Server stellt nur Zeichen für Jarvis aus.' });
  }

  const felder: Record<string, string> = {
    client_id, redirect_uri, code_challenge, code_challenge_method,
    ...(state !== undefined ? { state } : {}),
    ...(scope ? { scope } : {}),
    ...(resource ? { resource } : {}),
  };

  if (req.method === 'GET') return seite(felder, null);

  if (!geheimnisStimmt(q.geheimnis)) return seite(felder, 'Das Zugangswort stimmt nicht.', 401);

  const code = packe('code', { client_id, redirect_uri, code_challenge, resource: ziel }, CODE_GUELTIG_SEK);
  return zurueck({ code });
}

export const GET = behandeln;
export const POST = behandeln;
