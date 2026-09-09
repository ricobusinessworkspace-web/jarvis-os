import type { DayMetric, MetricState } from '@/core/services/AnalyticsService';

/**
 * Eine Kodierung der Zustände für alle Ansichten. Farbe steht nie allein:
 * jeder Zustand trägt zusätzlich Form (Füllung, gestrichelter Rand) und Text,
 * damit „nicht gemessen" und „null erreicht" nie verwechselt werden können.
 *
 * Palette bewusst monochrom (Apple-minimal): Erfüllungsgrad ist eine
 * Helligkeitsrampe auf `foreground`. Die einzige Farbe im System ist Rot für
 * „unter Basis" — ein verpasster Tag ist das Einzige, das die Aufmerksamkeit
 * wirklich braucht.
 */

export const STATE_LABEL: Record<MetricState, string> = {
  soll: 'Soll erreicht',
  basis: 'Basis erreicht',
  unter: 'unter Basis',
  erfasst: 'erfasst',
  zielfehlt: 'Ziel fehlt',
  ungemessen: 'nicht gemessen',
  offday: 'Off-Day',
};

/**
 * Zellen in Aktivitäts- und Kalenderansichten.
 *
 * `zielfehlt` trägt als einziger Zustand einen gestrichelten Rand um eine
 * Füllung: der Wert ist da (Füllung), das Maß fehlt (offener Rand). Ohne diese
 * Form wäre er von `erfasst` nicht zu unterscheiden — und genau das ist der
 * Unterschied zwischen „bewusst ohne Ziel" und „Anschluss kaputt". Bewusst
 * keine eigene Farbe: Rot bleibt für „verfehlt" reserviert, sonst hieße ein
 * kaputter Anschluss dasselbe wie ein schlechter Tag.
 */
export const STATE_CELL: Record<MetricState, string> = {
  soll: 'bg-foreground',
  basis: 'bg-foreground/40',
  unter: 'bg-error/70',
  erfasst: 'bg-foreground/[0.16]',
  zielfehlt: 'bg-foreground/[0.16] border border-dashed border-foreground/50',
  ungemessen: 'bg-transparent ring-1 ring-inset ring-white/15',
  offday: 'bg-white/[0.03]',
};

/** Akzentfarbe für Zahlen und Balken. */
export const STATE_TEXT: Record<MetricState, string> = {
  soll: 'text-foreground',
  basis: 'text-foreground',
  unter: 'text-error',
  erfasst: 'text-foreground',
  zielfehlt: 'text-foreground',
  ungemessen: 'text-muted',
  offday: 'text-muted',
};

export const STATE_BAR: Record<MetricState, string> = {
  soll: 'bg-foreground',
  basis: 'bg-foreground/40',
  unter: 'bg-error/70',
  erfasst: 'bg-foreground/25',
  zielfehlt: 'bg-foreground/25',
  ungemessen: 'bg-white/10',
  offday: 'bg-white/5',
};

/** Woher der Wert kam — „auto aus CRM" ist etwas anderes als ein Haken von Hand. */
export const SOURCE_LABEL: Record<string, string> = {
  crm_calls: 'CRM',
  tracker: 'manuell',
  personal_log: 'Tagebuch',
  weight: 'Waage',
  health: 'Health',
  reminders: 'Erinnerungen',
  gproject: 'G-Projekt',
  manual: 'von Hand',
};

export function formatValue(value: number | null, unit: string): string {
  if (value === null) return '–';
  if (unit === 'hours') return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
  if (unit === 'kg') return value.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return value.toLocaleString('de-DE');
}

export function formatPercent(v: number | null): string {
  return v === null ? '–' : `${Math.round(v * 100)} %`;
}

/** Platzhalter für eine Metrik, die es in der Matrix (noch) nicht gibt. */
export const EMPTY_METRIC: DayMetric = {
  value: null, base: null, stretch: null, state: 'ungemessen', source: null,
};

/**
 * Die Zeile unter einem Metriknamen: woran der Wert gemessen wird.
 *
 * Bewusst aus der Matrix abgeleitet statt im Code geschrieben — „Basis 30 ·
 * Soll 60" stand vorher zweimal als Text in den Seiten und wäre beim nächsten
 * Ziel-Wechsel im CRM still falsch geworden.
 */
export function targetSub(m: DayMetric | undefined, unit = 'count'): string {
  if (!m) return '';
  if (m.state === 'zielfehlt') return 'Ziel fehlt';
  if (m.base === null) return 'ohne Zielwert';
  if (m.stretch !== null && m.stretch !== m.base) {
    return `Basis ${formatValue(m.base, unit)} · Soll ${formatValue(m.stretch, unit)}`;
  }
  return `Basis ${formatValue(m.base, unit)}`;
}
