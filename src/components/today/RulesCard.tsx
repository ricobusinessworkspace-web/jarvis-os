'use client';

import { useOptimistic, useTransition } from 'react';
import { Flame, X } from 'lucide-react';
import { toggleCause } from '@/actions/today';
import { clearCause } from '@/actions/verlauf';
import { formatPercent } from '@/lib/metricState';
import type { MetricState } from '@/core/services/AnalyticsService';
import { cn } from '@/lib/utils';
import { StateBox } from './StateBox';

export interface RuleRow {
  metricKey: string;
  label: string;
  state: MetricState;
  streak: number;
  bestStreak: number;
  adherence: number | null;
  coverage: number | null;
}

type Mark = 'gehalten' | 'gebrochen' | null;

const markOf = (state: MetricState): Mark =>
  state === 'soll' || state === 'basis' ? 'gehalten' : state === 'unter' ? 'gebrochen' : null;

const STATE_OF: Record<'gehalten' | 'gebrochen' | 'leer', MetricState> = {
  gehalten: 'soll',
  gebrochen: 'unter',
  leer: 'ungemessen',
};

/**
 * Regeln — das Gegenstück zu den Ursachen: was Rico jeden Tag **nicht** tut.
 *
 * Drei Zustände, und keiner wird geraten:
 * - Kästchen = gehalten. Nochmal tippen nimmt den Eintrag zurück.
 * - Kreuz = gebrochen. Ein bewusst eingetragener Rückfall, rot.
 * - Kein Eintrag = nicht gemessen. Vergessen ist kein Rückfall — die Serie
 *   reißt trotzdem, aber die Historie unterscheidet beides.
 *
 * Eine Regel gilt an allen sieben Tagen, auch sonntags. Heute ohne Eintrag
 * bricht keine Serie, der Tag läuft noch.
 */
export function RulesCard({ rows, date, since }: { rows: RuleRow[]; date: string; since: string }) {
  const [, startTransition] = useTransition();

  const [optimisticRows, applyOptimistic] = useOptimistic(
    rows,
    (state: RuleRow[], patch: { metricKey: string; state: MetricState }) =>
      state.map(r => (r.metricKey === patch.metricKey ? { ...r, state: patch.state } : r))
  );

  const set = (row: RuleRow, next: 'gehalten' | 'gebrochen' | 'leer') =>
    startTransition(async () => {
      applyOptimistic({ metricKey: row.metricKey, state: STATE_OF[next] });
      const res =
        next === 'leer'
          ? await clearCause(row.metricKey, date)
          : await toggleCause(row.metricKey, date, next === 'gehalten');
      if (!res?.success) console.error('[Regeln]', res?.error);
    });

  const sinceLabel = new Date(`${since}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="crm-card h-full">
      <div className="crm-header">
        <h3 className="crm-title">Regeln</h3>
        <span className="text-[11px] text-muted">seit {sinceLabel}</span>
      </div>

      <div className="flex flex-col">
        {optimisticRows.map(row => {
          const mark = markOf(row.state);
          return (
            <div
              key={row.metricKey}
              className="flex items-center gap-3 border-t border-border/40 py-2.5 first:border-t-0 first:pt-0"
            >
              <button
                onClick={() => set(row, mark === 'gehalten' ? 'leer' : 'gehalten')}
                aria-label={`${row.label}: gehalten`}
                title={mark === 'gehalten' ? 'Eintrag zurücknehmen' : 'gehalten'}
                className="shrink-0 cursor-pointer transition-transform active:scale-90"
              >
                <StateBox state={row.state} markMissed />
              </button>

              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm leading-snug">{row.label}</div>
                <div className={cn('mt-0.5 text-[11px]', mark === 'gebrochen' ? 'text-error' : 'text-muted')}>
                  {mark === 'gehalten' ? 'gehalten' : mark === 'gebrochen' ? 'gebrochen' : 'offen'}
                  {row.bestStreak > 0 && <span className="text-muted"> · Rekord {row.bestStreak}</span>}
                </div>
              </div>

              <div
                className={cn(
                  'flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums',
                  row.streak > 0 ? 'text-foreground' : 'text-muted'
                )}
                title={`${row.streak} ${row.streak === 1 ? 'Tag' : 'Tage'} in Folge`}
              >
                <Flame className={cn('h-3.5 w-3.5', row.streak === 0 && 'opacity-50')} />
                {row.streak}
              </div>

              <button
                onClick={() => set(row, mark === 'gebrochen' ? 'leer' : 'gebrochen')}
                aria-label={`${row.label}: gebrochen`}
                title={mark === 'gebrochen' ? 'Eintrag zurücknehmen' : 'gebrochen eintragen'}
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
                  mark === 'gebrochen'
                    ? 'bg-error/15 text-error'
                    : 'text-muted/60 hover:bg-white/[0.06] hover:text-foreground'
                )}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex justify-between border-t border-border/40 pt-3 text-[11px] text-muted">
        <span>
          Gehalten <span className="font-mono text-foreground">{formatPercent(avg(rows, 'adherence'))}</span>
        </span>
        <span>
          Coverage <span className="font-mono text-foreground">{formatPercent(avg(rows, 'coverage'))}</span>
        </span>
      </div>
    </div>
  );
}

function avg(rows: RuleRow[], key: 'adherence' | 'coverage'): number | null {
  const values = rows.map(r => r[key]).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
