// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService, type DayMetric, type MetricMatrix } from './AnalyticsService';

/** Eine Zelle mit Ziel 1 — wie bei Regeln und Ursachen. */
const zelle = (value: number | null, state: DayMetric['state'], base: number | null = 1): DayMetric => ({
  value, base, stretch: null, state, source: value === null ? null : 'tracker',
});

const matrixAus = (key: string, tage: Record<string, DayMetric>): MetricMatrix =>
  Object.fromEntries(Object.entries(tage).map(([d, c]) => [d, { [key]: c }]));

/** Welcher Tag „heute" ist — nur der echte heutige Tag kann noch offen sein. */
const heute = (d: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${d}T10:00:00.000Z`));
};

afterEach(() => vi.useRealTimers());

describe('AnalyticsService.summarize', () => {
  // 2026-10-10 Sa, 11 So, 12 Mo, 13 Di
  it('zählt den Sonntag mit, wenn die Metrik dort keinen Off-Day hat (Regeln)', () => {
    const m = matrixAus('rule.x', {
      '2026-10-10': zelle(1, 'soll'),
      '2026-10-11': zelle(1, 'soll'),
      '2026-10-12': zelle(1, 'soll'),
    });
    const s = AnalyticsService.summarize(m, 'rule.x', '2026-10-10', '2026-10-12');
    expect(s).toMatchObject({ tracked: 3, targeted: 3, met: 3, streak: 3, bestStreak: 3, adherence: 1 });
  });

  it('überspringt den Sonntag, wenn die Matrix ihn als Off-Day führt', () => {
    const m = matrixAus('training.sessions', {
      '2026-10-10': zelle(1, 'soll'),
      '2026-10-11': zelle(null, 'offday'),
      '2026-10-12': zelle(1, 'soll'),
    });
    const s = AnalyticsService.summarize(m, 'training.sessions', '2026-10-10', '2026-10-12');
    expect(s).toMatchObject({ tracked: 2, met: 2, streak: 2 });
  });

  it('gibt keine Quote, wenn im Zeitraum kein Ziel galt — statt 0 %', () => {
    const m = matrixAus('body.weight', {
      '2026-10-12': zelle(80.1, 'erfasst', null),
      '2026-10-13': zelle(null, 'ungemessen', null),
      '2026-10-14': zelle(80.0, 'erfasst', null),
    });
    const s = AnalyticsService.summarize(m, 'body.weight', '2026-10-12', '2026-10-14');
    expect(s).toMatchObject({ tracked: 3, targeted: 0, measured: 2, adherence: null });
  });

  it('heute ohne Eintrag zählt nicht in die Quote — der Tag läuft noch', () => {
    heute('2026-10-13');
    const m = matrixAus('rule.x', {
      '2026-10-12': zelle(1, 'soll'),
      '2026-10-13': zelle(null, 'ungemessen'),
    });
    const s = AnalyticsService.summarize(m, 'rule.x', '2026-10-12', '2026-10-13');
    expect(s).toMatchObject({ tracked: 1, targeted: 1, adherence: 1, coverage: 1, streak: 1 });
  });

  it('rechnet die Quote nur über die Tage, an denen ein Ziel galt', () => {
    // Ziel endet nach dem 12. (Phasenwechsel): der 13. zählt nicht in die Quote.
    const m = matrixAus('body.sleep_hours', {
      '2026-10-12': { value: 7, base: 6, stretch: 8, state: 'basis', source: 'personal_log' },
      '2026-10-13': zelle(5, 'erfasst', null),
    });
    const s = AnalyticsService.summarize(m, 'body.sleep_hours', '2026-10-12', '2026-10-13');
    expect(s).toMatchObject({ targeted: 1, met: 1, adherence: 1 });
  });

  it('ein gebrochener Tag reißt die Serie, der Rekord bleibt; heute offen bricht nichts', () => {
    heute('2026-10-11');
    const m = matrixAus('rule.x', {
      '2026-10-07': zelle(1, 'soll'),
      '2026-10-08': zelle(1, 'soll'),
      '2026-10-09': zelle(0, 'unter'),
      '2026-10-10': zelle(1, 'soll'),
      '2026-10-11': zelle(null, 'ungemessen'),
    });
    const s = AnalyticsService.summarize(m, 'rule.x', '2026-10-07', '2026-10-11');
    expect(s).toMatchObject({ streak: 1, bestStreak: 2, met: 3, measured: 4 });
  });

  it('ein vergessener Tag (kein Eintrag) reißt die Serie ebenfalls', () => {
    const m = matrixAus('rule.x', {
      '2026-10-07': zelle(1, 'soll'),
      '2026-10-08': zelle(null, 'ungemessen'),
      '2026-10-09': zelle(1, 'soll'),
    });
    const s = AnalyticsService.summarize(m, 'rule.x', '2026-10-07', '2026-10-09');
    expect(s).toMatchObject({ streak: 1, bestStreak: 1 });
  });

  it('die Serie läuft über den Phasenschnitt, die Quote beginnt neu', () => {
    heute('2026-10-07');
    // Fr 02. verfehlt, Sa 03. + Mo 05. + Di 06. erfüllt, So 04. frei, Mi 07. (Phase 2) noch offen.
    const m = matrixAus('training.sessions', {
      '2026-10-02': zelle(0, 'unter'),
      '2026-10-03': zelle(1, 'soll'),
      '2026-10-04': zelle(null, 'offday'),
      '2026-10-05': zelle(1, 'soll'),
      '2026-10-06': zelle(1, 'soll'),
      '2026-10-07': zelle(null, 'ungemessen'),
    });
    const s = AnalyticsService.summarize(m, 'training.sessions', '2026-10-07', '2026-10-07', {
      streakFrom: '2026-10-01',
    });
    expect(s).toMatchObject({ streak: 3, bestStreak: 3, tracked: 0, adherence: null });
  });

  it('heute abgewählt bricht die Serie nicht — bei Ursachen läuft der Tag noch', () => {
    heute('2026-10-07');
    const m = matrixAus('training.sessions', {
      '2026-10-05': zelle(1, 'soll'),
      '2026-10-06': zelle(1, 'soll'),
      '2026-10-07': zelle(0, 'unter'), // Haken gesetzt und wieder entfernt
    });
    const s = AnalyticsService.summarize(m, 'training.sessions', '2026-10-05', '2026-10-07');
    expect(s).toMatchObject({ streak: 2, tracked: 2, adherence: 1 });
  });

  it('bei Regeln steht ein Rückfall sofort fest, auch heute', () => {
    heute('2026-10-07');
    const m = matrixAus('rule.x', {
      '2026-10-06': zelle(1, 'soll'),
      '2026-10-07': zelle(0, 'unter'),
    });
    const s = AnalyticsService.summarize(m, 'rule.x', '2026-10-06', '2026-10-07', { missIsFinal: true });
    expect(s).toMatchObject({ streak: 0, tracked: 2, met: 1 });
  });

  it('das letzte Datum einer vergangenen Woche ist nicht „heute"', () => {
    heute('2026-10-20');
    const m = matrixAus('training.sessions', {
      '2026-10-12': zelle(1, 'soll'),
      '2026-10-13': zelle(null, 'ungemessen'),
    });
    const s = AnalyticsService.summarize(m, 'training.sessions', '2026-10-12', '2026-10-13');
    expect(s).toMatchObject({ tracked: 2, targeted: 2, adherence: 0.5, streak: 0 });
  });
});
