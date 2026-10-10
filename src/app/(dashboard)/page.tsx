import { Suspense } from 'react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { ausblick } from '@/core/services/MotivationService';
import { TaskInboxService } from '@/core/services/TaskInboxService';
import { RoutineService } from '@/core/services/RoutineService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo, BLOCK_WEEKS } from '@/lib/blocks';
import { MetricCard } from '@/components/today/MetricCard';
import { CausesCard, type CauseRow } from '@/components/today/CausesCard';
import { TaskInbox } from '@/components/today/TaskInbox';
import { ActivityGrid } from '@/components/today/ActivityGrid';
import { RoutineCard } from '@/components/today/RoutineCard';
import { RulesCard, type RuleRow } from '@/components/today/RulesCard';
import { currentPhase, evaluationStart } from '@/lib/phases';
import { EMPTY_METRIC, targetSub } from '@/lib/metricState';
import { RouteLoading } from '@/components/layout/RouteLoading';

export const dynamic = 'force-dynamic';

/** `sub` wird aus den echten Soll-Werten gebildet — siehe `targetSub`. */
const URSACHEN = [
  { key: 'sales.calls_count', label: 'Calls' },
  { key: 'training.sessions', label: 'Training' },
  { key: 'content.posts', label: 'Post' },
];

function lastDayOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
}

async function Today() {
  const today = getBerlinDateStr();
  const block = blockInfo(today);

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = lastDayOfMonth(today);
  // Quoten zählen ab Beginn der laufenden Phase: der Systemwechsel soll nicht
  // in die neue Quote hineinrechnen. Serien laufen über den Schnitt weiter.
  const phase = currentPhase(today);
  const blockFrom = block.beforeStart ? monthStart : block.blockStart;
  const summaryFrom = evaluationStart(blockFrom, today);
  // Geladen wird ab Blockstart: Serien laufen über den Phasenschnitt hinweg.
  const from = blockFrom < monthStart ? blockFrom : monthStart;

  // Nacheinander, nicht parallel: der Supabase-Pooler gibt pro Instanz genau
  // eine Verbindung (connection_limit=1). Ein Promise.all lässt die Abfragen
  // um diese eine Verbindung konkurrieren und in den Pool-Timeout laufen.
  const matrix = await AnalyticsService.getMatrix(from, monthEnd);
  const crmTasks = await TaskInboxService.getCrmTasks();
  const reminders = await TaskInboxService.getReminders();
  const routines = await RoutineService.getRoutineBlocks(today);
  // Welche Regeln es gibt, steht in der Datenbank (Domäne `rules`), nicht hier.
  const rules = (await AnalyticsService.getDefinitions()).filter(d => d.domain === 'rules' && d.isActive);

  const ruleKeys = new Set(rules.map(r => r.key));
  const summaries = Object.fromEntries(
    [...URSACHEN.map(m => m.key), ...ruleKeys].map(key => [
      key,
      AnalyticsService.summarize(matrix, key, summaryFrom, today, {
        streakFrom: from,
        missIsFinal: ruleKeys.has(key), // ein Rückfall steht sofort fest
      }),
    ])
  );

  const cell = (key: string) => matrix[today]?.[key] ?? EMPTY_METRIC;

  // Die Basis der Routine kommt aus der Metrik (`maxSkip` in der Intention).
  const routineBlocks = routines.map(b => {
    const m = cell(`routine.${b.kind}`);
    return { ...b, base: m.base, targetHint: m.targetHint };
  });
  const calls = cell('sales.calls_count');

  // Beschriftungen kommen aus den echten Zielen, nicht aus fest getipptem Text.
  const gridMetrics = [
    ...URSACHEN.map(m => ({ ...m, sub: targetSub(cell(m.key)) })),
    // Regeln gibt es erst seit Phase 2 — davor ist eine leere Zelle kein
    // „nicht gemessen", sondern „gab es noch nicht".
    ...rules.map(r => ({ key: r.key, label: r.label, sub: 'jeden Tag', since: phase?.von })),
  ];

  // Serie für beide Fälle des heutigen Hakens — der Browser wählt beim
  // Antippen nur aus, er zählt nicht selbst.
  const ausblickFuer = (key: string) => ausblick(matrix, key, today, { serieAb: from, regel: ruleKeys.has(key) });

  const ruleRows: RuleRow[] = rules.map(r => {
    const s = summaries[r.key];
    return {
      ausblick: ausblickFuer(r.key),
      metricKey: r.key,
      label: r.label,
      state: cell(r.key).state,
      streak: s?.streak ?? 0,
      bestStreak: s?.bestStreak ?? 0,
      adherence: s?.adherence ?? null,
      // Regeln kennen nur 1 und 0 — jeder gemessene, nicht erfüllte Tag ist ein Rückfall.
      broken: s ? s.measured - s.met : 0,
    };
  });

  const causeRows: CauseRow[] = URSACHEN.map(m => {
    const c = cell(m.key);
    const s = summaries[m.key];
    return {
      ausblick: ausblickFuer(m.key),
      metricKey: m.key,
      label: m.label === 'Post' ? 'Personal Brand Post' : m.label === 'Training' ? 'Trainingseinheit' : m.label,
      state: c.state,
      source: c.source,
      streak: s?.streak ?? 0,
      bestStreak: s?.bestStreak ?? 0,
      adherence: s?.adherence ?? null,
      coverage: s?.coverage ?? null,
      // Calls kommen aus dem CRM und werden nicht von Hand abgehakt.
      toggleable: m.key !== 'sales.calls_count',
    };
  });

  const dateLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  const callsWeek = summaries['sales.calls_count'];

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">{dateLabel}</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">
        {block.beforeStart ? (
          <>Block 1 startet am {block.blockStart}</>
        ) : (
          <>
            Block <span className="text-foreground">{block.blockNumber}</span> · Woche{' '}
            <span className="text-foreground">{block.weekOfBlock}</span> von {BLOCK_WEEKS} · noch{' '}
            <span className="text-foreground">{block.daysRemaining} Tage</span>
            {block.isOffDay && ' · Off-Day'}
            {phase && (
              <>
                {' · '}Phase <span className="text-foreground">{phase.nummer}</span>
              </>
            )}
          </>
        )}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          title="Calls"
          source="CRM"
          value={calls.value}
          base={calls.base}
          stretch={calls.stretch}
          unit="count"
          state={calls.state}
          targetHint={calls.targetHint}
          footLeft="Ziel aus CRM-Profil"
          footRight={
            // Am ersten Tag einer Phase ist noch kein Tag abgeschlossen — dann nichts statt „0/0".
            callsWeek?.targeted
              ? `${callsWeek.met}/${callsWeek.targeted} Tage ${phase ? `in Phase ${phase.nummer}` : 'im Block'}`
              : undefined
          }
        />

        <CausesCard rows={causeRows} date={today} />

        {ruleRows.length > 0 && <RulesCard rows={ruleRows} date={today} since={summaryFrom} />}
      </div>

      {routineBlocks.length > 0 && (
        <div className="mt-3">
          <RoutineCard blocks={routineBlocks} date={today} />
        </div>
      )}

      <div className="mt-3">
        <TaskInbox
          crmTasks={crmTasks}
          reminders={reminders.items}
          remindersConnected={reminders.connected}
        />
      </div>

      <div className="mt-3">
        <ActivityGrid
          matrix={matrix}
          metrics={gridMetrics}
          summaries={summaries}
          from={monthStart}
          to={monthEnd}
          today={today}
        />
      </div>
    </>
  );
}

// Die Grenze liegt außen: der Ladezustand ersetzt den ganzen Inhaltsbereich
// und steht damit an derselben Stelle wie der Ball beim Reiter-Wechsel.
export default function DashboardPage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
        <Today />
      </div>
    </Suspense>
  );
}
