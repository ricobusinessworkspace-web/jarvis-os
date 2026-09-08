import { STATE_TEXT, STATE_BAR, formatValue } from '@/lib/metricState';
import type { MetricState } from '@/core/services/AnalyticsService';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  source?: string;
  value: number | null;
  base: number | null;
  stretch: number | null;
  unit: string;
  state: MetricState;
  footLeft?: string;
  footRight?: string;
  /** Ersetzt die Zahl, wenn es schlicht keine Datenquelle gibt. */
  emptyHint?: string;
}

export function MetricCard({
  title, source, value, base, stretch, unit, state, footLeft, footRight, emptyHint,
}: Props) {
  const goal = stretch ?? base;
  const fill = value !== null && goal ? Math.min(100, (value / goal) * 100) : 0;
  // Die Basis-Marke sitzt dort, wo das Minimum auf dem Weg zum Soll liegt.
  const basisAt = base !== null && stretch && stretch !== base ? (base / stretch) * 100 : null;

  return (
    <div className="crm-card h-full">
      <div className="crm-header">
        <h3 className="crm-title">{title}</h3>
        {source && (
          <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
            {source}
          </span>
        )}
      </div>

      {value === null && emptyHint ? (
        <p className="text-[13px] leading-relaxed text-muted">{emptyHint}</p>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={cn('font-mono text-[38px] leading-none tabular-nums', STATE_TEXT[state])}>
            {formatValue(value, unit)}
          </span>
          {goal !== null && <span className="font-mono text-[13px] text-muted">/ {goal}</span>}
        </div>
      )}

      <div className="mt-auto pt-4">
        {goal !== null && (
          <div className="relative h-1.5 rounded-full bg-white/[0.07]">
            <div className={cn('h-full rounded-full', STATE_BAR[state])} style={{ width: `${fill}%` }} />
            {basisAt !== null && (
              <span
                className="absolute -top-[3px] h-3 w-px bg-white/25"
                style={{ left: `${basisAt}%` }}
                title={`Basis ${base}`}
              />
            )}
          </div>
        )}
        {(footLeft || footRight) && (
          <div className="mt-3 flex justify-between gap-3 text-[11px] text-muted">
            <span>{footLeft}</span>
            <span className="font-mono tabular-nums">{footRight}</span>
          </div>
        )}
      </div>
    </div>
  );
}
