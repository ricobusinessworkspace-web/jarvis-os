import { Suspense } from 'react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { TaskInboxService } from '@/core/services/TaskInboxService';
import { RoutineService } from '@/core/services/RoutineService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo, BLOCK_WEEKS } from '@/lib/blocks';
import { MetricCard } from '@/components/today/MetricCard';
import { CausesCard, type CauseRow } from '@/components/today/CausesCard';
import { TaskInbox } from '@/components/today/TaskInbox';
import { ActivityGrid } from '@/components/today/ActivityGrid';
import { RoutineCard } from '@/components/today/RoutineCard';

export const dynamic = 'force-dynamic';

const URSACHEN = [
  { key: 'sales.calls_count', label: 'Calls', sub: 'Basis 30 · Soll 60' },
  { key: 'training.sessions', label: 'Training', sub: '1 × Mo–Sa' },
  { key: 'content.posts', label: 'Post', sub: '1 × Mo–Sa' },
];

function lastDayOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
}

function CardSkeleton({ className = '' }: { className?: string }) {
  return <div className={`min-h-[150px] animate-pulse rounded-2xl border border-border/30 bg-elevated/30 ${className}`} />;
}

async function Today() {
  const today = getBerlinDateStr();
  const block = blockInfo(today);

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = lastDayOfMonth(today);
  const summaryFrom = block.beforeStart ? monthStart : block.blockStart;
  const from = summaryFrom < monthStart ? summaryFrom : monthStart;

  const [matrix, crmTasks, notes, routines] = await Promise.all([
    AnalyticsService.getMatrix(from, monthEnd),
    TaskInboxService.getCrmTasks(),
    TaskInboxService.getNotesTasks(),
    RoutineService.getRoutineBlocks(today),
  ]);

  const summaries = Object.fromEntries(
    URSACHEN.map(m => [m.key, AnalyticsService.summarize(matrix, m.key, summaryFrom, today)])
  );

  const cell = (key: string) => matrix[today]?.[key];
  const calls = cell('sales.calls_count');
  const calories = cell('body.calories');

  const causeRows: CauseRow[] = URSACHEN.map(m => {
    const c = cell(m.key);
    const s = summaries[m.key];
    return {
      metricKey: m.key,
      label: m.label === 'Post' ? 'Personal Brand Post' : m.label === 'Training' ? 'Trainingseinheit' : m.label,
      value: c?.value ?? null,
      base: c?.base ?? null,
      stretch: c?.stretch ?? null,
      state: c?.state ?? 'ungemessen',
      source: c?.source ?? null,
      streak: s?.streak ?? 0,
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
          </>
        )}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          title="Calls"
          source="CRM"
          value={calls?.value ?? null}
          base={calls?.base ?? null}
          stretch={calls?.stretch ?? null}
          unit="count"
          state={calls?.state ?? 'ungemessen'}
          footLeft="Ziel aus CRM-Profil"
          footRight={callsWeek ? `${callsWeek.met}/${callsWeek.tracked} Tage im Block` : undefined}
        />

        <MetricCard
          title="Kalorien"
          source="Health"
          value={calories?.value ?? null}
          base={calories?.base ?? null}
          stretch={calories?.stretch ?? null}
          unit="kcal"
          state={calories?.state ?? 'ungemessen'}
          emptyHint="Apple Health ist noch nicht angebunden. Sobald der iOS-Kurzbefehl läuft, landen die Kalorien aus Cronometer hier."
        />

        <CausesCard rows={causeRows} date={today} />
      </div>

      {routines.length > 0 && (
        <div className="mt-3">
          <RoutineCard blocks={routines} date={today} />
        </div>
      )}

      <div className="mt-3">
        <TaskInbox crmTasks={crmTasks} notesConnected={notes.connected} />
      </div>

      <div className="mt-3">
        <ActivityGrid
          matrix={matrix}
          metrics={URSACHEN}
          summaries={summaries}
          from={monthStart}
          to={monthEnd}
          today={today}
        />
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <Suspense
        fallback={
          <div className="space-y-3">
            <CardSkeleton className="h-16 min-h-0" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        }
      >
        <Today />
      </Suspense>
    </div>
  );
}
