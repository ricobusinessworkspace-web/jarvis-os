// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DayMetric } from './AnalyticsService';
import { arbeitstageUebrig, zelle } from './WochenService';
import { kalenderWoche } from '@/lib/blocks';

const c = (value: number | null, state: DayMetric['state']): DayMetric => ({ value, base: 1, stretch: null, state, source: null });

describe('Wochenzyklus', () => {
  it('die Woche läuft Mo–So', () => {
    expect(kalenderWoche('2026-10-14')).toMatchObject({ von: '2026-10-12', bis: '2026-10-18' });
    expect(kalenderWoche('2026-10-18')).toMatchObject({ von: '2026-10-12', bis: '2026-10-18' });
    expect(kalenderWoche('2026-10-19').von).toBe('2026-10-19');
  });

  it('Arbeitstage übrig zählen heute mit, Sonntag nicht', () => {
    const { tage } = kalenderWoche('2026-10-14');
    expect(arbeitstageUebrig('2026-10-14', tage)).toBe(4); // Mi–Sa
    expect(arbeitstageUebrig('2026-10-17', tage)).toBe(1);
    expect(arbeitstageUebrig('2026-10-18', tage)).toBe(0);
  });

  it('ein laufender Tag ist offen, nie rot; vergangene Tage zeigen, was war', () => {
    const heute = '2026-10-14';
    expect(zelle(c(0, 'unter'), heute, heute)).toBe('offen');
    expect(zelle(c(1, 'soll'), heute, heute)).toBe('soll');
    expect(zelle(c(0, 'unter'), '2026-10-13', heute)).toBe('unter'); // 0 Calls bleibt 0, nicht leer
    expect(zelle(c(null, 'ungemessen'), '2026-10-13', heute)).toBe('leer');
    expect(zelle(c(null, 'offday'), '2026-10-11', heute)).toBe('frei');
    expect(zelle(undefined, '2026-10-16', heute)).toBe('kommt');
    expect(zelle(undefined, '2026-10-18', heute)).toBe('frei'); // Sonntag
    expect(zelle(undefined, '2026-10-18', heute, true)).toBe('kommt'); // Regeln gelten sonntags
  });
});
