/**
 * Phasen des Plans — ein Schnitt in der *Bewertung*, nicht in den Daten.
 *
 * Mit Phase 2 hat sich geändert, was Jarvis jeden Tag bewertet (Regeln statt
 * Körperwerte, Routinen mit 6 statt 8–9 Schritten). Die Daten davor bleiben
 * vollständig lesbar; sie wurden nur nach anderen Maßstäben erhoben. Wer
 * Wochen vergleicht — Dashboard wie ChatGPT —, muss wissen, auf welcher Seite
 * des Schnitts eine Woche liegt, sonst sieht ein Systemwechsel wie ein
 * Leistungsabfall aus (oder umgekehrt).
 *
 * Die Ziele selbst stehen weiterhin historisiert in `core_intentions`
 * (`valid_from`/`valid_to`); diese Liste beschreibt den Schnitt nur in Worten.
 */
import { BLOCK_START, addDays } from './blocks';
import { getBerlinDateStr } from './dateUtils';

export interface Phase {
  nummer: number;
  name: string;
  /** Erster Tag, inklusive. */
  von: string;
  /** Letzter Tag, inklusive. `null` = läuft. */
  bis: string | null;
  /** Was in dieser Phase bewertet wurde — vorlesbar, für Mensch und Modell. */
  bewertet: string;
  /** Was man beim Lesen der Daten dieser Phase wissen muss. */
  hinweis: string;
}

export const PHASE_2_START = '2026-10-07';

export const PHASES: Phase[] = [
  {
    nummer: 1,
    name: 'Aufbau',
    von: BLOCK_START,
    bis: addDays(PHASE_2_START, -1),
    bewertet:
      'Ursachen (Calls, Training, Post), Morgen- und Abendroutine, Körperwerte mit Ziel ' +
      '(Schlaf, Kalorien, Gewicht).',
    hinweis:
      'Tracking war noch nicht konsequent — viele Tage sind „nicht gemessen", nicht „verfehlt". ' +
      'Die Routinen hatten zeitweise 8–9 Schritte; die Haken der später gestrichenen Schritte sind ' +
      'gelöscht, die Tage werden deshalb gegen die heutigen 6 Schritte bewertet. Regeln gab es noch nicht.',
  },
  {
    nummer: 2,
    name: 'Regeln statt Körperwerte',
    von: PHASE_2_START,
    bis: null,
    bewertet:
      'Ursachen (Calls, Training, Post), Morgen- und Abendroutine mit 6 Schritten, drei Tagesregeln ' +
      '(No Jerking, keine Drogen — Alkohol und Cannabis —, kein Scrolling) an allen 7 Tagen.',
    hinweis:
      'Schlaf, Kalorien und Gewicht werden nicht mehr bewertet. Was Apple Health noch liefert, steht ' +
      'als „erfasst" ohne Ziel da. Regeln gelten als gehalten, solange kein Rückfall eingetragen ' +
      'ist — nur Rückfälle werden festgehalten.',
  },
];

export function phaseOf(date: string): Phase | null {
  return PHASES.find(p => date >= p.von && (p.bis === null || date <= p.bis)) ?? null;
}

export function currentPhase(today: string = getBerlinDateStr()): Phase | null {
  return phaseOf(today);
}

/**
 * Auswertungen (Adherence, Streak) beginnen am Anfang der laufenden Phase —
 * nie früher als `from`. Ein Systemwechsel soll nicht in die Quote der neuen
 * Phase hineinrechnen.
 */
export function evaluationStart(from: string, today: string = getBerlinDateStr()): string {
  const phase = currentPhase(today);
  return phase && phase.von > from ? phase.von : from;
}
