import { Suspense } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { GoalService, REVENUE_METRIC } from '@/core/services/GoalService';
import { RoutineService } from '@/core/services/RoutineService';
import { zielbild } from '@/core/services/MotivationService';
import { heuteUndWoche } from '@/core/services/WochenService';
import { daysBetween } from '@/lib/blocks';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { GOLD_AB } from '@/lib/motivation';
import { GoalsEditor } from '@/components/goals/GoalsEditor';
import { RoutinenEditor } from '@/components/goals/RoutinenEditor';
import { ToeneSchalter } from '@/components/goals/ToeneSchalter';
import { RouteLoading } from '@/components/layout/RouteLoading';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Ziele: wofür das alles ist. Das Ergebnisziel mit dem, was darauf einzahlt,
 * der Plan, weitere Ziele, die Rekorde — und unten die Einstellungen, die
 * sich selten ändern. Gold nur für Serien ab 7.
 *
 * „Zahlt darauf ein" ist bis zur Migration `core_goal_drivers`
 * (`docs/wochenzyklus-analyse.md`) fest: die Calls der Woche aufs Umsatzziel.
 */
const datum = (d: string, jahr = true) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', ...(jahr ? { year: 'numeric' } : {}), timeZone: 'UTC' });
const zahl = (n: number | null) => (n === null ? '–' : n.toLocaleString('de-DE'));

function Gruppe({ titel, untertitel, children }: { titel: string; untertitel?: string; children: React.ReactNode }) {
  return (
    <details className="group relative [&+&]:before:absolute [&+&]:before:left-4 [&+&]:before:right-0 [&+&]:before:top-0 [&+&]:before:h-px [&+&]:before:bg-separator">
      <summary className="flex min-h-[50px] cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
        <span className="flex-1">
          <span className="block text-[15px]">{titel}</span>
          {untertitel && <span className="block text-[13px] text-muted">{untertitel}</span>}
        </span>
        <ChevronRight className="h-4 w-4 text-tertiary transition-transform group-open:rotate-90" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

async function Ziele() {
  const today = getBerlinDateStr();
  // Nacheinander — eine Pooler-Verbindung pro Instanz.
  const bild = await zielbild(today);
  const woche = await heuteUndWoche(today);
  const ziele = await AnalyticsService.getGoals();
  const routinen = await RoutineService.getRoutineBlocks(today);
  const einstellungen = await GoalService.getGoalsPage();

  const { reise, umsatz, rekorde } = bild;
  const w = woche.woche.calls;
  const weitere = ziele.filter(z => z.metricKey !== REVENUE_METRIC && z.status === 'active');
  const anteil = umsatz.betrag !== null && umsatz.ziel ? Math.min(1, umsatz.betrag / umsatz.ziel) : null;

  return (
    <>
      <h1 className="mt-2 font-display text-[34px] font-bold tracking-[-0.025em]">Ziele</h1>
      <p className="mb-6 mt-0.5 text-[15px] text-muted">
        {reise.ende ? `${reise.tageUebrig} Tage bis ${datum(reise.ende)}` : 'Kein Stichtag hinterlegt'}
      </p>

      <section className="rounded-[22px] bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium text-muted">Umsatz</span>
          {umsatz.bis && <span className="text-[13px] text-muted">bis {datum(umsatz.bis)}</span>}
        </div>
        <div className="mt-2 font-display text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums">
          {umsatz.betrag === null ? '–' : `${zahl(umsatz.betrag)} €`}
          <span className="ml-1.5 text-[20px] font-medium tracking-normal text-muted">/ {umsatz.ziel === null ? 'kein Ziel' : `${zahl(umsatz.ziel)} €`}</span>
        </div>
        {anteil !== null ? (
          <div className="mt-4 h-2 rounded-full bg-elevated"><i className={cn('block h-full rounded-full', anteil >= 1 ? 'bg-gold' : 'bg-foreground')} style={{ width: `${anteil * 100}%` }} /></div>
        ) : (
          <p className="mt-3 text-[13px] text-muted">Noch keine Provision im CRM erfasst — die Leiste rechnet, sobald der erste Abschluss einen Wert hat.</p>
        )}
        <div className="mt-4 text-[13px] text-muted">Zahlt darauf ein · diese Woche</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-elevated px-3 py-1 text-[13px] tabular-nums">Calls {zahl(w.ist)} / {zahl(w.basis)}</span>
          {w.split.map(s => (
            <span key={s.key} className="rounded-full bg-elevated px-3 py-1 text-[13px] tabular-nums">{s.name} {zahl(s.ist)} / {zahl(s.basis)}</span>
          ))}
          <span className="rounded-full bg-elevated px-3 py-1 text-[13px] text-muted">Termine · keine Daten</span>
        </div>
      </section>

      {reise.ende && reise.tageGesamt && (
        <section className="mt-3 rounded-2xl bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Plan</span>
            <span className="text-[13px] text-muted">Tag {reise.tageVorbei} von {reise.tageGesamt}</span>
          </div>
          <div className="mt-4 flex h-2 gap-1">
            {reise.bloecke.map(b => {
              const laenge = daysBetween(b.von, b.bis) + 1;
              const voll = today > b.bis ? 1 : today < b.von ? 0 : (daysBetween(b.von, today) + 1) / laenge;
              return (
                <div key={b.nummer} className="relative overflow-hidden rounded-full bg-elevated" style={{ flex: laenge }}>
                  <i className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${voll * 100}%` }} />
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1 text-[12px] text-muted">
            {reise.bloecke.map(b => (
              <span key={b.nummer} className="truncate" style={{ flex: daysBetween(b.von, b.bis) + 1 }}>
                {daysBetween(b.von, b.bis) > 30 ? `Block ${b.nummer}` : b.nummer}
              </span>
            ))}
          </div>
        </section>
      )}

      {weitere.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-surface">
          {weitere.map((z, i) => (
            <div key={z.id} className={cn('relative px-4 py-3', i > 0 && 'before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator')}>
              <div className="font-semibold">{z.title}</div>
              <div className="text-[13px] text-muted">
                {z.horizonEnd ? `bis ${datum(z.horizonEnd.toISOString().slice(0, 10))}` : 'ohne Stichtag'}
                {z.metricKey ? '' : ' · Meilenstein'}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2.5 mt-8 text-[20px] font-semibold tracking-tight">Rekorde</h2>
      <div className="grid grid-cols-2 gap-3">
        {rekorde.serien.filter(s => s.rekord > 0).map(s => (
          <div key={s.key} className={cn('rounded-2xl bg-surface p-4', s.rekord >= GOLD_AB && 'ring-1 ring-inset ring-gold/45')}>
            <div className="text-[13px] text-muted">{s.label}</div>
            <div className={cn('mt-1.5 font-display text-[26px] font-semibold tabular-nums', s.rekord >= GOLD_AB && 'text-gold')}>
              {s.rekord}<span className="ml-1 text-[14px] font-medium text-muted">{s.rekord === 1 ? 'Tag' : 'Tage'}</span>
            </div>
            <div className="mt-0.5 text-[12px] text-muted">jetzt {s.serie}</div>
          </div>
        ))}
        <div className={cn('rounded-2xl bg-surface p-4', rekorde.perfekt.anzahl > 0 && 'ring-1 ring-inset ring-gold/45')}>
          <div className="flex items-center gap-1 text-[13px] text-muted"><Sparkles className="h-3 w-3" />Perfekte Tage</div>
          <div className={cn('mt-1.5 font-display text-[26px] font-semibold tabular-nums', rekorde.perfekt.anzahl > 0 && 'text-gold')}>{rekorde.perfekt.anzahl}</div>
          <div className="mt-0.5 text-[12px] text-muted">{rekorde.perfekt.rekord > 1 ? `${rekorde.perfekt.rekord} in Folge` : 'seit Phase 2'}</div>
        </div>
      </div>

      <h2 className="mb-2.5 mt-8 text-[20px] font-semibold tracking-tight">Einstellungen</h2>
      <div className="overflow-hidden rounded-[14px] bg-surface">
        <Gruppe titel="Tagesziele" untertitel="Training, Post, Routinen, Umsatzziel — gilt ab heute">
          <GoalsEditor data={einstellungen} />
        </Gruppe>
        <Gruppe titel="Routinen bearbeiten" untertitel="Schritte umbenennen, verschieben, ergänzen">
          <RoutinenEditor bloecke={routinen.map(r => ({ trackerId: r.trackerId, name: r.name, items: r.items.map(i => ({ id: i.id, title: i.title })) }))} />
        </Gruppe>
        <Gruppe titel="Töne beim Abhaken" untertitel="nur auf diesem Gerät">
          <ToeneSchalter />
        </Gruppe>
      </div>
    </>
  );
}

// Grenze außen, siehe „Heute".
export default function ZielePage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <div className="mx-auto w-full max-w-[760px] px-5 pb-16 pt-4">
        <Ziele />
      </div>
    </Suspense>
  );
}
