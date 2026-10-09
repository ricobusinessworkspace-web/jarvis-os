/**
 * Motivation ohne Erfindung — die Regeln, ohne Datenbank, für Server und Browser.
 *
 * Gerechnet wird im `MotivationService` auf der Matrix aus
 * `AnalyticsService.getMatrix` und mit derselben `summarize` wie Dashboard,
 * Health und ChatGPT. Keine Serie, kein Rekord, kein Abzeichen entsteht
 * woanders. Was der Browser optimistisch zeigt, hat der Server vorher für
 * beide Fälle ausgerechnet (`Ausblick`) — der Browser wählt nur aus.
 */

/** Stufen einer Serie in Tagen. Ab `GOLD_AB` wird sie in Gold gezeigt. */
export const MEILENSTEINE = [3, 7, 14, 21, 30, 50, 100] as const;
export const GOLD_AB = 7;
/** Ab dieser Länge ist ein neuer Rekord eine Feier wert — ein erster Tag ist keiner. */
export const REKORD_AB = 2;

/** Höchste erreichte Stufe, 0 = noch keine. */
export function stufe(serie: number): number {
  let s = 0;
  for (const m of MEILENSTEINE) if (serie >= m) s = m;
  return s;
}

/** Nächste Stufe über der Serie, `null` wenn alle erreicht. */
export function naechsteStufe(serie: number): number | null {
  return MEILENSTEINE.find(m => m > serie) ?? null;
}

/** Ist genau diese Serie eine Stufe? Dann wird sie (einmal je Lauf) gefeiert. */
export const istMeilenstein = (serie: number) => (MEILENSTEINE as readonly number[]).includes(serie);

export interface SerienStand {
  serie: number;
  rekord: number;
  /** Erster Tag des laufenden Laufs — Schlüssel für „schon gefeiert". */
  start: string | null;
}

export interface Ausblick extends SerienStand {
  /** Stand, wenn der Tag erfüllt ist — Ursache erledigt, Regel gehalten. */
  wennErfuellt: SerienStand;
  /** Stand, wenn nicht — Ursache offen bzw. Regel gebrochen. */
  wennNicht: SerienStand;
}

/**
 * Was eine Änderung auslöst: ein neuer Rekord (nur durch eine Handlung, ab
 * `REKORD_AB`) und/oder eine erreichte Stufe. Beides aus den Zahlen des
 * Servers, nicht im Browser gerechnet.
 */
export function feierFuer(vorher: SerienStand, nachher: SerienStand, handlung: boolean) {
  if (!handlung) return { rekord: false, stufe: null as number | null };
  return {
    rekord: nachher.rekord > vorher.rekord && nachher.rekord >= REKORD_AB,
    stufe: nachher.serie > vorher.serie && istMeilenstein(nachher.serie) ? nachher.serie : null,
  };
}
