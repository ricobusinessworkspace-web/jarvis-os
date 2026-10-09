// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash, createHmac } from 'node:crypto';

// Kein echter Datenbank-Client in Tests — die Werkzeuge werden hier nicht aufgerufen.
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { POST as register } from '@/app/api/oauth/register/route';
import { GET as authorizeGet, POST as authorizePost } from '@/app/api/oauth/authorize/route';
import { POST as token } from '@/app/api/oauth/token/route';
import { POST as mcpPost, GET as mcpGet } from '@/app/api/mcp/route';
import { GET as resourceMeta } from '@/app/.well-known/oauth-protected-resource/[[...rest]]/route';
import { GET as serverMeta } from '@/app/.well-known/oauth-authorization-server/[[...rest]]/route';
import { rueckSprungErlaubt, zugangPruefen, packe, clientKennung } from './oauth';

const BASIS = 'https://jarvis.example.app';
const MCP = `${BASIS}/api/mcp`;
const GEHEIMNIS = 'test-geheimnis-das-lang-genug-ist-0123456789';
const CHATGPT = 'https://chatgpt.com/connector_platform_oauth_redirect';

const VERIFIER = 'ein-verifier-mit-genug-zufall-0123456789abcdefghijklmnop';
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

const formular = (url: string, felder: Record<string, string>) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(felder).toString(),
  });

const mcpAnfrage = (zeichen: string | null, koerper: unknown = { jsonrpc: '2.0', id: 1, method: 'tools/list' }) =>
  new Request(MCP, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(zeichen ? { authorization: `Bearer ${zeichen}` } : {}) },
    body: JSON.stringify(koerper),
  });

async function registrieren(redirect = CHATGPT) {
  const res = await register(new Request(`${BASIS}/api/oauth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ redirect_uris: [redirect], client_name: 'ChatGPT' }),
  }));
  return { res, daten: await res.json() };
}

function zustimmungsFelder(client_id: string, extra: Record<string, string> = {}) {
  return {
    client_id,
    redirect_uri: CHATGPT,
    response_type: 'code',
    state: 'zustand-123',
    code_challenge: CHALLENGE,
    code_challenge_method: 'S256',
    resource: MCP,
    ...extra,
  };
}

async function codeHolen(client_id: string) {
  const res = await authorizePost(formular(`${BASIS}/api/oauth/authorize`, { ...zustimmungsFelder(client_id), geheimnis: GEHEIMNIS }));
  expect(res.status).toBe(302);
  return new URL(res.headers.get('location')!);
}

async function einloesen(felder: Record<string, string>) {
  const res = await token(formular(`${BASIS}/api/oauth/token`, felder));
  return { res, daten: await res.json() };
}

async function anmelden() {
  const { daten: kunde } = await registrieren();
  const ruecksprung = await codeHolen(kunde.client_id);
  const { daten } = await einloesen({
    grant_type: 'authorization_code',
    code: ruecksprung.searchParams.get('code')!,
    client_id: kunde.client_id,
    redirect_uri: CHATGPT,
    code_verifier: VERIFIER,
    resource: MCP,
  });
  return { kunde, zeichen: daten };
}

beforeEach(() => {
  vi.stubEnv('JARVIS_MCP_SECRET', GEHEIMNIS);
  vi.stubEnv('JARVIS_MCP_PUBLIC_URL', BASIS);
});
afterEach(() => vi.unstubAllEnvs());

describe('Beschreibungen (RFC 9728 / 8414)', () => {
  it('nennen denselben Issuer an beiden Stellen, S256 und iss-Parameter', async () => {
    const r = await (await resourceMeta(new Request(`${BASIS}/.well-known/oauth-protected-resource`))).json();
    const s = await (await serverMeta(new Request(`${BASIS}/.well-known/oauth-authorization-server`))).json();
    expect(r.resource).toBe(MCP);
    expect(r.authorization_servers).toEqual([s.issuer]);
    expect(s.issuer).toBe(BASIS);
    expect(s.code_challenge_methods_supported).toEqual(['S256']);
    expect(s.authorization_response_iss_parameter_supported).toBe(true);
    expect(s.registration_endpoint).toBe(`${BASIS}/api/oauth/register`);
  });

  it('nehmen ohne feste Adresse die Adresse der Anfrage', async () => {
    vi.stubEnv('JARVIS_MCP_PUBLIC_URL', '');
    const r = await (await resourceMeta(new Request('http://localhost:3000/.well-known/oauth-protected-resource'))).json();
    expect(r.resource).toBe('http://localhost:3000/api/mcp');
  });
});

describe('Rücksprung-Adressen', () => {
  it('erlaubt ChatGPT, Claude und localhost', () => {
    expect(rueckSprungErlaubt(CHATGPT)).toBe(true);
    expect(rueckSprungErlaubt('https://chatgpt.com/connector/oauth/abc123')).toBe(true);
    expect(rueckSprungErlaubt('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(rueckSprungErlaubt('http://localhost:6274/oauth/callback')).toBe(true);
  });

  it('lehnt fremde Adressen, Doppelgänger und Nicht-HTTPS ab', () => {
    expect(rueckSprungErlaubt('https://evil.example/cb')).toBe(false);
    expect(rueckSprungErlaubt('https://chatgpt.com.evil.example/cb')).toBe(false);
    expect(rueckSprungErlaubt('https://evilchatgpt.com/cb')).toBe(false);
    expect(rueckSprungErlaubt('http://chatgpt.com/cb')).toBe(false);
    expect(rueckSprungErlaubt('https://user:pw@chatgpt.com/cb')).toBe(false);
    expect(rueckSprungErlaubt('javascript:alert(1)')).toBe(false);
  });

  it('Registrierung mit fremder Adresse wird abgelehnt', async () => {
    const { res, daten } = await registrieren('https://evil.example/cb');
    expect(res.status).toBe(400);
    expect(daten.error).toBe('invalid_redirect_uri');
  });
});

describe('Anmelde-Ablauf', () => {
  it('vollständig: registrieren → zustimmen → Code mit state und iss → Zeichen → MCP', async () => {
    const { res: regRes, daten: kunde } = await registrieren();
    expect(regRes.status).toBe(201);

    const seite = await authorizeGet(new Request(`${BASIS}/api/oauth/authorize?${new URLSearchParams(zustimmungsFelder(kunde.client_id))}`));
    expect(seite.status).toBe(200);
    expect(seite.headers.get('x-frame-options')).toBe('DENY');
    expect(await seite.text()).toContain('nie freigeben, nie senden');

    const ruecksprung = await codeHolen(kunde.client_id);
    expect(ruecksprung.origin + ruecksprung.pathname).toBe(CHATGPT);
    expect(ruecksprung.searchParams.get('state')).toBe('zustand-123');
    expect(ruecksprung.searchParams.get('iss')).toBe(BASIS);

    const { res, daten } = await einloesen({
      grant_type: 'authorization_code',
      code: ruecksprung.searchParams.get('code')!,
      client_id: kunde.client_id,
      redirect_uri: CHATGPT,
      code_verifier: VERIFIER,
      resource: MCP,
    });
    expect(res.status).toBe(200);
    expect(daten.token_type).toBe('Bearer');

    const antwort = await mcpPost(mcpAnfrage(daten.access_token));
    expect(antwort.status).toBe(200);
    const liste = await antwort.json();
    expect(liste.result.tools.map((t: { name: string }) => t.name)).toContain('heute_ueberblick');
  });

  it('falsches Zugangswort gibt keinen Code', async () => {
    const { daten: kunde } = await registrieren();
    const res = await authorizePost(formular(`${BASIS}/api/oauth/authorize`, { ...zustimmungsFelder(kunde.client_id), geheimnis: 'falsch' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('location')).toBeNull();
  });

  it('Rücksprung-Adresse, die nicht zur Kennung gehört, wird nicht angesprungen', async () => {
    const { daten: kunde } = await registrieren();
    const res = await authorizeGet(new Request(`${BASIS}/api/oauth/authorize?${new URLSearchParams(
      zustimmungsFelder(kunde.client_id, { redirect_uri: 'https://claude.ai/api/mcp/auth_callback' }),
    )}`));
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  it('ohne PKCE: Fehler zurück an den Connector, mit iss', async () => {
    const { daten: kunde } = await registrieren();
    const res = await authorizeGet(new Request(`${BASIS}/api/oauth/authorize?${new URLSearchParams(
      zustimmungsFelder(kunde.client_id, { code_challenge_method: 'plain' }),
    )}`));
    expect(res.status).toBe(302);
    const ziel = new URL(res.headers.get('location')!);
    expect(ziel.searchParams.get('error')).toBe('invalid_request');
    expect(ziel.searchParams.get('iss')).toBe(BASIS);
  });

  it('Zeichen für eine andere Ressource werden nicht ausgestellt', async () => {
    const { daten: kunde } = await registrieren();
    const res = await authorizeGet(new Request(`${BASIS}/api/oauth/authorize?${new URLSearchParams(
      zustimmungsFelder(kunde.client_id, { resource: 'https://calling-station.vercel.app/api/mcp' }),
    )}`));
    expect(new URL(res.headers.get('location')!).searchParams.get('error')).toBe('invalid_target');
  });

  it('falscher PKCE-Verifier → invalid_grant', async () => {
    const { daten: kunde } = await registrieren();
    const ruecksprung = await codeHolen(kunde.client_id);
    const { res, daten } = await einloesen({
      grant_type: 'authorization_code',
      code: ruecksprung.searchParams.get('code')!,
      client_id: kunde.client_id,
      redirect_uri: CHATGPT,
      code_verifier: 'falscher-verifier',
    });
    expect(res.status).toBe(400);
    expect(daten.error).toBe('invalid_grant');
  });

  it('Erneuerung liefert ein neues gültiges Zeichen', async () => {
    const { kunde, zeichen } = await anmelden();
    const { res, daten } = await einloesen({ grant_type: 'refresh_token', refresh_token: zeichen.refresh_token, client_id: kunde.client_id });
    expect(res.status).toBe(200);
    expect(zugangPruefen(mcpAnfrage(daten.access_token))).toBe('ok');
  });

  it('ein Erneuerungs-Zeichen ist kein Zugangs-Zeichen', async () => {
    const { zeichen } = await anmelden();
    expect(zugangPruefen(mcpAnfrage(zeichen.refresh_token))).toBe('ungueltig');
  });
});

describe('MCP-Zugang', () => {
  it('ohne Anmeldung 401 mit Wegweiser', async () => {
    const res = await mcpPost(mcpAnfrage(null));
    expect(res.status).toBe(401);
    const kopf = res.headers.get('www-authenticate')!;
    expect(kopf).toContain(`resource_metadata="${BASIS}/.well-known/oauth-protected-resource"`);
  });

  it('ungültiges Zeichen 401 mit invalid_token', async () => {
    const res = await mcpPost(mcpAnfrage('abc.def'));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('error="invalid_token"');
  });

  it('ohne JARVIS_MCP_SECRET geschlossen — auch für jedes Zeichen', async () => {
    const { zeichen } = await anmelden();
    vi.stubEnv('JARVIS_MCP_SECRET', '');
    const res = await mcpPost(mcpAnfrage(zeichen.access_token));
    expect(res.status).toBe(503);
  });

  it('zu kurzes Geheimnis zählt als nicht gesetzt', async () => {
    vi.stubEnv('JARVIS_MCP_SECRET', 'kurz');
    expect(zugangPruefen(mcpAnfrage('kurz'))).toBe('unkonfiguriert');
  });

  it('das Geheimnis direkt in der Kopfzeile reicht (curl, Inspector)', () => {
    expect(zugangPruefen(mcpAnfrage(GEHEIMNIS))).toBe('ok');
  });

  it('ein Zeichen im Format des CRM wird abgewiesen — auch bei gleichem Geheimnis', () => {
    // So stellt das Lightning CRM aus: Schlüssel = Geheimnis direkt, Art „zeichen".
    const nutzlast = Buffer.from(JSON.stringify({ art: 'zeichen', aud: MCP, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const crmZeichen = `${nutzlast}.${createHmac('sha256', GEHEIMNIS).update(nutzlast).digest('base64url')}`;
    expect(zugangPruefen(mcpAnfrage(crmZeichen))).toBe('ungueltig');
  });

  it('ein Jarvis-Zeichen für eine andere Adresse wird abgewiesen', () => {
    const fremd = packe('zugang', { aud: 'https://anderer-server.example/api/mcp', iss: BASIS, scope: 'jarvis' }, 3600);
    expect(zugangPruefen(mcpAnfrage(fremd))).toBe('ungueltig');
  });

  it('ein abgelaufenes Zeichen wird abgewiesen', () => {
    const alt = packe('zugang', { aud: MCP, iss: BASIS, scope: 'jarvis' }, -1);
    expect(zugangPruefen(mcpAnfrage(alt))).toBe('ungueltig');
  });

  it('nach Wechsel des Geheimnisses sind alle Zeichen wertlos', async () => {
    const { zeichen } = await anmelden();
    vi.stubEnv('JARVIS_MCP_SECRET', `${GEHEIMNIS}-neu`);
    expect(zugangPruefen(mcpAnfrage(zeichen.access_token))).toBe('ungueltig');
  });

  it('nennt fürs Schreibprotokoll den Client aus dem Zeichen', async () => {
    const { zeichen } = await anmelden();
    expect(clientKennung(mcpAnfrage(zeichen.access_token))).toBe('ChatGPT · chatgpt.com');
    expect(clientKennung(mcpAnfrage(GEHEIMNIS))).toBe('Zugangswort direkt');
    expect(clientKennung(mcpAnfrage('abc.def'))).toBe('unbekannt');
    expect(clientKennung(mcpAnfrage(null))).toBe('unbekannt');
  });

  it('GET auf /api/mcp ist 405 (kein Ereignisstrom)', () => {
    expect(mcpGet().status).toBe(405);
  });
});
