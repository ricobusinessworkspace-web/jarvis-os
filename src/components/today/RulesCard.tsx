'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleCause } from '@/actions/today';
import { clearCause } from '@/actions/verlauf';
import { formatPercent } from '@/lib/metricState';
import type { MetricState } from '@/core/services/AnalyticsService';
import { isJokerDay } from '@/lib/blocks';
import type { Ausblick } from '@/lib/motivation';
import { HabitRow } from './HabitRow';

export interface RuleRow {
  metricKey: string;
  label: string;
  state: MetricState;
  streak: number;
  bestStreak: number;
  adherence: number | null;
  /** Tage im Zeitraum, an denen die Regel gebrochen wurde. */
  broken: number;
  /** Serie und Rekord für „gehalten" und „gebrochen" heute — vom Server gerechnet. */
  ausblick?: Ausblick;
}

/**
 * Regeln — das Gegenstück zu den Ursachen: was Rico jeden Tag **nicht** tut.
 *
 * Umgekehrt zu den Ursachen: der Haken sitzt ab morgens. Die Quelle nimmt
 * „gehalten" an, solange nichts anderes eingetragen ist (`assumeDoneFrom`).
 * Antippen heißt gebrochen — rotes Kreuz, Serie auf 0. Nochmal antippen nimmt
 * den Rückfall zurück. Gespeichert wird also nur der Rückfall.
 *
 * Eine Regel gilt an allen sieben Tagen, auch sonntags.
 */
export function RulesCard({ rows, date, since }: { rows: RuleRow[]; date: string; since: string }) {
  const [, startTransition] = useTransition();

  const [optimisticRows, applyOptimistic] = useOptimistic(
    rows,
    (state: RuleRow[], patch: { metricKey: string; state: MetricState; streak?: number; bestStreak?: number }) =>
      state.map(r =>
        r.metricKey === patch.metricKey
          ? { ...r, state: patch.state, streak: patch.streak ?? r.streak, bestStreak: patch.bestStreak ?? r.bestStreak }
          : r
      )
  );

  // Kein Ton, keine Feier: einen Rückfall eintragen oder zurücknehmen ist keine Leistung.
  const toggle = (row: RuleRow, broken: boolean) =>
    startTransition(async () => {
      const nachher = row.ausblick ? (broken ? row.ausblick.wennErfuellt : row.ausblick.wennNicht) : null;
      applyOptimistic({
        metricKey: row.metricKey,
        state: broken ? 'soll' : 'unter',
        streak: nachher?.serie,
        bestStreak: nachher?.rekord,
      });
      const res = broken ? await clearCause(row.metricKey, date) : await toggleCause(row.metricKey, date, false);
      if (!res?.success) console.error('[Regeln]', res?.error);
    });

  const sinceLabel = new Date(`${since}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'numeric', timeZone: 'UTC',
  });
  const relapses = sumRelapses(rows);
  const joker = isJokerDay(date);

  return (
    <div className="crm-card h-full">
      <div className="crm-header">
        <h3 className="crm-title">Regeln</h3>
        <span className="text-[11px] text-muted">seit {sinceLabel}</span>
      </div>

      <div className="flex flex-col">
        {optimisticRows.map(row => {
          const isBroken = row.state === 'unter';
          return (
            <HabitRow
              key={row.metricKey}
              label={row.label}
              sub={
                <>
                  {isBroken ? 'gebrochen' : 'gehalten'}
                  {isBroken && joker && <span className="text-muted"> · Sonntag ist Joker, Serie bleibt</span>}
                  {!(isBroken && joker) && row.bestStreak > 0 && <span className="text-muted"> · Rekord {row.bestStreak}</span>}
                </>
              }
              subTone={isBroken ? 'error' : 'muted'}
              state={row.state}
              markMissed
              streak={row.streak}
              onToggle={() => toggle(row, isBroken)}
              toggleLabel={isBroken ? `${row.label}: Rückfall zurücknehmen` : `${row.label}: gebrochen`}
            />
          );
        })}
      </div>

      <div className="mt-auto flex justify-between border-t border-border/40 pt-3 text-[11px] text-muted">
        <span>
          Gehalten <span className="font-mono text-foreground">{formatPercent(avg(rows))}</span>
        </span>
        <span>
          Rückfälle <span className="font-mono text-foreground">{relapses ?? '–'}</span>
        </span>
      </div>
    </div>
  );
}

function avg(rows: RuleRow[]): number | null {
  const values = rows.map(r => r.adherence).filter((v): v is number => Number.isFinite(v));
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Fehlt einer Zeile die Zahl, ist die Summe unbekannt — dann „–" statt NaN.
 * Passiert im Dev beim Hot Reload: die neue Karte bekommt noch die Zeilen der
 * alten Seite, ohne `broken`, und `0 + undefined` landet als NaN im DOM.
 */
function sumRelapses(rows: RuleRow[]): number | null {
  let sum = 0;
  for (const r of rows) {
    if (!Number.isFinite(r.broken)) return null;
    sum += r.broken;
  }
  return sum;
}
