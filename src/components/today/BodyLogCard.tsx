'use client';

import { useOptimistic, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import { saveDayValues, setManualValue, clearManualValue } from '@/actions/verlauf';
import { STATE_TEXT, formatValue } from '@/lib/metricState';
import type { DayMetric } from '@/core/services/AnalyticsService';
import { NumberInput } from './NumberInput';
import { cn } from '@/lib/utils';

/**
 * Schnelleingabe für Körperwerte direkt auf dem Dashboard.
 *
 * Schlaf, Gewicht und Kalorien sollen im Vorbeigehen erfasst werden — wer dafür
 * erst in den Verlauf navigieren muss, trägt sie nicht ein.
 *
 * Alle drei tragen inzwischen ein Ziel: Schlaf ein eigenes (6 h Basis, 8 h
 * Soll), Kalorien und Gewicht je eines aus Cronometer. Deshalb steht neben
 * jedem Wert, woran er gemessen wird — und wenn sich das Ziel gerade nicht
 * auflösen lässt, steht dort der Grund statt einer erfundenen Zahl.
 */

function targetHintFor(m: DayMetric, unit: string): string | null {
  if (m.targetHint) return null; // dort steht stattdessen der Grund
  if (m.stretch !== null && m.base !== null && m.stretch !== m.base) {
    return `Soll ${formatValue(m.stretch, unit)} · Basis ${formatValue(m.base, unit)}`;
  }
  const goal = m.stretch ?? m.base;
  return goal === null ? null : `Soll ${formatValue(goal, unit)}`;
}

function Row({
  label, sub, metric, unit, children,
}: {
  label: string;
  sub: string;
  metric: DayMetric;
  unit: string;
  children: React.ReactNode;
}) {
  const target = targetHintFor(metric, unit);
  return (
    <div className="flex items-center gap-3 border-t border-border/40 py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13px]">{label}</div>
        <div className="mt-0.5 truncate text-[10.5px] text-muted">{sub}</div>
        {/* Am Hinweis hängen, nicht am Zustand: ein fehlendes Ziel soll auch an
            einem Tag auffallen, an dem noch gar nichts gemessen wurde — sonst
            merkt man den kaputten Anschluss erst beim nächsten Eintrag. */}
        {metric.targetHint ? (
          <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted">
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
            Ziel fehlt — {metric.targetHint}
          </div>
        ) : (
          target && <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted">{target}</div>
        )}
      </div>
      {children}
    </div>
  );
}

interface Shown {
  sleep: number | null;
  weight: number | null;
  calories: number | null;
  caloriesSource: string | null;
}

export function BodyLogCard({
  date, sleep, weight, calories, lastWeight,
}: {
  date: string;
  sleep: DayMetric;
  weight: DayMetric;
  calories: DayMetric;
  lastWeight: { value: number; date: string } | null;
}) {
  const [pending, startTransition] = useTransition();

  // Eingetragener Wert bleibt stehen, bis der Server neu gerendert hat.
  const [shown, applyOptimistic] = useOptimistic<Shown, Partial<Shown>>(
    { sleep: sleep.value, weight: weight.value, calories: calories.value, caloriesSource: calories.source },
    (state, patch) => ({ ...state, ...patch })
  );

  const save = (patch: { sleepHours?: number | null; weight?: number | null }) =>
    startTransition(async () => {
      applyOptimistic(
        patch.sleepHours !== undefined ? { sleep: patch.sleepHours } : { weight: patch.weight ?? null }
      );
      await saveDayValues(date, patch);
    });

  // Kalorien kommen normalerweise aus Health. Von Hand eingetragen schlägt der
  // Wert jeden späteren Sync — bis er zurückgesetzt wird.
  const saveCalories = (v: number | null) =>
    startTransition(async () => {
      applyOptimistic({ calories: v, caloriesSource: 'manual' });
      await setManualValue('body.calories', date, v);
    });

  const resetCalories = () =>
    startTransition(async () => {
      applyOptimistic({ calories: null, caloriesSource: null });
      await clearManualValue('body.calories', date);
    });

  const weightHint =
    shown.weight !== null
      ? 'heute gewogen'
      : lastWeight
        ? `zuletzt ${lastWeight.value.toLocaleString('de-DE', { minimumFractionDigits: 1 })} kg am ${lastWeight.date.slice(8)}.${lastWeight.date.slice(5, 7)}.`
        : 'noch nie gewogen';

  const caloriesSub =
    shown.caloriesSource === 'manual'
      ? 'von Hand — überschreibt Health'
      : shown.caloriesSource === 'health'
        ? 'aus Apple Health'
        : 'Health noch nicht verbunden';

  return (
    <div className={cn('crm-card h-full transition-opacity', pending && 'opacity-70')}>
      <div className="crm-header">
        <h3 className="crm-title">Körper</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted">heute</span>
      </div>

      <div className="flex flex-col">
        <Row label="Schlaf" sub="letzte Nacht" metric={sleep} unit="hours">
          <NumberInput
            value={shown.sleep}
            unit="h"
            disabled={pending}
            onSave={v => save({ sleepHours: v })}
            className={STATE_TEXT[sleep.state]}
          />
        </Row>

        <Row label="Gewicht" sub={weightHint} metric={weight} unit="kg">
          <NumberInput
            value={shown.weight}
            unit="kg"
            disabled={pending}
            onSave={v => save({ weight: v })}
            className={STATE_TEXT[weight.state]}
          />
        </Row>

        <Row label="Kalorien" sub={caloriesSub} metric={calories} unit="kcal">
          <div className="flex shrink-0 items-center gap-1.5">
            {shown.caloriesSource === 'manual' && (
              <button
                onClick={resetCalories}
                disabled={pending}
                className="rounded-lg border border-border px-1.5 py-1 text-[10px] text-muted transition-colors hover:text-foreground"
                title="Korrektur zurücknehmen — ab dann gilt wieder Apple Health"
              >
                zurück
              </button>
            )}
            <NumberInput
              value={shown.calories}
              disabled={pending}
              onSave={saveCalories}
              className={STATE_TEXT[calories.state]}
            />
          </div>
        </Row>
      </div>

      <p className="mt-auto border-t border-border/40 pt-3 text-[11px] text-muted">
        Leer heißt <span className="text-foreground">nicht gemessen</span>, nicht 0.
      </p>
    </div>
  );
}
