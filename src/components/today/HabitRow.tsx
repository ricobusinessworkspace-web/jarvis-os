import { Flame } from 'lucide-react';
import type { MetricState } from '@/core/services/AnalyticsService';
import { cn } from '@/lib/utils';
import { StateBox } from './StateBox';

/**
 * Eine Zeile in Ursachen und Regeln — beide Karten sehen gleich aus:
 * Kästchen, Name, eine ruhige Unterzeile, rechts die Serie. Die Serie steht
 * immer da, auch bei 0: sie ist das, worum es in beiden Karten geht.
 */
export function HabitRow({
  label, sub, subTone = 'muted', state, markMissed = false, streak, onToggle, toggleLabel,
}: {
  label: string;
  sub: React.ReactNode;
  subTone?: 'muted' | 'error';
  /** Der Zustand, wie das Kästchen ihn zeigen soll. */
  state: MetricState;
  /** Kreuz im roten Kästchen — bei Regeln heißt rot „gebrochen", nicht „offen". */
  markMissed?: boolean;
  streak: number;
  /** Ohne Handler ist das Kästchen reine Anzeige (Calls kommen aus dem CRM). */
  onToggle?: () => void;
  toggleLabel: string;
}) {
  // Fehlt die Zahl (Hot Reload mit alten Zeilen), steht „–" — nie NaN.
  const known = Number.isFinite(streak);

  return (
    <div className="flex items-center gap-3 border-t border-border/40 py-2.5 first:border-t-0 first:pt-0">
      <button
        onClick={onToggle}
        disabled={!onToggle}
        aria-label={toggleLabel}
        title={onToggle ? toggleLabel : undefined}
        className={cn('shrink-0 transition-transform', onToggle ? 'cursor-pointer active:scale-90' : 'cursor-default')}
      >
        <StateBox state={state} markMissed={markMissed} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm leading-snug">{label}</div>
        <div className={cn('mt-0.5 text-[11px]', subTone === 'error' ? 'text-error' : 'text-muted')}>{sub}</div>
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums',
          streak > 0 ? 'text-foreground' : 'text-muted'
        )}
        title={known ? `${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge` : undefined}
      >
        <Flame className={cn('h-3.5 w-3.5', streak === 0 && 'opacity-50')} />
        {known ? streak : '–'}
      </div>
    </div>
  );
}
