import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Das Nötigste an OAuth 2.1 für den Jarvis-MCP-Server — ohne Datenbank.
 *
 * Vorbild ist der Anmelde-Server des Lightning CRM (`api/_lib/oauth.js`), aber
 * mit drei bewussten Unterschieden:
 *
 * - **Eigenes Geheimnis.** `JARVIS_MCP_SECRET`, nie `MCP_TOKEN` des CRM, nie
 *   `WIDGET_SECRET_TOKEN`, `INGEST_SECRET` oder `N8N_WEBHOOK_SECRET`. Der
 *   Unterschrift-Schlüssel wird zusätzlich mit einem Jarvis-eigenen Präfix
 *   abgeleitet: selbst wenn jemand beide Geheimnisse gleich wählt, gilt ein
 *   CRM-Zeichen hier nicht.
 * - **ChatGPT als Rücksprung-Ziel.** Das CRM kennt nur Claude-Adressen.
 * - **Issuer-Kennung (RFC 9207).** ChatGPT nutzt seine feste Rücksprung-Adresse
 *   nur, wenn der Anmelde-Server `iss` in jeder Antwort mitschickt.
 *
 * Codes und Zeichen tragen ihren Inhalt unterschrieben in sich. Zum Sperren
 * aller ausgestellten Zeichen ändert man `JARVIS_MCP_SECRET`.
 *
 * **Einzelplatz:** Es gibt genau einen Nutzer (Rico). Die „Anmeldung" ist der
 * Beweis, das Geheimnis zu kennen. Mehrere Nutzer braucht ein echtes Konto-
 * system — nicht einen Parameter, den das Modell setzt.
 */

export const CODE_GUELTIG_SEK = 300; // 5 Minuten, nur zum Einlösen
export const ZEICHEN_GUELTIG_SEK = 60 * 60 * 8; // 8 Stunden
export const ERNEUERUNG_GUELTIG_SEK = 60 * 60 * 24 * 30; // 30 Tage
export const KUNDE_GUELTIG_SEK = 60 * 60 * 24 * 365; // Connector-Kennung, 1 Jahr

export const SCOPE = 'jarvis';

/** Unter dieser Länge gilt das Geheimnis als nicht gesetzt — Zugang bleibt zu. */
const MIN_LAENGE = 32;

export class OAuthKonfigFehler extends Error {}

/** Das Geheimnis, oder `null`, wenn es fehlt oder zu kurz ist. */
function geheimnisOderNull(): string | null {
  const s = process.env.JARVIS_MCP_SECRET;
  return s && s.length >= MIN_LAENGE ? s : null;
}

export function istKonfiguriert(): boolean {
  return geheimnisOderNull() !== null;
}

function schluessel(): Buffer {
  const s = geheimnisOderNull();
  if (!s) throw new OAuthKonfigFehler(`JARVIS_MCP_SECRET fehlt oder ist kürzer als ${MIN_LAENGE} Zeichen.`);
  return createHash('sha256').update(`jarvis-mcp-signatur-v1:${s}`).digest();
}

const gleich = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// ── Verpacken und aufmachen ──────────────────────────────────────────────────
// Aufbau: <nutzlast base64url>.<unterschrift base64url>

type Art = 'kunde' | 'code' | 'zugang' | 'erneuerung';

export function packe(art: Art, daten: Record<string, unknown>, gueltigSek: number): string {
  const nutzlast = Buffer.from(JSON.stringify({
    art,
    ...daten,
    exp: Math.floor(Date.now() / 1000) + gueltigSek,
  })).toString('base64url');
  const unterschrift = createHmac('sha256', schluessel()).update(nutzlast).digest('base64url');
  return `${nutzlast}.${unterschrift}`;
}

export function macheAuf<T extends Record<string, unknown>>(wert: unknown, art: Art): (T & { exp: number }) | null {
  if (typeof wert !== 'string') return null;
  const teile = wert.split('.');
  if (teile.length !== 2 || !teile[0] || !teile[1]) return null;
  const [nutzlast, unterschrift] = teile;

  const soll = createHmac('sha256', schluessel()).update(nutzlast).digest('base64url');
  if (!gleich(unterschrift, soll)) return null;

  let daten: Record<string, unknown>;
  try {
    daten = JSON.parse(Buffer.from(nutzlast, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (daten.art !== art) return null;
  if (typeof daten.exp !== 'number' || daten.exp < Math.floor(Date.now() / 1000)) return null;
  return daten as T & { exp: number };
}

/** Das Geheimnis selbst — Zustimmungsseite und direkter Zugang (curl, Claude Code). */
export function geheimnisStimmt(eingabe: unknown): boolean {
  const s = geheimnisOderNull();
  if (!s || typeof eingabe !== 'string' || !eingabe) return false;
  return gleich(eingabe, s);
}

// ── PKCE ─────────────────────────────────────────────────────────────────────
/** Nur S256; `plain` ist in OAuth 2.1 nicht erlaubt. */
export function pkceStimmt(verifier: unknown, challenge: unknown): boolean {
  if (typeof verifier !== 'string' || typeof challenge !== 'string' || !verifier || !challenge) return false;
  const gerechnet = createHash('sha256').update(verifier).digest('base64url');
  return gleich(gerechnet, challenge);
}

// ── Adressen ─────────────────────────────────────────────────────────────────

/**
 * Basisadresse des Servers — zugleich der `issuer`.
 *
 * `JARVIS_MCP_PUBLIC_URL` nagelt sie fest (empfohlen für Production: dann
 * hängt der Issuer nicht an einer Kopfzeile). Ohne Eintrag gilt die Adresse,
 * unter der die Anfrage kam — so funktionieren Vorschau-Deployments und
 * `localhost` ohne weitere Einstellung.
 */
export function basisAdresse(req: Request): string {
  const fest = process.env.JARVIS_MCP_PUBLIC_URL?.trim();
  if (fest) return fest.replace(/\/+$/, '');

  const url = new URL(req.url);
  const erstes = (v: string | null) => v?.split(',')[0].trim() || null;
  const host = erstes(req.headers.get('x-forwarded-host')) ?? url.host;
  const schema = erstes(req.headers.get('x-forwarded-proto')) ?? url.protocol.replace(':', '');
  return `${schema}://${host}`;
}

export const mcpAdresse = (req: Request) => `${basisAdresse(req)}/api/mcp`;

/** `https://x/api/mcp/` und `https://x/api/mcp` sind dieselbe Ressource. */
export const ohneSchraegstrich = (u: string) => u.replace(/\/+$/, '');

/**
 * Wohin der Browser nach der Zustimmung zurückspringen darf.
 *
 * Offene Weiterleitungen sind ein Einfallstor: ein Angreifer schickt den
 * Vorgang auf seine eigene Seite und fängt den Code ab. Erlaubt sind die
 * beiden Clients, für die der Server gebaut ist, und `localhost` für den
 * MCP Inspector.
 */
const ERLAUBTE_HOSTS = ['claude.ai', 'claude.com', 'chatgpt.com'];

export function rueckSprungErlaubt(adresse: unknown): boolean {
  if (typeof adresse !== 'string') return false;
  let u: URL;
  try {
    u = new URL(adresse);
  } catch {
    return false;
  }
  if (u.username || u.password) return false;
  if (u.protocol === 'http:') return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:') return false;
  return ERLAUBTE_HOSTS.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`));
}

export const zufall = (n = 24) => randomBytes(n).toString('base64url');

/** Kopfzeile für jeden 401 — daran findet der Connector den Anmelde-Weg (RFC 9728). */
export function wegweiser(req: Request, fehler?: { code: string; text: string }): string {
  const teile = [
    'Bearer realm="Jarvis OS"',
    `resource_metadata="${basisAdresse(req)}/.well-known/oauth-protected-resource"`,
    `scope="${SCOPE}"`,
  ];
  if (fehler) teile.push(`error="${fehler.code}"`, `error_description="${fehler.text}"`);
  return teile.join(', ');
}

/**
 * Darf diese Anfrage an den MCP-Server?
 *
 * Zwei Wege:
 * 1. Ein Zeichen vom eigenen Anmelde-Server — der Weg für ChatGPT und Claude.
 *    Es muss für **genau diesen** Server ausgestellt sein (Empfänger und
 *    Aussteller), sonst wäre ein für etwas anderes ausgestelltes Zeichen hier
 *    gültig (Token-Weiterreichung).
 * 2. Das Geheimnis direkt in der Kopfzeile — für curl, MCP Inspector und
 *    Claude Code.
 */
export type Zugang = 'ok' | 'fehlt' | 'ungueltig' | 'unkonfiguriert';

export function zugangPruefen(req: Request): Zugang {
  if (!istKonfiguriert()) return 'unkonfiguriert';

  const kopf = req.headers.get('authorization') ?? '';
  const [schema, wert] = kopf.split(' ');
  if (schema?.toLowerCase() !== 'bearer' || !wert?.trim()) return 'fehlt';
  const gegeben = wert.trim();

  if (geheimnisStimmt(gegeben)) return 'ok';

  const zeichen = macheAuf<{ aud?: string; iss?: string; scope?: string }>(gegeben, 'zugang');
  if (!zeichen) return 'ungueltig';
  if (ohneSchraegstrich(String(zeichen.aud ?? '')) !== mcpAdresse(req)) return 'ungueltig';
  if (zeichen.iss !== basisAdresse(req)) return 'ungueltig';
  if (zeichen.scope !== SCOPE) return 'ungueltig';
  return 'ok';
}

/**
 * Wer ruft? Für das Schreibprotokoll — nie für eine Zugangsentscheidung.
 * Aus dem Zeichen: der Name, mit dem sich der Connector registriert hat, und
 * der Host seiner Rücksprung-Adresse („ChatGPT · chatgpt.com"). Das Geheimnis
 * direkt heißt: curl, Inspector oder Claude Code.
 */
export function clientKennung(req: Request): string {
  const wert = (req.headers.get('authorization') ?? '').split(' ')[1]?.trim() ?? '';
  if (!wert) return 'unbekannt';
  if (geheimnisStimmt(wert)) return 'Zugangswort direkt';
  const zeichen = macheAuf<{ client_id?: string }>(wert, 'zugang');
  const kunde = zeichen?.client_id ? macheAuf<{ name?: string; redirect_uris?: string[] }>(zeichen.client_id, 'kunde') : null;
  if (!kunde) return 'unbekannt';
  let host = '';
  try {
    host = new URL(String(kunde.redirect_uris?.[0] ?? '')).host;
  } catch {
    // keine gültige Adresse — dann nur der Name
  }
  return [String(kunde.name ?? 'MCP Client').slice(0, 60), host].filter(Boolean).join(' · ');
}
