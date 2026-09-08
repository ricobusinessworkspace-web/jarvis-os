import type { MetricState } from '@/core/services/AnalyticsService';

/**
 * Eine Kodierung der Zustände für alle Ansichten. Farbe steht nie allein:
 * jeder Zustand trägt zusätzlich Form (Füllung, gestrichelter Rand) und Text,
 * damit „nicht gemessen" und „null erreicht" nie verwechselt werden können.
 */

export const STATE_LABEL: Record<MetricState, string> = {
  soll: 'Soll erreicht',
  basis: 'Basis erreicht',
  unter: 'unter Basis',
  erfasst: 'erfasst',
  ungemessen: 'nicht gemessen',
  offday: 'Off-Day',
};

/** Zellen in Aktivitäts- und Kalenderansichten. */
export const STATE_CELL: Record<MetricState, string> = {
  soll: 'bg-emerald-400',
  basis: 'bg-emerald-700',
  unter: 'bg-amber-500',
  erfasst: 'bg-sky-500/60',
  ungemessen: 'bg-transparent ring-1 ring-inset ring-white/15',
  offday: 'bg-white/[0.03]',
};

/** Akzentfarbe für Zahlen und Balken. */
export const STATE_TEXT: Record<MetricState, string> = {
  soll: 'text-emerald-400',
  basis: 'text-emerald-400',
  unter: 'text-amber-500',
  erfasst: 'text-foreground',
  ungemessen: 'text-muted',
  offday: 'text-muted',
};

export const STATE_BAR: Record<MetricState, string> = {
  soll: 'bg-emerald-400',
  basis: 'bg-emerald-600',
  unter: 'bg-amber-500',
  erfasst: 'bg-sky-500',
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
