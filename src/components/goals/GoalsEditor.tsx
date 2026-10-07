'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import {
  saveFixedGoal, saveRoutineMaxSkip, saveHealthTolerance, saveRevenueGoal,
} from '@/actions/goals';
import type { GoalsPageData } from '@/core/services/GoalService';
import { NumberInput } from '@/components/today/NumberInput';
import { formatValue } from '@/lib/metricState';
import { cn } from '@/lib/utils';

/**
 * Reiter „Ziele" — was Jarvis gehört, ist hier bearbeitbar; was dem CRM oder
 * Apple Health gehört, steht hier mit Herkunft, wird aber dort geändert.
 *
 * Gespeichert wird je Feld beim Verlassen (wie überall im Dashboard). Der
 * Server rendert danach neu, die Anzeige kommt also immer aus der Datenbank —
 * kein zweiter Zustand hier, der davon abweichen könnte.
 */

type Result = { success: true } | { success: false; error: string };

const fmtDate = (d: string | null) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '–');

/**
 * Ein Speichervorgang mit eigener Fehlermeldung — je Zeile, nicht global.
 *
 * `attempt` zählt abgelehnte Eingaben. Als `key` an den Feldern setzt es sie
 * auf den gespeicherten Wert zurück — sonst stünde nach einer Ablehnung die
 * abgelehnte Zahl im Feld, als wäre sie gespeichert.
 */
function useSave() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const run = (fn: () => Promise<Result>) =>
    startTransition(async () => {
      const res = await fn();
      setError(res.success ? null : res.error);
      if (!res.success) setAttempt(a => a + 1);
    });
  return { pending, error, run, attempt };
}

function Card({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">{title}</h3>
        <span className="rounded-md border border-border/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
          {badge}
        </span>
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Row({
  label, sub, error, pending, children,
}: {
  label: string;
  sub?: React.ReactNode;
  error?: string | null;
  pending?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('border-t border-border/40 py-2.5 first:border-t-0 transition-opacity', pending && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px]">{label}</div>
          {sub && <div className="mt-0.5 text-[10.5px] text-muted">{sub}</div>}
        </div>
        {children}
      </div>
      {error && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-error">
          <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2.5} />
          {error}
        </div>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}

const UNIT_SHORT: Record<string, string> = { hours: 'h', count: '', kcal: 'kcal', kg: 'kg' };

function FixedRow({ goal }: { goal: GoalsPageData['fixed'][number] }) {
  const { pending, error, run, attempt } = useSave();
  const unit = UNIT_SHORT[goal.unit] ?? '';
  const save = (base: number | null, stretch: number | null) =>
    run(async () =>
      base === null
        ? { success: false, error: 'Die Basis braucht einen Wert.' }
        : saveFixedGoal(goal.metricKey, base, stretch)
    );

  return (
    <Row label={goal.label} sub={`gilt seit ${fmtDate(goal.since)}`} error={error} pending={pending}>
      <Labeled label="Basis">
        <NumberInput key={`b${attempt}`} value={goal.base} unit={unit} disabled={pending} onSave={v => save(v, goal.stretch)} />
      </Labeled>
      <Labeled label="Soll">
        <NumberInput key={`s${attempt}`} value={goal.stretch} unit={unit} disabled={pending} onSave={v => save(goal.base, v)} />
      </Labeled>
    </Row>
  );
}

function RoutineRow({ goal }: { goal: GoalsPageData['routines'][number] }) {
  const { pending, error, run, attempt } = useSave();
  const base = goal.maxSkip === null ? null : Math.max(1, goal.total - goal.maxSkip);
  return (
    <Row
      label={goal.label}
      sub={
        base === null
          ? 'keine Grenze hinterlegt — keine Basis'
          : <>Basis ab <span className="font-mono text-foreground">{base}/{goal.total}</span> · Soll {goal.total}/{goal.total} · gilt seit {fmtDate(goal.since)}</>
      }
      error={error}
      pending={pending}
    >
      <Labeled label="Dürfen fehlen">
        <NumberInput
          key={attempt}
          value={goal.maxSkip}
          disabled={pending}
          onSave={v =>
            run(async () =>
              v === null ? { success: false, error: 'Bitte eine Zahl eintragen.' } : saveRoutineMaxSkip(goal.metricKey, v)
            )
          }
        />
      </Labeled>
    </Row>
  );
}

function HealthRow({ goal, kind }: { goal: NonNullable<GoalsPageData['calories']>; kind: 'calories' | 'weight' }) {
  const { pending, error, run, attempt } = useSave();
  const unit = kind === 'calories' ? 'kcal' : 'kg';
  // Kalorien-Toleranz steht als Anteil in der Datenbank (0,1), gezeigt in %.
  const shown = goal.tolerance === null ? null : kind === 'calories' ? Math.round(goal.tolerance * 1000) / 10 : goal.tolerance;

  const source = goal.source
    ? kind === 'weight' && goal.source.until
      ? `${formatValue(goal.source.target, 'kg')} kg bis ${fmtDate(goal.source.until)}`
      : `${formatValue(goal.source.target, unit)} ${unit}`
    : null;

  const today = goal.today;
  const todayText =
    today?.hint
      ? `Ziel fehlt — ${today.hint}`
      : today && today.base !== null && today.stretch !== null
        ? kind === 'calories'
          ? `heute: Soll ≤ ${formatValue(today.stretch, unit)} · Basis ≤ ${formatValue(Math.round(today.base), unit)} ${unit}`
          : `heute: Zwischenziel ${formatValue(today.stretch, 'kg')} · Basis ≤ ${formatValue(today.base, 'kg')} kg`
        : null;

  return (
    <Row
      label={goal.label}
      sub={
        <>
          Ziel {source ?? 'noch nicht aus Health angekommen'} <span className="text-muted/70">· aus Apple Health</span>
          {todayText && <div className="mt-0.5 font-mono">{todayText}</div>}
        </>
      }
      error={error}
      pending={pending}
    >
      <Labeled label="Toleranz">
        <NumberInput
          key={attempt}
          value={shown}
          unit={kind === 'calories' ? '%' : 'kg'}
          disabled={pending}
          onSave={v =>
            run(async () =>
              v === null
                ? { success: false, error: 'Bitte eine Zahl eintragen.' }
                : saveHealthTolerance(goal.metricKey as 'body.calories' | 'body.weight', kind === 'calories' ? v / 100 : v)
            )
          }
        />
      </Labeled>
    </Row>
  );
}

function RevenueRow({ revenue }: { revenue: GoalsPageData['revenue'] }) {
  const { pending, error, run, attempt } = useSave();
  const [until, setUntil] = useState(revenue.until ?? '');
  const [lastUntil, setLastUntil] = useState(revenue.until);
  if (revenue.until !== lastUntil) {
    setLastUntil(revenue.until);
    setUntil(revenue.until ?? '');
  }

  const save = (amount: number | null, date: string) =>
    run(async () => {
      if (amount === null) return { success: false, error: 'Der Betrag braucht einen Wert.' };
      if (!date) return { success: false, error: 'Bitte einen Stichtag wählen.' };
      return saveRevenueGoal(amount, date);
    });

  return (
    <Row
      label="Erwartete Provision"
      sub="kumulativ seit Planbeginn, gerechnet auf dem Reiter Vertrieb"
      error={error}
      pending={pending}
    >
      <Labeled label="Ziel">
        <NumberInput key={attempt} value={revenue.amount} unit="€" disabled={pending} onSave={v => save(v, until)} />
      </Labeled>
      <Labeled label="bis">
        <input
          type="date"
          value={until}
          disabled={pending}
          onChange={e => setUntil(e.target.value)}
          onBlur={() => until !== (revenue.until ?? '') && save(revenue.amount, until)}
          className="rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-[13px] outline-none transition-colors focus:border-accent disabled:opacity-40"
        />
      </Labeled>
    </Row>
  );
}

export function GoalsEditor({ data }: { data: GoalsPageData }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card title="Tagesziele" badge="Jarvis">
        {data.fixed.map(g => <FixedRow key={g.metricKey} goal={g} />)}
      </Card>

      <Card title="Routinen" badge="Jarvis">
        {data.routines.map(g => <RoutineRow key={g.metricKey} goal={g} />)}
      </Card>

      {data.rules.length > 0 && (
        <Card title="Regeln" badge="Jarvis">
          {data.rules.map(r => (
            <Row
              key={r.metricKey}
              label={r.label}
              sub={r.since ? `seit ${r.since.slice(8)}.${r.since.slice(5, 7)}.` : undefined}
            >
              <span className="font-mono text-[12.5px] text-muted">
                gehalten · <span className="text-foreground">{r.weekdays === 7 ? 'täglich' : `${r.weekdays} Tage/Woche`}</span>
              </span>
            </Row>
          ))}
        </Card>
      )}

      {/* Seit Phase 2 ohne Ziel — dann gibt es hier nichts einzustellen. */}
      {(data.calories || data.weight) && (
        <Card title="Körper" badge="Apple Health">
          {data.calories && <HealthRow goal={data.calories} kind="calories" />}
          {data.weight && <HealthRow goal={data.weight} kind="weight" />}
          <p className="border-t border-border/40 pt-2.5 text-[10.5px] leading-relaxed text-muted">
            Kalorien- und Gewichtsziel kommen per Kurzbefehl aus Apple Health und werden dort
            geändert. Die Toleranz legt fest, wie weit daneben noch als Basis zählt.
          </p>
        </Card>
      )}

      <Card title="Vertrieb" badge="CRM">
        {data.crm.map(g => (
          <Row
            key={g.metricKey}
            label={g.label}
            sub={g.hint ? `Ziel fehlt — ${g.hint}` : undefined}
          >
            <span className="font-mono text-[12.5px] tabular-nums text-muted">
              Basis <span className="text-foreground">{formatValue(g.base, 'count')}</span>
              {g.stretch !== null && <> · Soll <span className="text-foreground">{formatValue(g.stretch, 'count')}</span></>}
            </span>
          </Row>
        ))}
        <p className="flex items-center gap-1.5 border-t border-border/40 pt-2.5 text-[10.5px] text-muted">
          <ExternalLink className="h-3 w-3 shrink-0" />
          Die Vertriebsziele gehören dem CRM und werden dort geändert — Jarvis übernimmt sie.
        </p>
      </Card>

      <Card title="Umsatz" badge="Jarvis">
        <RevenueRow revenue={data.revenue} />
      </Card>
    </div>
  );
}
