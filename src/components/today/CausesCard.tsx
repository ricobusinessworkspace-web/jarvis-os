'use client';

import { useState, useTransition } from 'react';
import { Check, Flame } from 'lucide-react';
import { toggleCause } from '@/actions/today';
import { STATE_TEXT, SOURCE_LABEL, formatPercent } from '@/lib/metricState';
import type { MetricState } from '@/core/services/AnalyticsService';
import { cn } from '@/lib/utils';

export interface CauseRow {
  metricKey: string;
  label: string;
  value: number | null;
  base: number | null;
  stretch: number | null;
  state: MetricState;
  source: string | null;
  streak: number;
  adherence: number | null;
  coverage: number | null;
  /** Nur Metriken mit manueller Quelle lassen sich hier abhaken. */
  toggleable: boolean;
}

/** Kästchen mit drei unterscheidbaren Zuständen — erfüllt, darunter, nicht gemessen. */
function StateBox({ state }: { state: MetricState }) {
  const done = state === 'soll' || state === 'basis';
  return (
    <div
      className={cn(
        'h-5 w-5 shrink-0 rounded-md border-[1.5px] flex items-center justify-center transition-colors',
        done && 'bg-emerald-500 border-emerald-500',
        state === 'unter' && 'border-amber-500 bg-amber-500/15',
        state === 'ungemessen' && 'border-dashed border-white/25',
        state === 'erfasst' && 'border-sky-500/60 bg-sky-500/15',
        state === 'offday' && 'border-white/10 bg-white/[0.03]'
      )}
    >
      {done && <Check className="h-3 w-3 text-black/70" strokeWidth={3.5} />}
    </div>
  );
}

export function CausesCard({ rows, date }: { rows: CauseRow[]; date: string }) {
  const [, startTransition] = useTransition();

  // Der Haken sitzt sofort; der Server bestätigt gleich darauf und rendert neu.
  // Ohne das wartet der Klick auf die Runde zur Datenbank und fühlt sich hängend an.
  const [pendingState, setPendingState] = useState<Record<string, MetricState>>({});
  const stateOf = (row: CauseRow) => pendingState[row.metricKey] ?? row.state;

  const toggle = (row: CauseRow) => {
    if (!row.toggleable) return;
    const current = stateOf(row);
    const done = !(current === 'soll' || current === 'basis');

    setPendingState(prev => ({ ...prev, [row.metricKey]: done ? 'soll' : 'unter' }));

    startTransition(async () => {
      const res = await toggleCause(row.metricKey, date, done);
      // Bei Erfolg gilt wieder der Server-Wert, bei Fehler ebenso — dann springt
      // die Anzeige zurück, statt eine Änderung vorzutäuschen, die nicht ankam.
      if (!res?.success) console.error('[Ursachen]', res?.error);
      setPendingState(prev => {
        const next = { ...prev };
        delete next[row.metricKey];
        return next;
      });
    });
  };

  return (
    <div className="crm-card h-full">
      <div className="crm-header">
        <h3 className="crm-title">Ursachen</h3>
      </div>

      <div className="flex flex-col">
        {rows.map(row => {
          const soll = row.stretch ?? row.base;
          const state = stateOf(row);

          return (
            <div
              key={row.metricKey}
              className="flex items-center gap-3 border-t border-border/40 py-2.5 first:border-t-0 first:pt-0"
            >
              <button
                onClick={() => toggle(row)}
                disabled={!row.toggleable}
                aria-label={`${row.label} abhaken`}
                className={cn(
                  'shrink-0 transition-transform',
                  row.toggleable ? 'cursor-pointer active:scale-90' : 'cursor-default'
                )}
              >
                <StateBox state={state} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{row.label}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {row.base !== null
                    ? `Basis ${row.base}${row.stretch ? ` · Soll ${row.stretch}` : ''}`
                    : 'ohne Zielwert'}
                  {row.source && ` · ${SOURCE_LABEL[row.source] ?? row.source}`}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className={cn('font-mono text-sm tabular-nums', STATE_TEXT[state])}>
                  {row.value === null ? '–' : row.value.toLocaleString('de-DE')}
                  {soll !== null && row.value !== null && (
                    <span className="text-muted"> / {soll}</span>
                  )}
                </div>
                {row.streak > 0 && (
                  <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-amber-500">
                    <Flame className="h-3 w-3" />
                    {row.streak}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex justify-between border-t border-border/40 pt-3 text-[11px] text-muted">
        <span>
          Adherence Block <span className="font-mono text-foreground">{formatPercent(avg(rows, 'adherence'))}</span>
        </span>
        <span>
          Coverage <span className="font-mono text-foreground">{formatPercent(avg(rows, 'coverage'))}</span>
        </span>
      </div>
    </div>
  );
}

function avg(rows: CauseRow[], key: 'adherence' | 'coverage'): number | null {
  const values = rows.map(r => r[key]).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
