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

// ── Tagesringe und perfekter Tag ─────────────────────────────────────────────

/** Die Ursachen auf „Heute", in dieser Reihenfolge. Calls zählen mit — aus dem CRM. */
export const URSACHEN_KEYS = ['sales.calls_count', 'training.sessions', 'content.posts'] as const;
export const ROUTINE_KEYS = ['routine.morning', 'routine.evening'] as const;

/**
 * Ein Tag, auf das reduziert, was Ringe und „perfekter Tag" brauchen. Entsteht
 * auf dem Server aus der Matrix (`tagAusMatrix`) und im Browser aus dem
 * optimistischen Zustand der Karten — dieselbe Form, dieselben Regeln.
 */
export interface TagesStand {
  /** `zaehlt`: an dem Tag galt ein Ziel (kein Off-Day, nicht „erfasst"). */
  ursachen: Array<{ erfuellt: boolean; zaehlt: boolean }>;
  /** `basis` = so viele Schritte reichen; `null` = Grenze fehlt (nie erfüllt). */
  routinen: Array<{ erledigt: number; gesamt: number; basis: number | null; zaehlt: boolean }>;
  regeln: Array<{ gebrochen: boolean }>;
}

export interface Ring {
  wert: number;
  gesamt: number;
  /** Ring geschlossen: alles erfüllt, und es gab etwas zu erfüllen. */
  zu: boolean;
}

const ring = (wert: number, gesamt: number): Ring => ({ wert, gesamt, zu: gesamt > 0 && wert >= gesamt });

/**
 * Drei Ringe wie bei Apple Activity:
 * Ursachen = erfüllte / Ursachen mit Ziel · Routinen = Schritte / Soll ·
 * Regeln = gehalten / alle.
 */
export function ringe(t: TagesStand): { ursachen: Ring; routinen: Ring; regeln: Ring } {
  const u = t.ursachen.filter(x => x.zaehlt);
  const r = t.routinen.filter(x => x.zaehlt);
  return {
    ursachen: ring(u.filter(x => x.erfuellt).length, u.length),
    routinen: ring(
      r.reduce((s, x) => s + Math.min(x.erledigt, x.gesamt), 0),
      r.reduce((s, x) => s + x.gesamt, 0)
    ),
    regeln: ring(t.regeln.filter(x => !x.gebrochen).length, t.regeln.length),
  };
}

/**
 * Perfekter Tag: alle Ursachen mit Ziel erfüllt, jede Routine mindestens auf
 * Basis, keine Regel gebrochen. Ein Tag ohne Ursache und Routine mit Ziel
 * (Sonntag) ist nie perfekt — er zählt für die Serie perfekter Tage als Joker.
 */
export function istPerfekt(t: TagesStand): boolean {
  const u = t.ursachen.filter(x => x.zaehlt);
  const r = t.routinen.filter(x => x.zaehlt);
  if (u.length + r.length === 0) return false;
  return (
    u.every(x => x.erfuellt) &&
    r.every(x => x.basis !== null && x.erledigt >= x.basis) &&
    t.regeln.every(x => !x.gebrochen)
  );
}

/** Ein Tag ohne Ursache und Routine mit Ziel — weder perfekt noch ein Bruch der Serie. */
export const istJokerTag = (t: TagesStand) =>
  t.ursachen.every(x => !x.zaehlt) && t.routinen.every(x => !x.zaehlt);
