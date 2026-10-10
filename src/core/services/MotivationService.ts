import { AnalyticsService, type DayMetric, type MetricMatrix } from './AnalyticsService';
import {
  istJokerTag, istPerfekt, ROUTINE_KEYS, URSACHEN_KEYS,
  type Ausblick, type SerienStand, type TagesStand,
} from '@/lib/motivation';
import { dateRange } from '@/lib/blocks';
import { getBerlinDateStr } from '@/lib/dateUtils';

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

const erfuellt = (c: DayMetric | undefined) => c?.state === 'soll' || c?.state === 'basis';
/** Galt an dem Tag ein Ziel? Ein Ziel, das sich nicht auflösen ließ, gilt trotzdem (`zielfehlt`). */
const zielGalt = (c: DayMetric | undefined) =>
  !!c && c.state !== 'offday' && (c.base !== null || !!c.targetHint);

/** Ein Tag aus der Matrix, reduziert auf das, was Ringe und „perfekter Tag" brauchen. */
export function tagAusMatrix(matrix: MetricMatrix, tag: string, regelKeys: string[]): TagesStand {
  const z = matrix[tag] ?? {};
  return {
    ursachen: URSACHEN_KEYS.map(k => ({ erfuellt: erfuellt(z[k]), zaehlt: zielGalt(z[k]) })),
    routinen: ROUTINE_KEYS.map(k => ({
      erledigt: z[k]?.value ?? 0,
      gesamt: z[k]?.stretch ?? 0,
      basis: z[k]?.base ?? null,
      zaehlt: zielGalt(z[k]),
    })),
    regeln: regelKeys.filter(k => z[k] && z[k].base !== null).map(k => ({ gebrochen: z[k].state === 'unter' })),
  };
}

export interface PerfekteTage {
  /** Perfekte Tage im Zeitraum. */
  anzahl: number;
  /** Laufende Serie perfekter Tage (Sonntag Joker, heute offen bis perfekt). */
  serie: number;
  rekord: number;
  heutePerfekt: boolean;
}

/**
 * Perfekte Tage von `von` bis `heute`. `heuteAls` setzt den heutigen Tag
 * fest (perfekt oder nicht), damit der Browser beide Fälle vom Server
 * bekommt und nichts selbst zählt.
 */
export function perfekteTage(
  matrix: MetricMatrix, regelKeys: string[], von: string, heute: string = getBerlinDateStr(), heuteAls?: boolean
): PerfekteTage {
  let anzahl = 0, lauf = 0, rekord = 0, heutePerfekt = false;
  for (const tag of dateRange(von, heute)) {
    const t = tagAusMatrix(matrix, tag, regelKeys);
    const perfekt = tag === heute && heuteAls !== undefined ? heuteAls : istPerfekt(t);
    if (tag === heute) heutePerfekt = perfekt;
    if (perfekt) {
      anzahl++;
      lauf++;
      rekord = Math.max(rekord, lauf);
    } else if (istJokerTag(t) || tag === heute) {
      continue; // Sonntag rettet die Serie; heute ist offen, bis er perfekt ist
    } else {
      lauf = 0;
    }
  }
  return { anzahl, serie: lauf, rekord, heutePerfekt };
}
