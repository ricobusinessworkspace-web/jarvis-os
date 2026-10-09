// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService, type MetricMatrix } from '@/core/services/AnalyticsService';
import { WERKZEUGE } from './tools';

type Layer = Awaited<ReturnType<typeof AnalyticsService.getLayer>>;

/** Semantic Layer im Speicher: Metriken mit Quelle und Zielfassungen. */
function layer(metriken: Array<{
  key: string; label: string; unit?: string; aggregation?: string; domain?: string;
  quelle?: Record<string, unknown>; ziele?: Array<{ von: string; bis?: string; tage?: number[] }>;
}>): Layer {
  return {
    definitions: metriken.map((m, i) => ({
      key: m.key, label: m.label, unit: m.unit ?? 'count', aggregation: m.aggregation ?? 'sum',
      direction: 'higher_is_better', domain: m.domain ?? 'body', sortOrder: i, isActive: true, createdAt: new Date(),
    })),
    sources: metriken.map(m => ({
      id: m.key, metricKey: m.key, kind: 'tracker', config: m.quelle ?? {}, priority: 10, isActive: true, createdAt: new Date(),
    })),
    intentions: metriken.flatMap(m => (m.ziele ?? []).map(z => ({
      id: `${m.key}${z.von}`, metricKey: m.key, baseValue: 1, stretchValue: null, comparator: '>=',
      derivedKind: null, derivedConfig: {}, activeWeekdays: z.tage ?? [1, 2, 3, 4, 5, 6],
      validFrom: new Date(`${z.von}T00:00:00.000Z`), validTo: z.bis ? new Date(`${z.bis}T00:00:00.000Z`) : null,
      createdAt: new Date(), updatedAt: new Date(),
    }))),
  } as Layer;
}

const werkzeug = (name: string) => WERKZEUGE.find(w => w.name === name)!;

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
    vi.spyOn(AnalyticsService, 'getLayer').mockResolvedValue(layer([
      { key: 'sales.calls_count', label: 'Calls', domain: 'business', quelle: { zeroFrom: '2026-09-01' }, ziele: [{ von: '2026-09-01' }] },
    ]));

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
    vi.spyOn(AnalyticsService, 'getLayer').mockResolvedValue(layer([
      { key: 'body.weight', label: 'Gewicht', unit: 'kg', aggregation: 'last' },
    ]));

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

describe('performance_wochenverlauf — Datenqualität', () => {
  it('nennt eine Woche lückenhaft, wenn weniger als die Hälfte der Tage mit Ziel eingetragen ist', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z')); // Di, Woche 3 beginnt
    // Woche 08.–14.09.: Training an 2 von 6 Tagen eingetragen; Calls lückenlos (zählen nicht mit).
    const matrix: MetricMatrix = {};
    for (const d of ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-14']) {
      matrix[d] = {
        'training.sessions': { value: null, base: 1, stretch: null, state: 'ungemessen', source: null },
        'sales.calls_count': { value: 0, base: 30, stretch: 50, state: 'unter', source: 'crm_metrics' },
      };
    }
    matrix['2026-09-13'] = {
      'training.sessions': { value: null, base: 1, stretch: null, state: 'offday', source: null },
      'sales.calls_count': { value: null, base: 30, stretch: 50, state: 'offday', source: null },
    };
    matrix['2026-09-08']['training.sessions'] = { value: 1, base: 1, stretch: null, state: 'soll', source: 'tracker' };
    matrix['2026-09-09']['training.sessions'] = { value: 1, base: 1, stretch: null, state: 'soll', source: 'tracker' };
    vi.spyOn(AnalyticsService, 'getMatrix').mockResolvedValue(matrix);
    vi.spyOn(AnalyticsService, 'getLayer').mockResolvedValue(layer([
      { key: 'training.sessions', label: 'Training', ziele: [{ von: '2026-09-01' }] },
      { key: 'sales.calls_count', label: 'Calls', domain: 'business', quelle: { zeroFrom: '2026-09-01' }, ziele: [{ von: '2026-09-01' }] },
    ]));

    const r = await werkzeug('performance_wochenverlauf').run({ wochen: 1 }) as {
      wochen: Array<{ von: string; datenqualitaet: string; datenabdeckung: number | null }>;
    };
    expect(r.wochen[0]).toMatchObject({ von: '2026-09-08', datenqualitaet: 'lueckenhaft', datenabdeckung: 0.33 });
  });

  it('erlaubt bis zu zwölf Wochen, nicht mehr', async () => {
    await expect(werkzeug('performance_wochenverlauf').run({ wochen: 13 })).rejects.toThrow('1 bis 12');
  });
});

describe('jarvis_kontext', () => {
  it('leitet ab, was ein leerer Tag heißt, seit wann bewertet wird und welche Lücken es gibt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T10:00:00.000Z'));
    vi.spyOn(AnalyticsService, 'getMatrix').mockResolvedValue({
      '2026-10-09': {
        'rule.x': { value: 1, base: 1, stretch: null, state: 'soll', source: 'tracker' },
        'body.sleep_hours': { value: 7, base: null, stretch: null, state: 'erfasst', source: 'personal_log' },
      },
    });
    vi.spyOn(AnalyticsService, 'getLayer').mockResolvedValue(layer([
      { key: 'rule.x', label: 'Kein Scrolling', domain: 'rules', quelle: { assumeDoneFrom: '2026-10-07' },
        ziele: [{ von: '2026-10-07', tage: [1, 2, 3, 4, 5, 6, 7] }] },
      { key: 'body.sleep_hours', label: 'Schlaf', ziele: [{ von: '2026-09-01', bis: '2026-10-06' }] },
      { key: 'sales.stage_x', label: 'Angebot raus', domain: 'business', quelle: { zeroFrom: '2026-09-12' } },
    ]));

    const r = await werkzeug('jarvis_kontext').run({}) as {
      kennzahlen: Array<{ key: string; fehlender_wert: string; wird_heute_bewertet: boolean; tage: string | null;
        bewertet: Array<{ von: string; bis: string | null }> }>;
      bekannte_luecken: Array<{ betrifft: string[]; von: string; bis: string | null }>;
    };
    const k = Object.fromEntries(r.kennzahlen.map(x => [x.key, x]));
    expect(k['rule.x']).toMatchObject({ fehlender_wert: 'gehalten', wird_heute_bewertet: true });
    expect(k['rule.x'].tage).toContain('Joker');
    expect(k['body.sleep_hours']).toMatchObject({ fehlender_wert: 'nicht_gemessen', wird_heute_bewertet: false, tage: null });
    expect(k['body.sleep_hours'].bewertet).toEqual([expect.objectContaining({ von: '2026-09-01', bis: '2026-10-06' })]);
    expect(k['sales.stage_x'].fehlender_wert).toBe('null');

    const luecke = (key: string) => r.bekannte_luecken.filter(l => l.betrifft.includes(key));
    expect(luecke('rule.x')).toEqual([expect.objectContaining({ von: '2026-09-01', bis: '2026-10-06' })]);
    expect(luecke('body.sleep_hours')).toEqual([expect.objectContaining({ von: '2026-10-06', bis: null })]);
    expect(luecke('sales.stage_x')).toEqual([expect.objectContaining({ bis: '2026-09-11' })]);
    expect(luecke('routine.morning')).toHaveLength(1); // feste Lücke: gelöschte Haken
  });
});

describe('phasen_vergleich', () => {
  it('wertet je Phase für sich und markiert, was bei niedriger Abdeckung nicht aussagekräftig ist', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T10:00:00.000Z'));
    const matrix: MetricMatrix = {};
    // Phase 1: Training an 3 von 31 getrackten Tagen eingetragen, alle erfüllt. Phase 2: 07.–08.10. erfüllt.
    for (let t = Date.parse('2026-09-01'); t <= Date.parse('2026-10-09'); t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10);
      const sonntag = new Date(t).getUTCDay() === 0;
      const eingetragen = ['2026-09-02', '2026-09-03', '2026-09-04', '2026-10-07', '2026-10-08'].includes(d);
      matrix[d] = { 'training.sessions': sonntag
        ? { value: null, base: 1, stretch: null, state: 'offday', source: null }
        : eingetragen
          ? { value: 1, base: 1, stretch: null, state: 'soll', source: 'tracker' }
          : { value: null, base: 1, stretch: null, state: 'ungemessen', source: null } };
    }
    vi.spyOn(AnalyticsService, 'getMatrix').mockResolvedValue(matrix);
    vi.spyOn(AnalyticsService, 'getLayer').mockResolvedValue(layer([
      { key: 'training.sessions', label: 'Training', ziele: [{ von: '2026-09-01' }] },
    ]));

    const r = await werkzeug('phasen_vergleich').run({}) as {
      phasen: Array<{ nummer: number; bis: string; datenqualitaet: string; kennzahlen: Array<{
        erfuellt: number; tage_mit_ziel: number; datenabdeckung: number; beste_serie: number; aussagekraeftig: boolean;
      }> }>;
    };
    expect(r.phasen[0]).toMatchObject({ nummer: 1, bis: '2026-10-06', datenqualitaet: 'lueckenhaft' });
    expect(r.phasen[0].kennzahlen[0]).toMatchObject({ erfuellt: 3, tage_mit_ziel: 31, beste_serie: 3, aussagekraeftig: false });
    // Heute (09.10.) ist offen und zählt nicht; 07. + 08. erfüllt.
    expect(r.phasen[1]).toMatchObject({ nummer: 2, bis: '2026-10-09', datenqualitaet: 'ausreichend' });
    expect(r.phasen[1].kennzahlen[0]).toMatchObject({ erfuellt: 2, tage_mit_ziel: 2, aussagekraeftig: true });
  });
});

describe('tage_anzeigen', () => {
  const tage = () => werkzeug('tage_anzeigen');

  it('lehnt Zukunft, mehr als 31 Tage und kaputte Daten ab', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T10:00:00.000Z'));
    await expect(tage().run({ von: '2026-10-01', bis: '2026-10-10' })).rejects.toThrow('Zukunft');
    await expect(tage().run({ von: '2026-09-01', bis: '2026-10-09' })).rejects.toThrow('Höchstens 31');
    await expect(tage().run({ von: '2026-02-31', bis: '2026-10-09' })).rejects.toThrow('kein gültiges Datum');
    await expect(tage().run({ von: '2026-10-05', bis: '2026-10-01' })).rejects.toThrow('nach bis');
  });

  it('liefert je Tag Phase und Werte, ohne Auswahl ohne Vertriebs-Unterkennzahlen', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-09T10:00:00.000Z'));
    vi.spyOn(AnalyticsService, 'getLayer').mockResolvedValue(layer([
      { key: 'training.sessions', label: 'Training', ziele: [{ von: '2026-09-01' }] },
      { key: 'sales.calls_count', label: 'Calls', domain: 'business' },
      { key: 'sales.stage_x', label: 'Angebot raus', domain: 'business' },
    ]));
    const getMatrix = vi.spyOn(AnalyticsService, 'getMatrix').mockResolvedValue({
      '2026-10-06': { 'training.sessions': { value: null, base: 1, stretch: null, state: 'ungemessen', source: null } },
      '2026-10-07': { 'training.sessions': { value: 1, base: 1, stretch: null, state: 'soll', source: 'tracker' } },
    });

    const r = await tage().run({ von: '2026-10-06', bis: '2026-10-07' }) as {
      tage: Array<{ datum: string; phase: number; wochentag: string; kennzahlen: Record<string, { wert: number | null } | null> }>;
    };
    expect(getMatrix).toHaveBeenCalledWith('2026-10-06', '2026-10-07', ['training.sessions', 'sales.calls_count']);
    expect(r.tage.map(t => [t.datum, t.phase, t.wochentag])).toEqual([
      ['2026-10-06', 1, 'Dienstag'],
      ['2026-10-07', 2, 'Mittwoch'],
    ]);
    expect(r.tage[0].kennzahlen['training.sessions']?.wert).toBeNull();
    expect(r.tage[1].kennzahlen['training.sessions']?.wert).toBe(1);

    await expect(tage().run({ von: '2026-10-06', bis: '2026-10-07', kennzahlen: ['gibt.es.nicht'] }))
      .rejects.toThrow('Unbekannte Kennzahl');
  });
});
