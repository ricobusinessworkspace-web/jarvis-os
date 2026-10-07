// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService, type MetricMatrix } from '@/core/services/AnalyticsService';
import { WERKZEUGE } from './tools';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('performance_wochenverlauf', () => {
  it('liefert abgeschlossene Blockwochen, lässt fehlende Werte offen und zählt echte Nullen', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00.000Z'));
    const matrix: MetricMatrix = {
      '2026-09-29': { 'sales.calls_count': { value: 0, base: 30, stretch: 60, state: 'unter', source: 'crm_calls' } },
      '2026-09-30': { 'sales.calls_count': { value: 40, base: 30, stretch: 60, state: 'basis', source: 'crm_calls' } },
      '2026-10-06': { 'sales.calls_count': { value: null, base: 30, stretch: 60, state: 'ungemessen', source: null } },
    };
    vi.spyOn(AnalyticsService, 'getMatrix').mockResolvedValue(matrix);
    vi.spyOn(AnalyticsService, 'getDefinitions').mockResolvedValue([
      { key: 'sales.calls_count', label: 'Calls', unit: 'count', aggregation: 'sum', isActive: true },
    ] as Awaited<ReturnType<typeof AnalyticsService.getDefinitions>>);

    const tool = WERKZEUGE.find(w => w.name === 'performance_wochenverlauf')!;
    const result = await tool.run({ wochen: 1 }) as {
      wochen: Array<{ von: string; bis: string; abgeschlossen: boolean; kennzahlen: Array<{
        wochenwert: number | null; erfuellte_tage: number; gemessene_tage: number;
      }> }>;
    };
    expect(result.wochen.map(w => [w.von, w.bis, w.abgeschlossen])).toEqual([
      ['2026-09-29', '2026-10-05', true],
      ['2026-10-06', '2026-10-06', false],
    ]);
    expect(result.wochen[0].kennzahlen[0]).toMatchObject({ wochenwert: 40, erfuellte_tage: 1, gemessene_tage: 2 });
    expect(result.wochen[1].kennzahlen[0].wochenwert).toBeNull();
    expect(AnalyticsService.getMatrix).toHaveBeenCalledWith('2026-09-29', '2026-10-06');
  });

  it('nennt die Phase jeder Woche, damit ein Systemwechsel nicht wie ein Leistungswechsel aussieht', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T12:00:00.000Z'));
    vi.spyOn(AnalyticsService, 'getMatrix').mockResolvedValue({});
    vi.spyOn(AnalyticsService, 'getDefinitions').mockResolvedValue([
      { key: 'body.weight', label: 'Gewicht', unit: 'kg', aggregation: 'last', isActive: true },
    ] as Awaited<ReturnType<typeof AnalyticsService.getDefinitions>>);

    const tool = WERKZEUGE.find(w => w.name === 'performance_wochenverlauf')!;
    const result = await tool.run({ wochen: 2 }) as {
      phasen: Array<{ nummer: number; von: string; bis: string | null }>;
      wochen: Array<{ von: string; phasen: number[]; kennzahlen: Array<{ zielquote: number | null }> }>;
    };
    expect(result.phasen.map(p => [p.nummer, p.von, p.bis])).toEqual([
      [1, '2026-09-01', '2026-10-06'],
      [2, '2026-10-07', null],
    ]);
    // 29.09.–05.10. ganz Phase 1, 06.–12.10. über den Wechsel, ab 13.10. Phase 2.
    expect(result.wochen.map(w => [w.von, w.phasen])).toEqual([
      ['2026-09-29', [1]],
      ['2026-10-06', [1, 2]],
      ['2026-10-13', [2]],
    ]);
    // Ohne Ziel keine Quote — nicht 0.
    expect(result.wochen[2].kennzahlen[0].zielquote).toBeNull();
  });
});
