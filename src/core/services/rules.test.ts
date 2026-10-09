// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Regeln: gehalten, bis ein Rückfall eingetragen ist (`assumeDoneFrom`).
 * Geprüft über die echte `getMatrix` — nur die Datenbank ist ersetzt.
 */
const trackerRows: Array<{ kind: string; k1: string; k2: string; d: string; value: number; flag: boolean }> = [];

vi.mock('../db', () => {
  const list = <T,>(v: T) => vi.fn(async () => v);
  return {
    prisma: {
      $transaction: (calls: Array<Promise<unknown>>) => Promise.all(calls),
      // Tagged Template: Zielwerte des CRM (leer) oder die Sammelabfrage.
      $queryRaw: vi.fn(async (sql: TemplateStringsArray) =>
        sql.join('').includes('crm_metric_targets') ? [] : trackerRows
      ),
      coreMetricDefinition: {
        findMany: list([
          { key: 'rule.x', label: 'Kein Scrolling', unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'rules', sortOrder: 1, isActive: true },
        ]),
      },
      coreMetricSource: {
        findMany: list([
          { metricKey: 'rule.x', kind: 'tracker', priority: 10, isActive: true,
            config: { tracker: 'Regeln', item: 'Kein Scrolling', assumeDoneFrom: '2026-10-07' } },
        ]),
      },
      coreIntention: {
        findMany: list([
          { metricKey: 'rule.x', baseValue: 1, stretchValue: null, comparator: '>=', derivedKind: null,
            derivedConfig: {}, activeWeekdays: [1, 2, 3, 4, 5, 6, 7],
            validFrom: new Date('2026-10-07T00:00:00.000Z'), validTo: null },
        ]),
      },
      tracker: { findMany: list([]) },
      ingestHealthTarget: { findMany: list([]) },
    },
  };
});

afterEach(() => {
  vi.useRealTimers();
  trackerRows.length = 0;
});

describe('Regeln — gehalten bis zum Rückfall', () => {
  it('nimmt ohne Eintrag „gehalten" an, ab Start bis heute — auch sonntags', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T08:00:00.000Z')); // Mo
    trackerRows.push({ kind: 'tracker', k1: 'Regeln', k2: 'Kein Scrolling', d: '2026-10-09', value: 0, flag: false });

    const { AnalyticsService, invalidateSemanticConfig } = await import('./AnalyticsService');
    invalidateSemanticConfig();
    const m = await AnalyticsService.getMatrix('2026-10-06', '2026-10-13');
    const v = (d: string) => [m[d]['rule.x'].value, m[d]['rule.x'].state];

    expect(v('2026-10-06')).toEqual([null, 'ungemessen']); // vor dem Start: nichts angenommen
    expect(m['2026-10-06']['rule.x'].base).toBeNull(); // … und kein Ziel: die Regel gab es noch nicht
    expect(v('2026-10-07')).toEqual([1, 'soll']);
    expect(v('2026-10-09')).toEqual([0, 'unter']); // eingetragener Rückfall
    expect(v('2026-10-11')).toEqual([1, 'soll']); // Sonntag zählt
    expect(v('2026-10-12')).toEqual([1, 'soll']); // heute: ab morgens gehalten
    expect(v('2026-10-13')).toEqual([null, 'ungemessen']); // Zukunft: nichts angenommen

    const s = AnalyticsService.summarize(m, 'rule.x', '2026-10-07', '2026-10-12');
    expect(s).toMatchObject({ streak: 3, bestStreak: 3, met: 5, measured: 6 });
  });
});
