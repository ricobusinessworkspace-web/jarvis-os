import { Suspense } from 'react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { WeightService } from '@/core/services/WeightService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo } from '@/lib/blocks';
import { MetricCard } from '@/components/today/MetricCard';
import { ActivityGrid } from '@/components/today/ActivityGrid';
import { BodyLogCard } from '@/components/today/BodyLogCard';
import { EMPTY_METRIC, targetSub } from '@/lib/metricState';

export const dynamic = 'force-dynamic';

/** `sub` wird aus den echten Soll-Werten gebildet — siehe `targetSub`. */
const METRICS = [
  { key: 'training.sessions', label: 'Training', unit: 'count' },
  { key: 'routine.morning', label: 'Morgen', unit: 'count' },
  { key: 'routine.evening', label: 'Abend', unit: 'count' },
  { key: 'body.sleep_hours', label: 'Schlaf', unit: 'hours' },
  { key: 'body.calories', label: 'Kalorien', unit: 'kcal' },
  { key: 'body.weight', label: 'Gewicht', unit: 'kg' },
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

  const cell = (key: string) => matrix[today]?.[key] ?? EMPTY_METRIC;
  const training = cell('training.sessions');
  const gridMetrics = METRICS.map(m => ({ ...m, sub: targetSub(cell(m.key), m.unit) }));

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
          value={training.value}
          base={training.base}
          stretch={training.stretch}
          unit="count"
          state={training.state}
          targetHint={training.targetHint}
          footLeft="inkl. Basketball"
          footRight={`Streak ${summaries['training.sessions']?.streak ?? 0}`}
        />

        <div className="md:col-span-2">
          <BodyLogCard
            date={today}
            sleep={cell('body.sleep_hours')}
            weight={cell('body.weight')}
            calories={cell('body.calories')}
            lastWeight={lastWeight}
          />
        </div>
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

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
        Ziele kommen von dort, wo sie hingehören: Schlaf ist dein eigener Wert und in den
        Einstellungen änderbar, Kalorien- und Gewichtsziel liest Jarvis aus Cronometer, und
        wie viel eine Routine ist, sagen ihre Pflichtschritte. Lässt sich eins davon gerade
        nicht auflösen, steht dort <span className="text-foreground">Ziel fehlt</span> samt
        Grund — nie eine erfundene Zahl.
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
