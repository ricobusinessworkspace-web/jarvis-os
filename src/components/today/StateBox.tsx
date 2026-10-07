import { Check, X } from 'lucide-react';
import type { MetricState } from '@/core/services/AnalyticsService';
import { cn } from '@/lib/utils';

/**
 * Kästchen mit unterscheidbaren Zuständen — erfüllt, darunter, nicht gemessen.
 * `markMissed` zeichnet in „darunter" ein Kreuz: bei einer Regel ist das ein
 * bewusst eingetragener Rückfall, keine bloße Lücke.
 */
export function StateBox({ state, markMissed = false }: { state: MetricState; markMissed?: boolean }) {
  const done = state === 'soll' || state === 'basis';
  return (
    <div
      className={cn(
        'h-5 w-5 shrink-0 rounded-md border-[1.5px] flex items-center justify-center transition-colors',
        done && 'bg-foreground border-foreground',
        state === 'unter' && 'border-error/50 bg-error/12',
        state === 'ungemessen' && 'border-dashed border-white/25',
        state === 'erfasst' && 'border-white/20 bg-white/[0.06]',
        // Wert da, Maß fehlt: gefüllt wie „erfasst", aber offener Rand.
        state === 'zielfehlt' && 'border-dashed border-white/45 bg-white/[0.06]',
        state === 'offday' && 'border-white/10 bg-white/[0.03]'
      )}
    >
      {done && <Check className="h-3 w-3 text-background" strokeWidth={3.5} />}
      {markMissed && state === 'unter' && <X className="h-3 w-3 text-error" strokeWidth={3.5} />}
    </div>
  );
}
