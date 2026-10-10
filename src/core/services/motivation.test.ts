// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DayMetric, MetricMatrix } from './AnalyticsService';
import { ausblick, besteWoche, bloeckeBis, ketten, perfekteTage, tagAusMatrix } from './MotivationService';
import { feierFuer, istPerfekt, naechsteStufe, ringe, stufe } from '@/lib/motivation';

const zelle = (value: number | null, state: DayMetric['state']): DayMetric =>
  ({ value, base: 1, stretch: null, state, source: value === null ? null : 'tracker' });
const matrix = (key: string, tage: Record<string, DayMetric>): MetricMatrix =>
  Object.fromEntries(Object.entries(tage).map(([d, c]) => [d, { [key]: c }]));
const heute = (d: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${d}T10:00:00.000Z`));
};

afterEach(() => vi.useRealTimers());

describe('Stufen', () => {
  it('höchste erreichte Marke, nächste darüber', () => {
    expect([0, 2, 3, 6, 7, 13, 14, 100, 140].map(stufe)).toEqual([0, 0, 3, 3, 7, 7, 14, 100, 100]);
    expect([0, 3, 7, 99, 100].map(naechsteStufe)).toEqual([3, 7, 14, 100, null]);
  });
});

describe('feierFuer', () => {
  const s = (serie: number, rekord: number) => ({ serie, rekord, start: '2026-10-01' });

  it('Rekord nur durch eine Handlung und ab 2 Tagen', () => {
    expect(feierFuer(s(4, 4), s(5, 5), true)).toEqual({ rekord: true, stufe: null });
    expect(feierFuer(s(4, 4), s(5, 5), false)).toEqual({ rekord: false, stufe: null });
    expect(feierFuer(s(0, 0), s(1, 1), true).rekord).toBe(false);
  });

  it('eine Stufe, wenn die Serie genau darauf steigt', () => {
    expect(feierFuer(s(6, 9), s(7, 9), true)).toEqual({ rekord: false, stufe: 7 });
    expect(feierFuer(s(7, 9), s(7, 9), true).stufe).toBeNull();
  });
});

describe('ausblick', () => {
  it('Ursache: Serie heute offen, erledigt +1, abgewählt bleibt sie (Tag läuft)', () => {
    heute('2026-10-09'); // Fr
    const m = matrix('training.sessions', {
      '2026-10-07': zelle(1, 'soll'),
      '2026-10-08': zelle(1, 'soll'),
      '2026-10-09': zelle(null, 'ungemessen'),
    });
    const a = ausblick(m, 'training.sessions', '2026-10-09', { serieAb: '2026-10-07', regel: false });
    expect(a).toMatchObject({ serie: 2, rekord: 2, start: '2026-10-07' });
    expect(a.wennErfuellt).toMatchObject({ serie: 3, rekord: 3, start: '2026-10-07' });
    expect(a.wennNicht).toMatchObject({ serie: 2, rekord: 2 });
  });

  it('Regel: gebrochen reißt die Serie sofort — außer am Sonntag (Joker)', () => {
    heute('2026-10-10'); // Sa
    const sa = matrix('rule.x', {
      '2026-10-08': zelle(1, 'soll'),
      '2026-10-09': zelle(1, 'soll'),
      '2026-10-10': zelle(1, 'soll'),
    });
    const a = ausblick(sa, 'rule.x', '2026-10-10', { serieAb: '2026-10-08', regel: true });
    expect(a.serie).toBe(3);
    expect(a.wennNicht).toMatchObject({ serie: 0, start: null });

    heute('2026-10-11'); // So
    const so = { ...sa, '2026-10-11': { 'rule.x': zelle(1, 'soll') } };
    const b = ausblick(so, 'rule.x', '2026-10-11', { serieAb: '2026-10-08', regel: true });
    expect(b.serie).toBe(4);
    expect(b.wennNicht).toMatchObject({ serie: 3, start: '2026-10-08' });
  });

  it('ein neuer Lauf hat einen neuen Starttag', () => {
    heute('2026-10-09');
    const m = matrix('training.sessions', {
      '2026-10-06': zelle(1, 'soll'),
      '2026-10-07': zelle(0, 'unter'),
      '2026-10-08': zelle(1, 'soll'),
      '2026-10-09': zelle(null, 'ungemessen'),
    });
    const a = ausblick(m, 'training.sessions', '2026-10-09', { serieAb: '2026-10-06', regel: false });
    expect(a.wennErfuellt).toMatchObject({ serie: 2, start: '2026-10-08' });
  });
});

/** Ein ganzer Tag: Ursachen (Calls, Training, Post), Routinen (je 6, Basis 3), eine Regel. */
function tag(o: { calls?: number; training?: boolean; post?: boolean; morgen?: number; abend?: number; regel?: boolean; sonntag?: boolean }) {
  const ursache = (erfuellt: boolean | undefined, base = 1): DayMetric =>
    o.sonntag ? { value: null, base, stretch: null, state: 'offday', source: null }
      : erfuellt === undefined ? { value: null, base, stretch: null, state: 'ungemessen', source: null }
        : { value: erfuellt ? base : 0, base, stretch: null, state: erfuellt ? 'soll' : 'unter', source: 'tracker' };
  const routine = (n: number | undefined): DayMetric =>
    o.sonntag ? { value: null, base: 3, stretch: 6, state: 'offday', source: null }
      : { value: n ?? null, base: 3, stretch: 6, state: !n ? 'ungemessen' : n >= 6 ? 'soll' : n >= 3 ? 'basis' : 'unter', source: n ? 'tracker' : null };
  return {
    'sales.calls_count': o.calls === undefined ? ursache(undefined, 30)
      : { value: o.calls, base: 30, stretch: 50, state: o.calls >= 30 ? 'basis' : 'unter', source: 'crm_metrics' } as DayMetric,
    'training.sessions': ursache(o.training),
    'content.posts': ursache(o.post),
    'routine.morning': routine(o.morgen),
    'routine.evening': routine(o.abend),
    'rule.x': { value: o.regel === false ? 0 : 1, base: 1, stretch: null, state: o.regel === false ? 'unter' : 'soll', source: 'tracker' } as DayMetric,
  };
}
const PERFEKT = { calls: 31, training: true, post: true, morgen: 6, abend: 3 };

describe('Ringe und perfekter Tag', () => {
  it('Ringe zählen Ursachen mit Ziel, Schritte gegen Soll, gehaltene Regeln', () => {
    const m: MetricMatrix = { '2026-10-09': tag({ calls: 10, training: true, morgen: 4, abend: 2, regel: false }) };
    const r = ringe(tagAusMatrix(m, '2026-10-09', ['rule.x']));
    expect(r.ursachen).toEqual({ wert: 1, gesamt: 3, zu: false });
    expect(r.routinen).toEqual({ wert: 6, gesamt: 12, zu: false });
    expect(r.regeln).toEqual({ wert: 0, gesamt: 1, zu: false });
  });

  it('perfekt nur, wenn alles erfüllt, Routinen auf Basis und keine Regel gebrochen', () => {
    const p = (o: Parameters<typeof tag>[0]) => istPerfekt(tagAusMatrix({ d: tag(o) }, 'd', ['rule.x']));
    expect(p(PERFEKT)).toBe(true);
    expect(p({ ...PERFEKT, calls: 29 })).toBe(false);
    expect(p({ ...PERFEKT, abend: 2 })).toBe(false);
    expect(p({ ...PERFEKT, regel: false })).toBe(false);
    expect(p({ sonntag: true })).toBe(false); // Sonntag: nichts mit Ziel → nie perfekt
  });

  it('zählt perfekte Tage; Sonntag ist Joker, heute offen bis perfekt', () => {
    heute('2026-10-13'); // Di
    const m: MetricMatrix = {
      '2026-10-09': tag(PERFEKT),
      '2026-10-10': tag(PERFEKT),
      '2026-10-11': tag({ sonntag: true }),
      '2026-10-12': tag(PERFEKT),
      '2026-10-13': tag({ calls: 3 }),
    };
    expect(perfekteTage(m, ['rule.x'], '2026-10-09', '2026-10-13')).toEqual({ anzahl: 3, serie: 3, rekord: 3, heutePerfekt: false });
    expect(perfekteTage(m, ['rule.x'], '2026-10-09', '2026-10-13', true)).toMatchObject({ anzahl: 4, serie: 4, rekord: 4 });
    const bruch = { ...m, '2026-10-12': tag({ ...PERFEKT, post: false }) };
    expect(perfekteTage(bruch, ['rule.x'], '2026-10-09', '2026-10-13', true)).toMatchObject({ anzahl: 3, serie: 1, rekord: 2 });
  });
});

/** Ein Sonntag vor dem Start einer Regel (Off-Day ohne Ziel) ist „gab es noch nicht", nicht „frei". */
const KETTE_VOR_SONNTAG = (m: MetricMatrix) => {
  const mitSonntag = { ...m, '2026-09-06': { 'rule.x': { value: null, base: null, stretch: null, state: 'offday' as const, source: null } } };
  return ketten(mitSonntag, [{ key: 'rule.x', label: 'R', regel: true }], '2026-09-07')[0].tage.find(t => t.datum === '2026-09-06')!.zustand;
};

describe('Zielbild', () => {
  it('Blöcke bis zum Stichtag, der letzte abgeschnitten', () => {
    expect(bloeckeBis('2027-03-01')).toEqual([
      { nummer: 1, von: '2026-09-01', bis: '2026-11-23' },
      { nummer: 2, von: '2026-11-24', bis: '2027-02-15' },
      { nummer: 3, von: '2027-02-16', bis: '2027-03-01' },
    ]);
  });

  it('Kette: vor dem Start „vor", Sonntag als Joker markiert, heute offen', () => {
    heute('2026-09-07'); // Mo
    const m: MetricMatrix = {
      '2026-09-01': { 'rule.x': { value: null, base: null, stretch: null, state: 'ungemessen', source: null } },
      '2026-09-05': { 'rule.x': zelle(1, 'soll') },
      '2026-09-06': { 'rule.x': zelle(0, 'unter') }, // So: Rückfall, Joker
      '2026-09-07': { 'rule.x': zelle(1, 'soll') },
    };
    const [k] = ketten(m, [{ key: 'rule.x', label: 'Regel', regel: true }], '2026-09-07');
    const z = Object.fromEntries(k.tage.map(t => [t.datum, [t.zustand, t.joker]]));
    expect(z['2026-09-01']).toEqual(['vor', false]);
    expect(KETTE_VOR_SONNTAG(m)).toBe('vor');
    expect(z['2026-09-06']).toEqual(['verfehlt', true]);
    expect(z['2026-09-07']).toEqual(['erfuellt', false]);
    expect(k.serie).toBe(2); // Sa + Mo, der Sonntag reißt nichts
  });

  it('beste Woche nur bei ausreichender Abdeckung', () => {
    heute('2026-09-16');
    const m: MetricMatrix = {};
    // Woche 1 (01.–07.09.): kaum eingetragen, aber alles Eingetragene erfüllt → zählt nicht.
    m['2026-09-01'] = tag(PERFEKT);
    // Woche 2 (08.–14.09.): an allen Tagen eingetragen, Post fehlt zweimal.
    for (const d of ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-14']) {
      m[d] = tag({ ...PERFEKT, post: !['2026-09-09', '2026-09-10'].includes(d) });
    }
    m['2026-09-13'] = tag({ sonntag: true });
    const w = besteWoche(m, '2026-09-16');
    expect(w).toMatchObject({ von: '2026-09-08', bis: '2026-09-14' });
    expect(w!.quote).toBeCloseTo(28 / 30);
  });
});
