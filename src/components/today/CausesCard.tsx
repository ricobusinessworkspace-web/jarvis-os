'use client';

import { toggleCause } from '@/actions/today';
import { formatPercent } from '@/lib/metricState';
import type { MetricState } from '@/core/services/AnalyticsService';
import type { Ausblick } from '@/lib/motivation';
import { HabitRow } from './HabitRow';
import { useFeier } from './useFeier';
import { useHeute } from './TodayProvider';

export interface CauseRow {
  metricKey: string;
  label: string;
  state: MetricState;
  /** `kind` der Quelle — Calls kommen aus dem CRM. */
  source: string | null;
  streak: number;
  bestStreak: number;
  adherence: number | null;
  coverage: number | null;
  /** Nur Metriken mit manueller Quelle lassen sich hier abhaken. */
  toggleable: boolean;
  /** Serie und Rekord für beide Fälle des heutigen Hakens — vom Server gerechnet. */
  ausblick?: Ausblick;
}

const isDone = (state: MetricState) => state === 'soll' || state === 'basis';

/**
 * Was offen ist, ist rot — von morgens an, nicht erst nach dem Abwählen.
 * Rein in der Anzeige: gespeichert bleibt „nicht gemessen", die Matrix und
 * der Verlauf unterscheiden weiter zwischen vergessen und verfehlt. Off-Day,
 * „erfasst" und „Ziel fehlt" behalten ihr eigenes Kästchen.
 */
const shown = (state: MetricState): MetricState => (state === 'ungemessen' ? 'unter' : state);

export function CausesCard({ date }: { date: string }) {
  const { stand, anwenden } = useHeute();
  const rows = stand.causes;
  const { feiern, ausloesen } = useFeier();

  const toggle = (row: CauseRow) => {
    const done = !isDone(row.state);
    // Die Zahlen für danach hat der Server schon gerechnet.
    const nachher = row.ausblick ? (done ? row.ausblick.wennErfuellt : row.ausblick.wennNicht) : null;
    if (nachher && row.ausblick) ausloesen(row.metricKey, row.label, row.ausblick, nachher, done);
    anwenden(
      {
        art: 'zeile', liste: 'causes', metricKey: row.metricKey,
        state: done ? 'soll' : 'unter', streak: nachher?.serie, bestStreak: nachher?.rekord,
      },
      async () => {
        const res = await toggleCause(row.metricKey, date, done);
        if (!res?.success) console.error('[Ursachen]', res?.error);
      }
    );
  };

  return (
    <div className="crm-card h-full">
      <div className="crm-header">
        <h3 className="crm-title">Ursachen</h3>
      </div>

      <div className="flex flex-col">
        {rows.map(row => {
          const done = isDone(row.state);
          const status = row.state === 'offday' ? 'Off-Day' : done ? 'erledigt' : 'offen';
          return (
            <HabitRow
              key={row.metricKey}
              label={row.label}
              sub={
                <>
                  {status}
                  {row.source === 'crm_calls' || row.source === 'crm_metrics' ? ' · CRM' : ''}
                  {row.bestStreak > 0 && ` · Rekord ${row.bestStreak}`}
                </>
              }
              state={shown(row.state)}
              streak={row.streak}
              onToggle={row.toggleable ? () => toggle(row) : undefined}
              toggleLabel={done ? `${row.label}: Haken entfernen` : `${row.label} abhaken`}
              feier={feiern[row.metricKey] ?? null}
            />
          );
        })}
      </div>

      <div className="mt-auto flex justify-between border-t border-border/40 pt-3 text-[11px] text-muted">
        <span>
          Adherence <span className="font-mono text-foreground">{formatPercent(avg(rows, 'adherence'))}</span>
        </span>
        <span>
          Coverage <span className="font-mono text-foreground">{formatPercent(avg(rows, 'coverage'))}</span>
        </span>
      </div>
    </div>
  );
}

function avg(rows: CauseRow[], key: 'adherence' | 'coverage'): number | null {
  const values = rows.map(r => r[key]).filter((v): v is number => Number.isFinite(v));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
