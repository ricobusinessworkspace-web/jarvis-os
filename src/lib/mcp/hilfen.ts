import type { DayMetric } from '@/core/services/AnalyticsService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { STATE_LABEL, SOURCE_LABEL } from '@/lib/metricState';
import { PHASES } from '@/lib/phases';
import { WerkzeugFehler } from './protocol';

/**
 * Bausteine, die alle Jarvis-Werkzeuge teilen: Eingaben prüfen, Datenstand,
 * eine Metrik vorlesbar machen. Rechnen tun weiter die Services.
 */
export const ZEITZONE = 'Europe/Berlin';

// ── Eingaben prüfen ──────────────────────────────────────────────────────────
// Das Schema in `inputSchema` ist eine Bitte an den Client; geprüft wird hier.

export function nurErlaubt(args: Record<string, unknown>, erlaubt: string[]) {
  const fremd = Object.keys(args).filter(k => !erlaubt.includes(k));
  if (fremd.length) throw new WerkzeugFehler(`Unbekannter Parameter: ${fremd.join(', ')}.`);
}

export function ganzzahl(wert: unknown, name: string, min: number, max: number, standard: number): number {
  if (wert === undefined || wert === null) return standard;
  if (typeof wert !== 'number' || !Number.isInteger(wert) || wert < min || wert > max) {
    throw new WerkzeugFehler(`${name} muss eine ganze Zahl von ${min} bis ${max} sein.`);
  }
  return wert;
}

export function zeichenkette(wert: unknown, name: string, max: number): string {
  if (typeof wert !== 'string') throw new WerkzeugFehler(`${name} fehlt oder ist kein Text.`);
  if (wert.length > max) throw new WerkzeugFehler(`${name} ist länger als ${max} Zeichen.`);
  return wert;
}

export const LIMIT_SCHEMA = (beschreibung: string, standard: number, max: number) => ({
  type: 'integer', minimum: 1, maximum: max, default: standard, description: beschreibung,
});

export const NUR_LESEN = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** Wann die Antwort entstand — jede Antwort trägt das. */
export function datenstand() {
  return { erzeugt_um: new Date().toISOString(), zeitzone: ZEITZONE, datum: getBerlinDateStr() };
}

export const ZUSTAND_TEXT = STATE_LABEL;

/** Abgeleitete Ziele sind Fließkomma (3168.0000000000005) — vorgelesen wird gerundet. */
export const rund = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

/** Eine Metrik so, dass sie vorgelesen werden kann, ohne dass etwas erfunden wird. */
export function metrik(key: string, m: DayMetric, def: { label: string; unit: string } | undefined, tagVorbei: boolean) {
  const laeuft = m.state === 'unter' && !tagVorbei;
  return {
    key,
    name: def?.label ?? key,
    einheit: def?.unit ?? null,
    /** `null` = nicht gemessen. Nie als 0 lesen. */
    wert: rund(m.value),
    basis: rund(m.base),
    soll: rund(m.stretch),
    zustand: m.state,
    zustand_text: ZUSTAND_TEXT[m.state],
    /** Wie `zustand`, aber „läuft noch" statt „unter Basis", solange der Tag nicht vorbei ist. */
    urteil: laeuft ? 'laeuft' : m.state,
    urteil_text: laeuft ? 'Tag läuft noch' : ZUSTAND_TEXT[m.state],
    quelle: m.source ? (SOURCE_LABEL[m.source] ?? m.source) : null,
    hinweis: m.targetHint ?? null,
  };
}

/**
 * Die Phasen des Plans. Jede Antwort, die über Tage hinweg vergleicht, trägt
 * sie mit — sonst liest ein Modell einen Systemwechsel (andere Ziele, andere
 * Routine) als Leistungsänderung.
 */
export const phasen = () => PHASES.map(p => ({ ...p }));

/** Ein Kalendertag `YYYY-MM-DD`, der wirklich existiert (kein 31.02.). */
export function datum(wert: unknown, name: string): string {
  if (typeof wert !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) {
    throw new WerkzeugFehler(`${name} muss ein Datum der Form JJJJ-MM-TT sein.`);
  }
  const d = new Date(`${wert}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== wert) {
    throw new WerkzeugFehler(`${name} ist kein gültiges Datum.`);
  }
  return wert;
}

export const WOCHENTAG = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
