import { AnalyticsService, type DayMetric, type MetricMatrix } from './AnalyticsService';
import { isOffDay, kalenderWoche } from '@/lib/blocks';
import { getBerlinDateStr } from '@/lib/dateUtils';

/**
 * Der Tag und die laufende Woche (Mo–So) — so, wie „Heute" und die
 * iPhone-Widgets sie zeigen. Rechnet nur auf der Matrix; Wochenziele sind
 * nicht gespeichert, sondern Tagesziel × Arbeitstage (Spec: Konfiguration,
 * keine Konstante).
 */

/** Zustand einer Zelle im Jarvis-Blocksystem. */
export type Zelle = 'soll' | 'basis' | 'unter' | 'leer' | 'offen' | 'frei' | 'kommt';

export const CALLS = 'sales.calls_count';
export const CALL_SPLIT = [
  { key: 'sales.calls_cold_gross', name: 'Cold Groß' },
  { key: 'sales.calls_cold_tarif', name: 'Cold Tarif' },
  { key: 'sales.calls_followup', name: 'Nachfass' },
] as const;

const URSACHEN = [
  { key: 'training.sessions', name: 'Training' },
  { key: 'content.posts', name: 'Post' },
] as const;
const ROUTINEN = [
  { key: 'routine.morning', name: 'Morgen' },
  { key: 'routine.evening', name: 'Abend' },
] as const;

const erfuellt = (c: DayMetric | undefined) => c?.state === 'soll' || c?.state === 'basis';

/**
 * Eine Zelle: Zukunft „kommt" (sonntags „frei"), Off-Day „frei", erfüllt
 * „soll"/„basis", heute noch nicht erfüllt „offen" — ein Tag, der läuft, ist
 * nie rot —, ohne Eintrag „leer", sonst „unter".
 */
export function zelle(c: DayMetric | undefined, tag: string, heute: string, giltSonntags = false): Zelle {
  if (tag > heute) return !giltSonntags && isOffDay(tag) ? 'frei' : 'kommt';
  if (!c || c.state === 'offday') return 'frei';
  if (c.state === 'soll' || c.state === 'basis') return c.state;
  if (tag === heute) return 'offen';
  if (c.value === null) return 'leer';
  return 'unter';
}

/** Arbeitstage (Mo–Sa) von heute bis Samstag, heute mitgezählt. */
export function arbeitstageUebrig(heute: string, tage: string[]): number {
  return tage.filter(t => t >= heute && !isOffDay(t)).length;
}

export interface WochenZeile {
  key: string;
  name: string;
  zellen: Zelle[];
  /** Ist der Woche: Summe (Calls) bzw. erfüllte Tage. */
  ist: number;
  /** Basis-Wochenziel; `null` ohne Ziel. */
  ziel: number | null;
}

export async function heuteUndWoche(heute: string = getBerlinDateStr()) {
  const definitionen = (await AnalyticsService.getDefinitions()).filter(d => d.isActive);
  const regeln = definitionen.filter(d => d.domain === 'rules');
  const woche = kalenderWoche(heute);
  const keys = [CALLS, ...CALL_SPLIT.map(s => s.key), ...URSACHEN.map(u => u.key), ...ROUTINEN.map(r => r.key), ...regeln.map(r => r.key)];
  const matrix: MetricMatrix = await AnalyticsService.getMatrix(woche.von, heute, keys);
  const c = (key: string, tag: string = heute) => matrix[tag]?.[key];
  const arbeitstage = woche.tage.filter(t => !isOffDay(t)).length;
  const uebrig = arbeitstageUebrig(heute, woche.tage);

  const summe = (key: string) => woche.tage.filter(t => t <= heute).reduce((s, t) => s + (c(key, t)?.value ?? 0), 0);
  const wochenziel = (key: string, feld: 'base' | 'stretch') => {
    const tagesziel = c(key)?.[feld] ?? null;
    return tagesziel === null ? null : tagesziel * arbeitstage;
  };
  const zellen = (key: string, sonntags = false) => woche.tage.map(t => zelle(c(key, t), t, heute, sonntags));
  const erfuellteTage = (key: string) => woche.tage.filter(t => t <= heute && erfuellt(c(key, t))).length;

  // Regeln als eine Zeile: ein Rückfall an dem Tag färbt den Tag.
  const regelZellen: Zelle[] = woche.tage.map(t => {
    if (t > heute) return 'kommt';
    const zustaende = regeln.map(r => c(r.key, t));
    if (zustaende.every(z => !z || z.base === null)) return 'frei';
    return zustaende.some(z => z?.state === 'unter') ? 'unter' : 'soll';
  });
  const rueckfaelleWoche = regeln.reduce((s, r) => s + woche.tage.filter(t => t <= heute && c(r.key, t)?.state === 'unter').length, 0);

  // ── Heute: eine Kachel je Commitment ──
  const calls = c(CALLS);
  const kacheln = [
    {
      key: CALLS, name: 'Calls', wert: calls?.value ?? null, basis: calls?.base ?? null, soll: calls?.stretch ?? null,
      zustand: zelle(calls, heute, heute),
    },
    ...URSACHEN.map(u => ({ key: u.key, name: u.name, wert: c(u.key)?.value ?? null, basis: null, soll: null, zustand: zelle(c(u.key), heute, heute) })),
    ...ROUTINEN.map(r => ({
      key: r.key, name: r.name, wert: c(r.key)?.value ?? 0, basis: c(r.key)?.base ?? null, soll: c(r.key)?.stretch ?? null,
      zustand: zelle(c(r.key), heute, heute),
    })),
    {
      key: 'regeln', name: 'Regeln', wert: regeln.filter(r => c(r.key)?.state !== 'unter').length, basis: null, soll: regeln.length,
      // Regeln sind gehalten, bis ein Rückfall eingetragen ist — heute also „soll" oder „unter".
      zustand: regelZellen[woche.tage.indexOf(heute)] === 'unter' ? 'unter' as Zelle : 'soll' as Zelle,
    },
  ];
  const zaehlen = kacheln.filter(k => k.zustand !== 'frei');
  const erledigt = zaehlen.filter(k => k.zustand === 'soll' || k.zustand === 'basis').length;

  const callsIst = summe(CALLS);
  const callsBasis = wochenziel(CALLS, 'base');

  const zeilen: WochenZeile[] = [
    { key: CALLS, name: 'Calls', zellen: zellen(CALLS), ist: callsIst, ziel: callsBasis },
    ...URSACHEN.map(u => ({ key: u.key, name: u.name, zellen: zellen(u.key), ist: erfuellteTage(u.key), ziel: arbeitstage })),
    ...ROUTINEN.map(r => ({ key: r.key, name: r.name, zellen: zellen(r.key), ist: erfuellteTage(r.key), ziel: arbeitstage })),
    { key: 'regeln', name: 'Regeln', zellen: regelZellen, ist: rueckfaelleWoche, ziel: null },
  ];

  return {
    datum: heute,
    heute: { erledigt, gesamt: zaehlen.length, kacheln },
    woche: {
      von: woche.von,
      bis: woche.bis,
      tage: woche.tage,
      tageUebrig: uebrig,
      zeilen,
      calls: {
        ist: callsIst,
        basis: callsBasis,
        soll: wochenziel(CALLS, 'stretch'),
        /** Was pro verbleibendem Arbeitstag bis zur Basis fehlt; 0 = Basis erreicht. */
        proTag: callsBasis !== null && uebrig > 0 ? Math.max(0, Math.ceil((callsBasis - callsIst) / uebrig)) : null,
        split: CALL_SPLIT.map(s => ({ key: s.key, name: s.name, ist: summe(s.key), basis: wochenziel(s.key, 'base'), soll: wochenziel(s.key, 'stretch') })),
      },
      rueckfaelle: rueckfaelleWoche,
    },
  };
}

export type HeuteUndWoche = Awaited<ReturnType<typeof heuteUndWoche>>;
