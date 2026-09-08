'use client';

import { useTransition } from 'react';
import { saveDayValues } from '@/actions/verlauf';
import { NumberInput } from './NumberInput';
import { cn } from '@/lib/utils';

/**
 * Schnelleingabe für Körperwerte direkt auf dem Dashboard.
 *
 * Schlaf und Gewicht sollen im Vorbeigehen erfasst werden — wer dafür erst in
 * den Verlauf navigieren muss, trägt sie nicht ein. Kalorien stehen daneben,
 * bleiben aber schreibgeschützt: sie kommen aus Apple Health.
 */
export function BodyLogCard({
  date,
  sleepHours,
  weight,
  calories,
  caloriesConnected,
  lastWeight,
}: {
  date: string;
  sleepHours: number | null;
  weight: number | null;
  calories: number | null;
  caloriesConnected: boolean;
  lastWeight: { value: number; date: string } | null;
}) {
  const [pending, startTransition] = useTransition();

  const save = (patch: { sleepHours?: number | null; weight?: number | null }) =>
    startTransition(() => void saveDayValues(date, patch));

  const weightHint =
    weight !== null
      ? 'heute gewogen'
      : lastWeight
        ? `zuletzt ${lastWeight.value.toLocaleString('de-DE', { minimumFractionDigits: 1 })} kg am ${lastWeight.date.slice(8)}.${lastWeight.date.slice(5, 7)}.`
        : 'noch nie gewogen';

  return (
    <div className={cn('crm-card h-full transition-opacity', pending && 'opacity-70')}>
      <div className="crm-header">
        <h3 className="crm-title">Körper</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted">heute</span>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-[13px]">Schlaf</div>
            <div className="mt-0.5 text-[10.5px] text-muted">letzte Nacht</div>
          </div>
          <NumberInput value={sleepHours} unit="h" disabled={pending} onSave={v => save({ sleepHours: v })} />
        </div>

        <div className="flex items-center gap-3 border-t border-border/40 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-[13px]">Gewicht</div>
            <div className="mt-0.5 truncate text-[10.5px] text-muted">{weightHint}</div>
          </div>
          <NumberInput value={weight} unit="kg" disabled={pending} onSave={v => save({ weight: v })} />
        </div>

        <div className="flex items-center gap-3 border-t border-border/40 py-2">
          <div className="min-w-0 flex-1">
            <div className="text-[13px]">Kalorien</div>
            <div className="mt-0.5 text-[10.5px] text-muted">
              {caloriesConnected ? 'aus Apple Health' : 'Health noch nicht verbunden'}
            </div>
          </div>
          <span className="shrink-0 pr-8 font-mono text-[13px] tabular-nums text-muted">
            {calories === null ? '–' : `${calories.toLocaleString('de-DE')}`}
          </span>
        </div>
      </div>

      <p className="mt-auto border-t border-border/40 pt-3 text-[11px] text-muted">
        Leer heißt <span className="text-foreground">nicht gemessen</span>, nicht 0.
      </p>
    </div>
  );
}
