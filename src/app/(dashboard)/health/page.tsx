import { Suspense } from 'react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { WeightService } from '@/core/services/WeightService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo } from '@/lib/blocks';
import { MetricCard } from '@/components/today/MetricCard';
import { ActivityGrid } from '@/components/today/ActivityGrid';
import { BodyLogCard } from '@/components/today/BodyLogCard';

export const dynamic = 'force-dynamic';

const METRICS = [
  { key: 'training.sessions', label: 'Training', sub: '1 × Mo–Sa' },
  { key: 'routine.morning', label: 'Morgen', sub: 'Routine' },
  { key: 'routine.evening', label: 'Abend', sub: 'Routine' },
  { key: 'body.sleep_hours', label: 'Schlaf', sub: 'Stunden' },
  { key: 'body.calories', label: 'Kalorien', sub: 'kcal' },
  { key: 'body.weight', label: 'Gewicht', sub: 'kg' },
];

function lastDayOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
}

async function Health() {
  const today = getBerlinDateStr();
  const block = blockInfo(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = lastDayOfMonth(today);
  const summaryFrom = block.beforeStart ? monthStart : block.blockStart;
  const from = summaryFrom < monthStart ? summaryFrom : monthStart;

  const matrix = await AnalyticsService.getMatrix(from, monthEnd, METRICS.map(m => m.key));
  // Ein Gewicht veraltet langsam — die letzte Wiegung gilt, auch wenn sie
  // außerhalb des angezeigten Monats liegt.
  const lastWeight = await WeightService.getLatest();

  const summaries = Object.fromEntries(
    METRICS.map(m => [m.key, AnalyticsService.summarize(matrix, m.key, summaryFrom, today)])
  );

  const training = matrix[today]?.['training.sessions'];
  const sleep = matrix[today]?.['body.sleep_hours'];
  const weight = matrix[today]?.['body.weight'];

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">Health</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">
        Fundament. Wird getrackt, unabhängig vom Vertriebsplan.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          title="Training"
          source="manuell"
          value={training?.value ?? null}
          base={training?.base ?? null}
          stretch={training?.stretch ?? null}
          unit="count"
          state={training?.state ?? 'ungemessen'}
          footLeft="inkl. Basketball"
          footRight={`Streak ${summaries['training.sessions']?.streak ?? 0}`}
        />

        <div className="md:col-span-2">
          <BodyLogCard
            date={today}
            sleepHours={sleep?.value ?? null}
            weight={weight?.value ?? null}
            calories={matrix[today]?.['body.calories']?.value ?? null}
            caloriesConnected={matrix[today]?.['body.calories']?.source === 'health'}
            lastWeight={lastWeight}
          />
        </div>
      </div>

      <div className="mt-3">
        <ActivityGrid
          matrix={matrix}
          metrics={METRICS}
          summaries={summaries}
          from={monthStart}
          to={monthEnd}
          today={today}
        />
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
        Schlaf, Kalorien und Gewicht haben bewusst keinen Zielwert — der 6-Monats-Plan nennt
        keinen. Sie erscheinen deshalb als <span className="text-foreground">erfasst</span> statt
        als erfüllt oder verfehlt.
      </p>
    </>
  );
}

export default function HealthPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border/30 bg-elevated/30" />}>
        <Health />
      </Suspense>
    </div>
  );
}
