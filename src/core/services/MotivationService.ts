import { AnalyticsService, type DayMetric, type MetricMatrix } from './AnalyticsService';
import type { Ausblick, SerienStand } from '@/lib/motivation';

/**
 * Motivation aus echten Daten: Serien, Stufen, Ringe, perfekte Tage,
 * Rekordwand, Rückblick, Erinnerung. Die Regeln (Stufen, wann gefeiert wird)
 * stehen in `src/lib/motivation.ts`; hier wird mit `summarize` gerechnet.
 */

export interface AusblickOptionen {
  /** Ab wann Serie und Rekord zählen (über den Phasenschnitt). */
  serieAb: string;
  /** Regeln: ein Verfehlen steht sofort fest. */
  regel: boolean;
}

/** Die Zelle eines Tages, so als wäre er erfüllt bzw. nicht. */
function zelleWenn(c: DayMetric | undefined, erfuellt: boolean, regel: boolean): DayMetric {
  const basis: DayMetric = c ?? { value: null, base: 1, stretch: null, state: 'ungemessen', source: null };
  if (basis.state === 'offday') return basis; // an einem Off-Day ändert ein Haken nichts
  if (erfuellt) {
    return { ...basis, value: basis.stretch ?? basis.base ?? 1, state: 'soll' };
  }
  // Ursache abgewählt = offen (nicht gemessen); Regel gebrochen = Rückfall.
  return regel ? { ...basis, value: 0, state: 'unter' } : { ...basis, value: null, state: 'ungemessen' };
}

function stand(matrix: MetricMatrix, key: string, von: string, bis: string, o: AusblickOptionen): SerienStand {
  const s = AnalyticsService.summarize(matrix, key, von, bis, { streakFrom: o.serieAb, missIsFinal: o.regel });
  return { serie: s.streak, rekord: s.bestStreak, start: s.streakStart };
}

/**
 * Serie und Rekord heute — und für beide Fälle, falls sich der heutige Haken
 * ändert. Gerechnet auf einer Kopie der Matrix, in der nur die heutige Zelle
 * ersetzt ist; alle anderen Tage bleiben, wie sie sind.
 */
export function ausblick(matrix: MetricMatrix, key: string, heute: string, o: AusblickOptionen): Ausblick {
  const mit = (c: DayMetric): MetricMatrix => ({ ...matrix, [heute]: { ...(matrix[heute] ?? {}), [key]: c } });
  const jetzt = matrix[heute]?.[key];
  return {
    ...stand(matrix, key, o.serieAb, heute, o),
    wennErfuellt: stand(mit(zelleWenn(jetzt, true, o.regel)), key, o.serieAb, heute, o),
    wennNicht: stand(mit(zelleWenn(jetzt, false, o.regel)), key, o.serieAb, heute, o),
  };
}
