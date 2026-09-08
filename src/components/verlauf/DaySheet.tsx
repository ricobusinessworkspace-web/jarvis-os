'use client';

import { useTransition } from 'react';
import { Check, Minus } from 'lucide-react';
import { toggleCause } from '@/actions/today';
import { saveDayValues, clearCause } from '@/actions/verlauf';
import { logTrackerItem } from '@/actions/dashboard';
import { NumberInput } from '@/components/today/NumberInput';
import type { MetricState } from '@/core/services/AnalyticsService';
import { cn } from '@/lib/utils';

export interface DaySheetData {
  date: string;
  isToday: boolean;
  isOffDay: boolean;
  isFuture: boolean;
  calls: { value: number | null; base: number | null; stretch: number | null; state: MetricState };
  training: { value: number | null; state: MetricState };
  post: { value: number | null; state: MetricState };
  calories: number | null;
  sleepHours: number | null;
  weight: number | null;
  routines: Array<{ name: string; kind: 'morning' | 'evening'; items: Array<{ id: string; title: string; done: boolean }> }>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-border/40 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px]">{label}</div>
        {hint && <div className="mt-0.5 text-[10.5px] text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-1 pt-5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
      {children}
    </div>
  );
}

/** Dreizustands-Schalter: erfüllt · nicht geschafft · nicht gemessen. */
function TriToggle({
  state, disabled, onSet, onClear,
}: { state: MetricState; disabled?: boolean; onSet: (done: boolean) => void; onClear: () => void }) {
  const done = state === 'soll' || state === 'basis';
  const missed = state === 'unter';
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        onClick={() => onSet(true)}
        disabled={disabled}
        title="geschafft"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
          done ? 'border-emerald-500 bg-emerald-500 text-black/70' : 'border-border text-muted hover:text-foreground'
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <button
        onClick={() => onSet(false)}
        disabled={disabled}
        title="nicht geschafft"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg border transition-colors',
          missed ? 'border-amber-500 bg-amber-500/20 text-amber-500' : 'border-border text-muted hover:text-foreground'
        )}
      >
        <Minus className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <button
        onClick={onClear}
        disabled={disabled}
        title="nicht gemessen"
        className={cn(
          'flex h-7 items-center justify-center rounded-lg border px-2 text-[10px] transition-colors',
          state === 'ungemessen' ? 'border-white/25 border-dashed text-foreground' : 'border-border text-muted hover:text-foreground'
        )}
      >
        –
      </button>
    </div>
  );
}

export function DaySheet({ data }: { data: DaySheetData }) {
  const [pending, startTransition] = useTransition();
  const d = data;
  const locked = d.isFuture;

  const run = (fn: () => Promise<unknown>) => startTransition(() => void fn());

  const title = new Date(`${d.date}T12:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });

  const measured = [d.calls.value, d.training.value, d.post.value].filter(v => v !== null).length;

  return (
    <div className={cn('crm-card !p-0 overflow-hidden transition-opacity', pending && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-5 py-4">
        <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
            d.isToday ? 'bg-emerald-500/15 text-emerald-400'
              : d.isOffDay || d.isFuture ? 'bg-white/[0.06] text-muted'
                : 'bg-amber-500/15 text-amber-500'
          )}
        >
          {d.isToday ? 'Heute' : d.isFuture ? 'Zukunft' : d.isOffDay ? 'Off-Day' : 'Nachtragen möglich'}
        </span>
        <span className="ml-auto font-mono text-[11.5px] text-muted">
          Coverage {d.isOffDay ? '–' : `${Math.round((measured / 3) * 100)} %`}
        </span>
      </div>

      <div className="px-5 pb-4">
        <GroupLabel>Ursachen</GroupLabel>

        <Field label="Calls" hint={`Basis ${d.calls.base ?? '–'} · Soll ${d.calls.stretch ?? '–'} · automatisch aus dem CRM`}>
          <span className="shrink-0 font-mono text-[13px] tabular-nums text-muted">
            {d.calls.value === null ? '– keine Daten' : d.calls.value}
          </span>
        </Field>

        <Field label="Trainingseinheit" hint="inkl. Basketball">
          <TriToggle
            state={d.training.state}
            disabled={locked || pending}
            onSet={done => run(() => toggleCause('training.sessions', d.date, done))}
            onClear={() => run(() => clearCause('training.sessions', d.date))}
          />
        </Field>

        <Field label="Personal Brand Post" hint="später automatisch aus dem G-Projekt">
          <TriToggle
            state={d.post.state}
            disabled={locked || pending}
            onSet={done => run(() => toggleCause('content.posts', d.date, done))}
            onClear={() => run(() => clearCause('content.posts', d.date))}
          />
        </Field>

        <GroupLabel>Körper</GroupLabel>

        <Field label="Kalorien" hint="aus Apple Health — Korrekturen in Cronometer">
          <span className="shrink-0 font-mono text-[13px] tabular-nums text-muted">
            {d.calories === null ? '– nicht verbunden' : `${d.calories.toLocaleString('de-DE')} kcal`}
          </span>
        </Field>

        <Field label="Schlaf">
          <NumberInput
            value={d.sleepHours}
            unit="h"
            disabled={locked || pending}
            onSave={v => run(() => saveDayValues(d.date, { sleepHours: v }))}
          />
        </Field>

        <Field label="Gewicht">
          <NumberInput
            value={d.weight}
            unit="kg"
            disabled={locked || pending}
            onSave={v => run(() => saveDayValues(d.date, { weight: v }))}
          />
        </Field>

        {d.routines.length > 0 && (
          <>
            <GroupLabel>Routine</GroupLabel>
            {d.routines.map(r => {
              const done = r.items.filter(i => i.done).length;
              return (
                <div key={r.kind} className="border-t border-border/40 py-2.5">
                  <div className="mb-1.5 flex items-center gap-3">
                    <span className="flex-1 text-[13px]">{r.name}</span>
                    <span className="font-mono text-[11.5px] tabular-nums text-muted">
                      {done} / {r.items.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.items.map(item => (
                      <button
                        key={item.id}
                        disabled={locked || pending}
                        onClick={() =>
                          run(() => logTrackerItem(item.id, item.done ? 'not_done' : 'completed', d.date))
                        }
                        className={cn(
                          'rounded-lg border px-2.5 py-1 text-[11.5px] transition-colors',
                          item.done
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                            : 'border-border text-muted hover:text-foreground'
                        )}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <p className="border-t border-border/40 bg-background/40 px-5 py-3 text-[11.5px] text-muted">
        Leeres Feld bleibt <span className="text-foreground">nicht gemessen</span> — wird nie als 0 gewertet.
        Änderungen speichern sofort.
      </p>
    </div>
  );
}
