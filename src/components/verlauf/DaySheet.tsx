'use client';

import { useOptimistic, useTransition } from 'react';
import { Check, Minus } from 'lucide-react';
import { toggleCause } from '@/actions/today';
import { saveDayValues, clearCause, setManualValue, clearManualValue } from '@/actions/verlauf';
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
  /** `source` unterscheidet den Health-Wert von einer Korrektur von Hand. */
  calories: { value: number | null; source: string | null };
  sleepHours: number | null;
  weight: number | null;
  routines: Array<{
    name: string;
    kind: 'morning' | 'evening';
    items: Array<{ id: string; title: string; done: boolean; required: boolean }>;
  }>;
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
          done ? 'border-foreground bg-foreground text-background' : 'border-border text-muted hover:text-foreground'
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
          missed ? 'border-error/60 bg-error/15 text-error' : 'border-border text-muted hover:text-foreground'
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

type Patch =
  | { field: 'training' | 'post'; state: MetricState }
  | { field: 'sleepHours' | 'weight'; value: number | null }
  | { field: 'calories'; value: number | null; source: string | null };

export function DaySheet({ data }: { data: DaySheetData }) {
  const [pending, startTransition] = useTransition();

  /**
   * Wie in den Karten auf dem Dashboard: der angezeigte Wert bleibt stehen,
   * bis der Server neu gerendert hat. Sonst springt die Anzeige zwischendurch
   * auf den alten Stand zurück.
   */
  const [d, applyOptimistic] = useOptimistic(data, (state: DaySheetData, patch: Patch): DaySheetData => {
    switch (patch.field) {
      case 'training':
        return { ...state, training: { ...state.training, state: patch.state } };
      case 'post':
        return { ...state, post: { ...state.post, state: patch.state } };
      case 'sleepHours':
        return { ...state, sleepHours: patch.value };
      case 'weight':
        return { ...state, weight: patch.value };
      case 'calories':
        return { ...state, calories: { value: patch.value, source: patch.source } };
    }
  });

  const locked = d.isFuture;

  const run = (patch: Patch, fn: () => Promise<unknown>) =>
    startTransition(async () => {
      applyOptimistic(patch);
      await fn();
    });

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
            d.isToday ? 'bg-foreground/10 text-foreground'
              : d.isOffDay || d.isFuture ? 'bg-white/[0.06] text-muted'
                : 'bg-white/[0.06] text-muted'
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
            onSet={done =>
              run({ field: 'training', state: done ? 'soll' : 'unter' }, () =>
                toggleCause('training.sessions', d.date, done)
              )
            }
            onClear={() =>
              run({ field: 'training', state: 'ungemessen' }, () =>
                clearCause('training.sessions', d.date)
              )
            }
          />
        </Field>

        <Field label="Personal Brand Post" hint="später automatisch aus dem G-Projekt">
          <TriToggle
            state={d.post.state}
            disabled={locked || pending}
            onSet={done =>
              run({ field: 'post', state: done ? 'soll' : 'unter' }, () =>
                toggleCause('content.posts', d.date, done)
              )
            }
            onClear={() =>
              run({ field: 'post', state: 'ungemessen' }, () =>
                clearCause('content.posts', d.date)
              )
            }
          />
        </Field>

        <GroupLabel>Körper</GroupLabel>

        {/* Health ist die Wahrheit — aber ein Tag, an dem der Kurzbefehl nie
            lief, muss trotzdem nachtragbar sein, ohne Cronometer zu öffnen.
            Die Korrektur schlägt danach jeden Sync, bis sie zurückgenommen
            wird; deshalb sagt die Zeile auch klar, dass sie von Hand kam. */}
        <Field
          label="Kalorien"
          hint={
            d.calories.source === 'manual'
              ? 'von Hand — überschreibt Apple Health für diesen Tag'
              : 'aus Apple Health — sonst hier nachtragen'
          }
        >
          <div className="flex shrink-0 items-center gap-2">
            {d.calories.source === 'manual' && (
              <button
                onClick={() =>
                  run({ field: 'calories', value: null, source: null }, () =>
                    clearManualValue('body.calories', d.date)
                  )
                }
                disabled={locked || pending}
                className="rounded-lg border border-border px-2 py-1 text-[10.5px] text-muted transition-colors hover:text-foreground"
                title="Korrektur zurücknehmen — ab dann gilt wieder Apple Health"
              >
                zurücksetzen
              </button>
            )}
            <NumberInput
              value={d.calories.value}
              unit="kcal"
              disabled={locked || pending}
              onSave={v =>
                run({ field: 'calories', value: v, source: 'manual' }, () =>
                  setManualValue('body.calories', d.date, v)
                )
              }
            />
          </div>
        </Field>

        <Field label="Schlaf">
          <NumberInput
            value={d.sleepHours}
            unit="h"
            disabled={locked || pending}
            onSave={v => run({ field: 'sleepHours', value: v }, () => saveDayValues(d.date, { sleepHours: v }))}
          />
        </Field>

        <Field label="Gewicht">
          <NumberInput
            value={d.weight}
            unit="kg"
            disabled={locked || pending}
            onSave={v => run({ field: 'weight', value: v }, () => saveDayValues(d.date, { weight: v }))}
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
                          startTransition(async () => {
                            await logTrackerItem(item.id, item.done ? 'not_done' : 'completed', d.date);
                          })
                        }
                        className={cn(
                          'rounded-lg border px-2.5 py-1 text-[11.5px] transition-colors',
                          item.done
                            ? 'border-foreground/25 bg-foreground/10 text-foreground'
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
