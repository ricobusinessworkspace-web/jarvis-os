// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `TrackingService` gegen eine Datenbank im Speicher — nie gegen die geteilte
 * Supabase-Instanz. Geprüft: Quelle aus `core_metric_sources`, CRM-Metriken
 * abgelehnt, Gültigkeitsfenster der Schritte, Idempotenz.
 */
const db = vi.hoisted(() => ({
  quellen: [] as Array<{ metricKey: string; kind: string; priority: number; isActive: boolean; config: Record<string, unknown> }>,
  items: [] as Array<{ id: string; title: string; tracker: { name: string; type: string }; activeFrom: Date | null; archivedOn: Date | null; order: number }>,
  logs: [] as Array<{ itemId: string; date: Date; status: string }>,
  schreibvorgaenge: 0,
}));

vi.mock('../db', () => {
  const gleich = (a: Date, b: Date) => a.getTime() === b.getTime();
  return {
    prisma: {
      coreMetricSource: {
        findMany: async ({ where }: { where: { metricKey: string } }) =>
          db.quellen.filter(q => q.metricKey === where.metricKey && q.isActive).sort((a, b) => a.priority - b.priority),
      },
      trackerItem: {
        findFirst: async ({ where }: { where: { title: string; tracker: { name: string } } }) =>
          db.items.find(i => i.title === where.title && i.tracker.name === where.tracker.name) ?? null,
        findUnique: async ({ where }: { where: { id: string } }) => db.items.find(i => i.id === where.id) ?? null,
        findMany: async ({ where, select }: {
          where: { tracker: { type: string } }; select: { logs: { where: { date: Date } } };
        }) =>
          db.items
            .filter(i => i.tracker.type === where.tracker.type)
            .map(i => ({
              ...i,
              logs: db.logs.filter(l => l.itemId === i.id && gleich(l.date, select.logs.where.date)).map(l => ({ status: l.status })),
            })),
      },
      trackerLog: {
        findUnique: async ({ where }: { where: { itemId_date: { itemId: string; date: Date } } }) =>
          db.logs.find(l => l.itemId === where.itemId_date.itemId && gleich(l.date, where.itemId_date.date)) ?? null,
        upsert: async ({ where, update, create }: {
          where: { itemId_date: { itemId: string; date: Date } };
          update: { status: string }; create: { itemId: string; date: Date; status: string };
        }) => {
          db.schreibvorgaenge++;
          const l = db.logs.find(x => x.itemId === where.itemId_date.itemId && gleich(x.date, where.itemId_date.date));
          if (l) l.status = update.status;
          else db.logs.push({ itemId: create.itemId, date: create.date, status: create.status });
        },
        deleteMany: async ({ where }: { where: { itemId: string; date: Date } }) => {
          db.schreibvorgaenge++;
          db.logs = db.logs.filter(l => !(l.itemId === where.itemId && gleich(l.date, where.date)));
        },
      },
    },
  };
});

import { TrackingService, TrackingFehler } from './TrackingService';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

beforeEach(() => {
  db.quellen = [
    { metricKey: 'training.sessions', kind: 'tracker', priority: 10, isActive: true, config: { tracker: 'Ursachen', item: 'Trainingseinheit' } },
    { metricKey: 'training.sessions', kind: 'personal_log', priority: 90, isActive: true, config: { field: 'workout_completed' } },
    { metricKey: 'sales.calls_count', kind: 'crm_metrics', priority: 10, isActive: true, config: {} },
    { metricKey: 'sales.calls_count', kind: 'tracker', priority: 90, isActive: true, config: { tracker: 'Ursachen', item: 'Anrufe' } },
    { metricKey: 'rule.x', kind: 'tracker', priority: 10, isActive: true, config: { tracker: 'Regeln', item: 'Kein Scrolling', assumeDoneFrom: '2026-10-07' } },
  ];
  db.items = [
    { id: 'train', title: 'Trainingseinheit', tracker: { name: 'Ursachen', type: 'intentions' }, activeFrom: null, archivedOn: null, order: 1 },
    { id: 'anrufe', title: 'Anrufe', tracker: { name: 'Ursachen', type: 'intentions' }, activeFrom: null, archivedOn: null, order: 0 },
    { id: 'scroll', title: 'Kein Scrolling', tracker: { name: 'Regeln', type: 'rules' }, activeFrom: d('2026-10-07'), archivedOn: null, order: 0 },
    { id: 'bett', title: 'GM → Bett machen', tracker: { name: 'Morgenroutine', type: 'routine' }, activeFrom: null, archivedOn: null, order: 0 },
    { id: 'alt', title: 'Kalt duschen', tracker: { name: 'Morgenroutine', type: 'routine' }, activeFrom: null, archivedOn: d('2026-10-07'), order: 1 },
    { id: 'neu', title: 'Journal', tracker: { name: 'Abendroutine', type: 'routine' }, activeFrom: d('2026-10-08'), archivedOn: null, order: 0 },
  ];
  db.logs = [];
  db.schreibvorgaenge = 0;
});

describe('TrackingService — Ursachen und Regeln', () => {
  it('schreibt in den Haken aus core_metric_sources und meldet vorher/nachher', async () => {
    expect(await TrackingService.setzeUrsache('training.sessions', '2026-10-09', true))
      .toEqual({ vorher: null, nachher: 'completed', geaendert: true });
    expect(db.logs).toEqual([{ itemId: 'train', date: d('2026-10-09'), status: 'completed' }]);
    expect(await TrackingService.setzeUrsache('training.sessions', '2026-10-09', false))
      .toEqual({ vorher: 'completed', nachher: 'not_done', geaendert: true });
  });

  it('ist idempotent: dieselbe Anfrage zweimal schreibt einmal', async () => {
    await TrackingService.setzeUrsache('training.sessions', '2026-10-09', true);
    const zweite = await TrackingService.setzeUrsache('training.sessions', '2026-10-09', true);
    expect(zweite).toEqual({ vorher: 'completed', nachher: 'completed', geaendert: false });
    expect(db.schreibvorgaenge).toBe(1);

    expect(await TrackingService.loescheUrsache('training.sessions', '2026-10-08'))
      .toEqual({ vorher: null, nachher: null, geaendert: false });
    expect(db.schreibvorgaenge).toBe(1);
  });

  it('lehnt Calls ab — dort gewinnt das CRM, ein Haken würde nie gelesen', async () => {
    await expect(TrackingService.setzeUrsache('sales.calls_count', '2026-10-09', true)).rejects.toThrow(TrackingFehler);
    expect(db.schreibvorgaenge).toBe(0);
  });

  it('Regel-Rückfall eintragen und zurücknehmen', async () => {
    expect(await TrackingService.setzeUrsache('rule.x', '2026-10-09', false))
      .toMatchObject({ vorher: null, nachher: 'not_done' });
    expect(await TrackingService.loescheUrsache('rule.x', '2026-10-09'))
      .toEqual({ vorher: 'not_done', nachher: null, geaendert: true });
    expect(db.logs).toEqual([]);
  });

  it('kennt keine erfundenen Kennzahlen', async () => {
    await expect(TrackingService.setzeUrsache('gibt.es.nicht', '2026-10-09', true)).rejects.toThrow('Unbekannte Kennzahl');
  });
});

describe('TrackingService — Routine-Schritte', () => {
  it('hakt nur Schritte ab, die an dem Tag galten', async () => {
    await expect(TrackingService.setzeSchritt('alt', '2026-10-07', 'completed')).rejects.toThrow('galt am 2026-10-07 nicht');
    await expect(TrackingService.setzeSchritt('neu', '2026-10-07', 'completed')).rejects.toThrow('galt am 2026-10-07 nicht');
    expect(await TrackingService.setzeSchritt('alt', '2026-10-06', 'completed')).toMatchObject({ geaendert: true });
    expect(await TrackingService.setzeSchritt('neu', '2026-10-08', 'completed')).toMatchObject({ geaendert: true });
  });

  it('lehnt unbekannte Status ab', async () => {
    await expect(TrackingService.setzeSchritt('bett', '2026-10-09', 'erledigt' as never)).rejects.toThrow('Unbekannter Status');
  });

  it('listet die Schritte eines Tages mit ihrem Haken — ohne archivierte und künftige', async () => {
    db.logs.push({ itemId: 'bett', date: d('2026-10-09'), status: 'completed' });
    db.logs.push({ itemId: 'neu', date: d('2026-10-08'), status: 'completed' }); // anderer Tag
    const s = await TrackingService.schritteAm('2026-10-09');
    expect(s.map(x => [x.id, x.status]).sort()).toEqual([['bett', 'completed'], ['neu', null]]);
  });
});
