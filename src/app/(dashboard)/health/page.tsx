import { Suspense } from 'react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo } from '@/lib/blocks';
import { PHASES, currentPhase, evaluationStart } from '@/lib/phases';
import { MetricCard } from '@/components/today/MetricCard';
import { ActivityGrid } from '@/components/today/ActivityGrid';
import { EMPTY_METRIC, targetSub } from '@/lib/metricState';
import { RouteLoading } from '@/components/layout/RouteLoading';

export const dynamic = 'force-dynamic';

/** `sub` wird aus den echten Soll-Werten gebildet — siehe `targetSub`. */
const FUNDAMENT = [
  { key: 'training.sessions', label: 'Training', title: 'Training', foot: 'inkl. Basketball' },
  { key: 'routine.morning', label: 'Morgen', title: 'Morgenroutine', foot: 'Schritte' },
  { key: 'routine.evening', label: 'Abend', title: 'Abendroutine', foot: 'Schritte' },
];

function lastDayOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
}

const shortDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

/**
 * Health in Phase 2: Training, Routinen und Regeln — das, was jeden Tag
 * bewertet wird. Schlaf, Kalorien und Gewicht sind seit dem Phasenwechsel
 * ohne Ziel; ihre Werte bleiben im Verlauf und für ChatGPT lesbar, stehen
 * hier aber nicht mehr als Fläche, die jeden Tag gefüllt werden will.
 */
async function Health() {
  const today = getBerlinDateStr();
  const block = blockInfo(today);
  const phase = currentPhase(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = lastDayOfMonth(today);
  const summaryFrom = evaluationStart(block.beforeStart ? monthStart : block.blockStart, today);
  const from = summaryFrom < monthStart ? summaryFrom : monthStart;

  const rules = (await AnalyticsService.getDefinitions()).filter(d => d.domain === 'rules' && d.isActive);
  const keys = [...FUNDAMENT.map(m => m.key), ...rules.map(r => r.key)];
  const matrix = await AnalyticsService.getMatrix(from, monthEnd, keys);

  const summaries = Object.fromEntries(
    keys.map(key => [key, AnalyticsService.summarize(matrix, key, summaryFrom, today)])
  );

  const cell = (key: string) => matrix[today]?.[key] ?? EMPTY_METRIC;
  const gridMetrics = [
    ...FUNDAMENT.map(m => ({ key: m.key, label: m.label, sub: targetSub(cell(m.key)) })),
    ...rules.map(r => ({ key: r.key, label: r.label, sub: 'jeden Tag', since: phase?.von })),
  ];

  const previous = phase ? PHASES.find(p => p.nummer === phase.nummer - 1) : undefined;

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">Health</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">
        Fundament: Training, Routinen und Regeln{phase && <> · Phase {phase.nummer} seit {shortDate(phase.von)}</>}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {FUNDAMENT.map(m => {
          const c = cell(m.key);
          const s = summaries[m.key];
          return (
            <MetricCard
              key={m.key}
              title={m.title}
              source="manuell"
              value={c.value}
              base={c.base}
              stretch={c.stretch}
              unit="count"
              state={c.state}
              targetHint={c.targetHint}
              footLeft={m.foot}
              footRight={`Streak ${s?.streak ?? 0}`}
            />
          );
        })}
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

      {previous && (
        <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
          <span className="text-foreground">Phase {previous.nummer} · {previous.name}</span> (
          {shortDate(previous.von)}–{shortDate(previous.bis!)}) hat zusätzlich Schlaf, Kalorien und
          Gewicht bewertet. Seit Phase {phase!.nummer} sind die drei ohne Ziel: was Apple Health noch
          liefert, steht im Verlauf als <span className="text-foreground">erfasst</span>, die Wochen davor
          bleiben vollständig lesbar — auch für ChatGPT. Quoten und Serien zählen ab dem Phasenstart.
        </p>
      )}
    </>
  );
}

export default function HealthPage() {
  // Grenze außen, siehe Dashboard.
  return (
    <Suspense fallback={<RouteLoading />}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
        <Health />
      </div>
    </Suspense>
  );
}
