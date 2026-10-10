import { AnalyticsService, type DayMetric, type MetricMatrix } from './AnalyticsService';
import {
  GOLD_AB, istJokerTag, istPerfekt, MEILENSTEINE, ROUTINE_KEYS, stufe, URSACHEN_KEYS,
  type Ausblick, type SerienStand, type TagesStand,
} from '@/lib/motivation';
import { addDays, BLOCK_START, BLOCK_WEEKS, blockWeekRange, dateRange, daysBetween, isJokerDay } from '@/lib/blocks';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { PHASES, PHASE_2_START } from '@/lib/phases';
import { GoalService } from './GoalService';

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

// ── Zielbild (Ziele-Seite) ───────────────────────────────────────────────────

/** Zustand eines Tages in einer Kette — für die Heatmap. */
export type KettenZustand = 'erfuellt' | 'verfehlt' | 'offen' | 'leer' | 'frei' | 'vor';

export interface Kette {
  key: string;
  label: string;
  regel: boolean;
  tage: Array<{ datum: string; zustand: KettenZustand; joker: boolean }>;
  serie: number;
  rekord: number;
}

const KETTEN_ZUSTAND = (c: DayMetric | undefined, tag: string, heute: string): KettenZustand => {
  if (!c || (c.base === null && !c.targetHint)) return 'vor'; // ohne Ziel: gab es noch nicht — auch sonntags
  if (c.state === 'offday') return 'frei';
  if (erfuellt(c)) return 'erfuellt';
  if (tag === heute) return 'offen';
  return c.state === 'unter' ? 'verfehlt' : 'leer';
};

/** Eine Kette je Ursache und Regel, Tag für Tag ab Planbeginn — mit Serie und Rekord wie überall. */
export function ketten(
  matrix: MetricMatrix, metriken: Array<{ key: string; label: string; regel: boolean }>, heute: string
): Kette[] {
  return metriken.map(m => {
    const s = AnalyticsService.summarize(matrix, m.key, BLOCK_START, heute, { missIsFinal: m.regel });
    return {
      ...m,
      tage: dateRange(BLOCK_START, heute).map(datum => ({
        datum,
        zustand: KETTEN_ZUSTAND(matrix[datum]?.[m.key], datum, heute),
        joker: isJokerDay(datum),
      })),
      serie: s.streak,
      rekord: s.bestStreak,
    };
  });
}

/** Ab dieser Abdeckung zählt eine Woche für die Rekordwand. */
export const BESTE_WOCHE_ABDECKUNG = 0.7;

/**
 * Beste abgeschlossene Blockwoche: höchste Quote über Ursachen und Routinen
 * (erfüllte / Tage mit Ziel), aber nur Wochen, in denen Training, Post und
 * Routinen zu mindestens 70 % eingetragen sind — sonst gewinnt eine Woche,
 * in der kaum etwas gemessen wurde. Calls zählen in die Quote, nicht in die
 * Abdeckung (das CRM ist nie leer).
 */
export function besteWoche(matrix: MetricMatrix, heute: string) {
  const [laufendVon] = blockWeekRange(heute);
  let beste: { von: string; bis: string; quote: number; abdeckung: number } | null = null;
  for (let von = BLOCK_START; addDays(von, 6) < laufendVon; von = addDays(von, 7)) {
    const bis = addDays(von, 6);
    let erfuelltSumme = 0, mitZiel = 0, gemessen = 0, getrackt = 0;
    for (const key of [...URSACHEN_KEYS, ...ROUTINE_KEYS]) {
      const s = AnalyticsService.summarize(matrix, key, von, bis);
      erfuelltSumme += s.met;
      mitZiel += s.targeted;
      if (key !== 'sales.calls_count') {
        gemessen += s.measured;
        getrackt += s.tracked;
      }
    }
    if (!mitZiel || !getrackt) continue;
    const quote = erfuelltSumme / mitZiel;
    const abdeckung = gemessen / getrackt;
    if (abdeckung < BESTE_WOCHE_ABDECKUNG) continue;
    if (!beste || quote > beste.quote) beste = { von, bis, quote, abdeckung };
  }
  return beste;
}

/** Die zwölf-Wochen-Blöcke von Planbeginn bis zum Stichtag — der letzte am Stichtag abgeschnitten. */
export function bloeckeBis(ende: string) {
  const bloecke: Array<{ nummer: number; von: string; bis: string }> = [];
  for (let n = 1, von = BLOCK_START; von <= ende; n++, von = addDays(von, BLOCK_WEEKS * 7)) {
    const bis = addDays(von, BLOCK_WEEKS * 7 - 1);
    bloecke.push({ nummer: n, von, bis: bis < ende ? bis : ende });
  }
  return bloecke;
}

/**
 * Alles für die Ziele-Seite: die Reise (Planbeginn bis Stichtag des
 * Umsatzziels), das Ergebnisziel, die Ketten und die Rekordwand. Kein Wert
 * wird erfunden: ohne Stichtag keine Restzeit, ohne Abschlusswert kein Prozent.
 */
export async function zielbild(heute: string = getBerlinDateStr()) {
  const definitionen = (await AnalyticsService.getDefinitions()).filter(d => d.isActive);
  const umsatzZiel = await GoalService.getRevenueGoal();
  const matrix = await AnalyticsService.getMatrix(BLOCK_START, heute);

  const label = (key: string) => definitionen.find(d => d.key === key)?.label ?? key;
  const regeln = definitionen.filter(d => d.domain === 'rules');
  const regelKeys = regeln.map(r => r.key);

  // Reise
  const ende = umsatzZiel.until;
  const reise = {
    start: BLOCK_START,
    ende,
    heute,
    tageVorbei: daysBetween(BLOCK_START, heute) + 1,
    tageGesamt: ende ? daysBetween(BLOCK_START, ende) + 1 : null,
    /** Bis einschließlich Stichtag, heute mitgezählt. */
    tageUebrig: ende ? Math.max(0, daysBetween(heute, ende) + 1) : null,
    bloecke: ende ? bloeckeBis(ende) : [],
    phasen: PHASES.map(p => ({ nummer: p.nummer, name: p.name, von: p.von, bis: p.bis })),
  };

  // Ergebnisziel: Summe der erwarteten Provision seit Planbeginn — `null`, solange kein einziger Wert da ist.
  const werte = dateRange(BLOCK_START, heute)
    .map(d => matrix[d]?.['sales.closed_value_eur']?.value)
    .filter((v): v is number => v !== null && v !== undefined);
  const umsatz = {
    betrag: werte.length ? werte.reduce((a, b) => a + b, 0) : null,
    ziel: umsatzZiel.amount,
    bis: umsatzZiel.until,
  };

  const kettenListe = ketten(matrix, [
    ...URSACHEN_KEYS.map(key => ({ key, label: label(key), regel: false })),
    ...regeln.map(r => ({ key: r.key, label: r.label, regel: true })),
  ], heute);

  // Rekordwand: längste Serien (Ursachen, Routinen, Regeln), erreichte Stufen.
  const serien = [
    ...kettenListe.map(k => ({ key: k.key, label: k.label, rekord: k.rekord, serie: k.serie })),
    ...ROUTINE_KEYS.map(key => {
      const s = AnalyticsService.summarize(matrix, key, BLOCK_START, heute);
      return { key, label: label(key), rekord: s.bestStreak, serie: s.streak };
    }),
  ].map(x => ({
    ...x,
    stufe: stufe(x.rekord),
    gold: x.rekord >= GOLD_AB,
    meilensteine: MEILENSTEINE.filter(m => x.rekord >= m),
  }));

  const perfekt = perfekteTage(matrix, regelKeys, PHASE_2_START > BLOCK_START ? PHASE_2_START : BLOCK_START, heute);

  return {
    reise,
    umsatz,
    ketten: kettenListe,
    rekorde: { serien, perfekt, besteWoche: besteWoche(matrix, heute) },
  };
}

export type Zielbild = Awaited<ReturnType<typeof zielbild>>;
