// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DayMetric, MetricMatrix } from './AnalyticsService';
import { ausblick } from './MotivationService';
import { feierFuer, naechsteStufe, stufe } from '@/lib/motivation';

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
