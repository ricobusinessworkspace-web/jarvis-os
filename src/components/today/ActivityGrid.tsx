import { dateRange, isoWeekday } from '@/lib/blocks';
import { STATE_CELL, STATE_LABEL, formatPercent } from '@/lib/metricState';
import type { MetricMatrix, MetricSummary } from '@/core/services/AnalyticsService';
import { cn } from '@/lib/utils';

interface Props {
  matrix: MetricMatrix;
  metrics: Array<{ key: string; label: string; sub: string }>;
  summaries: Record<string, MetricSummary>;
  from: string;
  to: string;
  today: string;
  title?: string;
}

const TICK_DAYS = [1, 8, 15, 22, 29];

/**
 * Monatsverlauf, eine Metrik je Zeile. Kein Kalendergitter mit mehreren
 * Punkten pro Zelle — eine Zeile beantwortet genau eine Frage.
 *
 * Wochen werden durch einen Abstand getrennt, damit das Auge sie findet,
 * ohne dass Wochentags-Beschriftungen nötig werden.
 */
export function ActivityGrid({ matrix, metrics, summaries, from, to, today, title = 'Aktivität' }: Props) {
  const days = dateRange(from, to);

  // Nach Wochen gruppieren; eine neue Gruppe beginnt montags.
  const weeks: string[][] = [];
  for (const day of days) {
    if (isoWeekday(day) === 1 && weeks.length && weeks[weeks.length - 1].length) weeks.push([]);
    if (!weeks.length) weeks.push([]);
    weeks[weeks.length - 1].push(day);
  }

  const monthLabel = new Date(`${from}T12:00:00Z`).toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">{title}</h3>
        <span className="text-xs text-muted">{monthLabel}</span>
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-[520px]">
          {metrics.map(metric => {
            const s = summaries[metric.key];
            return (
              <div key={metric.key} className="flex items-center gap-4 border-t border-border/40 py-2.5 first:border-t-0">
                <div className="w-[86px] shrink-0">
                  <div className="text-[12.5px]">{metric.label}</div>
                  <div className="mt-0.5 text-[10px] text-muted">{metric.sub}</div>
                </div>

                <div className="flex flex-1 gap-2.5">
                  {weeks.map((week, i) => (
                    <div key={i} className="flex gap-[3px]">
                      {week.map(day => {
                        const future = day > today;
                        const cell = matrix[day]?.[metric.key];
                        const state = future ? null : (cell?.state ?? 'ungemessen');
                        const label = future
                          ? 'noch offen'
                          : `${STATE_LABEL[state!]}${cell?.value !== null && cell?.value !== undefined ? ` · ${cell.value}` : ''}`;
                        return (
                          <div
                            key={day}
                            title={`${day.slice(8)}.${day.slice(5, 7)}. — ${label}`}
                            className={cn(
                              'h-3.5 w-3.5 rounded-[3.5px]',
                              future ? 'ring-1 ring-inset ring-white/[0.06]' : STATE_CELL[state!],
                              day === today && 'ring-2 ring-accent ring-offset-1 ring-offset-elevated'
                            )}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="w-[92px] shrink-0 text-right">
                  <div className="font-mono text-[11.5px] tabular-nums">
                    {s ? `${s.met} / ${s.tracked}` : '–'}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted">
                    Cov. {s ? formatPercent(s.coverage) : '–'}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tagesskala — nur die Ankertage, damit die Zeile ruhig bleibt. */}
          <div className="flex items-center gap-4 border-t border-border/40 pt-2">
            <div className="w-[86px] shrink-0 text-[10px] text-muted">Tag</div>
            <div className="flex flex-1 gap-2.5">
              {weeks.map((week, i) => (
                <div key={i} className="flex gap-[3px]">
                  {week.map(day => {
                    const n = Number(day.slice(8));
                    return (
                      <span key={day} className="w-3.5 text-center font-mono text-[9px] text-muted">
                        {TICK_DAYS.includes(n) ? n : ''}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="w-[92px] shrink-0" />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/40 pt-3 text-[11px] text-muted">
        <Legend className="bg-emerald-400" label="Soll" />
        <Legend className="bg-emerald-700" label="Basis" />
        <Legend className="bg-amber-500" label="darunter" />
        <Legend className="bg-sky-500/60" label="erfasst" />
        <Legend className="ring-1 ring-inset ring-white/15" label="nicht gemessen" />
        <Legend className="bg-white/[0.03]" label="Off-Day" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-[3px]', className)} />
      {label}
    </span>
  );
}
