// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { nachrichtBehandeln, koerperBehandeln, WerkzeugFehler, PROTOKOLL, type Werkzeug } from './protocol';

const NUR_LESEN = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const reihenfolge: string[] = [];

const werkzeuge: Werkzeug[] = [
  {
    name: 'echo', title: 'Echo', description: 'gibt zurück', annotations: NUR_LESEN,
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run(args) {
      reihenfolge.push(`start:${args.n}`);
      await new Promise(r => setTimeout(r, 5));
      reihenfolge.push(`ende:${args.n}`);
      return { args };
    },
  },
  {
    name: 'abgelehnt', title: 'Abgelehnt', description: '', annotations: NUR_LESEN,
    inputSchema: { type: 'object' },
    async run() { throw new WerkzeugFehler('Grund für Rico'); },
  },
  {
    name: 'kaputt', title: 'Kaputt', description: '', annotations: NUR_LESEN,
    inputSchema: { type: 'object' },
    async run() { throw new Error('postgres://geheim@host — interne Einzelheit'); },
  },
];

const rpc = (method: string, params?: unknown, id: unknown = 1) => ({ jsonrpc: '2.0', id, method, params });

describe('Protokoll', () => {
  it('initialize: bekannte Version wird gespiegelt, unbekannte bekommt die eigene', async () => {
    const a = await nachrichtBehandeln(rpc('initialize', { protocolVersion: '2025-06-18' }), werkzeuge);
    expect((a!.result as { protocolVersion: string }).protocolVersion).toBe('2025-06-18');
    const b = await nachrichtBehandeln(rpc('initialize', { protocolVersion: '1999-01-01' }), werkzeuge);
    const r = b!.result as { protocolVersion: string; capabilities: unknown; serverInfo: { name: string } };
    expect(r.protocolVersion).toBe(PROTOKOLL);
    expect(r.capabilities).toEqual({ tools: { listChanged: false } });
    expect(r.serverInfo.name).toBe('jarvis-os');
  });

  it('Mitteilungen bekommen keine Antwort', async () => {
    expect(await nachrichtBehandeln({ jsonrpc: '2.0', method: 'notifications/initialized' }, werkzeuge)).toBeNull();
    expect(await nachrichtBehandeln({ jsonrpc: '2.0', method: 'irgendwas' }, werkzeuge)).toBeNull();
  });

  it('ping', async () => {
    expect((await nachrichtBehandeln(rpc('ping'), werkzeuge))!.result).toEqual({});
  });

  it('tools/list trägt Hinweise und Anmeldepflicht, aber nicht die Funktion', async () => {
    const a = await nachrichtBehandeln(rpc('tools/list'), werkzeuge);
    const tools = (a!.result as { tools: Array<Record<string, unknown>> }).tools;
    expect(tools[0].annotations).toEqual(NUR_LESEN);
    expect(tools[0].securitySchemes).toEqual([{ type: 'oauth2', scopes: ['jarvis'] }]);
    expect(tools[0]).not.toHaveProperty('run');
  });

  it('tools/call liefert Text und structuredContent', async () => {
    const a = await nachrichtBehandeln(rpc('tools/call', { name: 'echo', arguments: { n: 1 } }), werkzeuge);
    const r = a!.result as { content: Array<{ text: string }>; structuredContent: unknown };
    expect(r.structuredContent).toEqual({ args: { n: 1 } });
    expect(JSON.parse(r.content[0].text)).toEqual({ args: { n: 1 } });
  });

  it('unbekanntes Werkzeug, unbekannte Methode, falsche arguments', async () => {
    expect((await nachrichtBehandeln(rpc('tools/call', { name: 'gibtsnicht' }), werkzeuge))!.error).toMatchObject({ code: -32602 });
    expect((await nachrichtBehandeln(rpc('resources/list'), werkzeuge))!.error).toMatchObject({ code: -32601 });
    expect((await nachrichtBehandeln(rpc('tools/call', { name: 'echo', arguments: [1] }), werkzeuge))!.error).toMatchObject({ code: -32602 });
    expect((await nachrichtBehandeln({ jsonrpc: '1.0', id: 5, method: 'ping' }, werkzeuge))!.error).toMatchObject({ code: -32600 });
  });

  it('Ablehnung mit Grund geht ans Modell; interne Fehler ohne Einzelheiten', async () => {
    const log = vi.fn();
    const a = await nachrichtBehandeln(rpc('tools/call', { name: 'abgelehnt' }), werkzeuge, log);
    expect(a!.result).toMatchObject({ isError: true, content: [{ text: 'Grund für Rico' }] });

    const b = await nachrichtBehandeln(rpc('tools/call', { name: 'kaputt' }), werkzeuge, log);
    const text = JSON.stringify(b);
    expect(text).not.toContain('postgres');
    expect(b!.result).toMatchObject({ isError: true });
    // Auch das Log trägt keine Inhalte der Fehlermeldung.
    expect(log.mock.calls.flat().join(' ')).not.toContain('postgres');
  });

  it('Bündel werden nacheinander abgearbeitet, Mitteilungen fallen heraus', async () => {
    reihenfolge.length = 0;
    const a = await koerperBehandeln([
      rpc('tools/call', { name: 'echo', arguments: { n: 1 } }, 1),
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      rpc('tools/call', { name: 'echo', arguments: { n: 2 } }, 2),
    ], werkzeuge);
    expect(Array.isArray(a) && a.length).toBe(2);
    expect(reihenfolge).toEqual(['start:1', 'ende:1', 'start:2', 'ende:2']);
  });

  it('nur Mitteilungen im Bündel → nichts zu antworten', async () => {
    expect(await koerperBehandeln([{ jsonrpc: '2.0', method: 'notifications/initialized' }], werkzeuge)).toBeNull();
  });
});
