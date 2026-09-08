import { Suspense } from 'react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { CrmService } from '@/core/services/CrmService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo, blockWeekRange, trackedDays } from '@/lib/blocks';
import { MetricCard } from '@/components/today/MetricCard';
import { ActivityGrid } from '@/components/today/ActivityGrid';

export const dynamic = 'force-dynamic';

const CALLS = 'sales.calls_count';

function lastDayOfMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
}

/** Trichter über die Stufen, wie das CRM sie führt — Jarvis baut keine eigenen. */
function Funnel({ stages }: { stages: Array<{ label: string; count: number; tone: 'cold' | 'open' | 'won' }> }) {
  const max = Math.max(...stages.map(s => s.count), 1);
  return (
    <div className="flex flex-col gap-1">
      {stages.map(s => (
        <div key={s.label} className="flex items-center gap-2.5 text-xs">
          <span className="w-20 shrink-0 text-right text-muted">{s.label}</span>
          <span
            className={
              'h-5 rounded border ' +
              (s.tone === 'won'
                ? 'border-emerald-500/30 bg-emerald-500/15'
                : s.tone === 'cold'
                  ? 'border-border/60 bg-white/[0.05]'
                  : 'border-accent/30 bg-accent/15')
            }
            style={{ width: `${Math.max(3, (s.count / max) * 100)}%` }}
          />
          <span className="font-mono tabular-nums">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

async function Vertrieb() {
  const today = getBerlinDateStr();
  const block = blockInfo(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = lastDayOfMonth(today);
  const summaryFrom = block.beforeStart ? monthStart : block.blockStart;
  const from = summaryFrom < monthStart ? summaryFrom : monthStart;

  const matrix = await AnalyticsService.getMatrix(from, monthEnd, [CALLS]);
  const pipeline = await CrmService.getPipeline();

  const cell = matrix[today]?.[CALLS];
  const summary = AnalyticsService.summarize(matrix, CALLS, summaryFrom, today);

  const [weekFrom, weekTo] = blockWeekRange(today);
  const weekDays = trackedDays(weekFrom, weekTo);
  const weekActual = weekDays.reduce((sum, d) => sum + (matrix[d]?.[CALLS]?.value ?? 0), 0);
  const weekGoal = weekDays.length * (cell?.stretch ?? cell?.base ?? 0);

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">Vertrieb</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">
        Kennzahlen kommen aus dem CRM — Jarvis liest sie, statt sie nachzubauen.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          title="Calls heute"
          source="CRM"
          value={cell?.value ?? null}
          base={cell?.base ?? null}
          stretch={cell?.stretch ?? null}
          unit="count"
          state={cell?.state ?? 'ungemessen'}
          footLeft="Ziel aus CRM-Profil"
        />

        <MetricCard
          title="Diese Blockwoche"
          value={weekActual}
          base={null}
          stretch={weekGoal || null}
          unit="count"
          state={weekGoal && weekActual >= weekGoal ? 'soll' : weekActual > 0 ? 'unter' : 'unter'}
          footLeft={`${weekDays.length} getrackte Tage`}
          footRight={`${summary.met}/${summary.tracked} Tage im Block`}
        />

        <div className="crm-card h-full">
          <div className="crm-header">
            <h3 className="crm-title">Conversion</h3>
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
              Messphase
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            Wird noch ermittelt. Solange keine Baseline steht, gibt es hier bewusst keine
            Prozentzahl — sie wäre gegen ein Ziel gerechnet, das noch nicht existiert.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="crm-card">
          <div className="crm-header">
            <h3 className="crm-title">Pipeline</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted">crm_leads.stage</span>
          </div>
          {pipeline.stages.length > 0 ? (
            <>
              <Funnel stages={pipeline.stages} />
              <p className="mt-4 border-t border-border/40 pt-3 text-[11px] text-muted">
                Kaltkartei liegt außerhalb der Pipeline. {pipeline.mine} Leads sind dir zugewiesen.
              </p>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted">
              Das CRM ist gerade nicht erreichbar. Die Stufen erscheinen wieder, sobald es
              antwortet — hier steht bewusst keine veraltete Zahl.
            </p>
          )}
        </div>

        <div className="crm-card">
          <div className="crm-header">
            <h3 className="crm-title">Umsatzziel</h3>
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-500">
              pending
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            Kein Zielwert gesetzt, solange die Messphase läuft. Das ursprüngliche Ziel von
            10.000 € pro Monat wurde nicht erreicht, eine Neu-Datierung steht offen.
          </p>
          <p className="mt-auto border-t border-border/40 pt-3 text-[11px] text-muted">
            Wird bewusst <span className="text-foreground">nicht</span> als 0 % eines unsichtbaren
            Ziels dargestellt.
          </p>
        </div>
      </div>

      <div className="mt-3">
        <ActivityGrid
          matrix={matrix}
          metrics={[{ key: CALLS, label: 'Calls', sub: 'Basis 30 · Soll 60' }]}
          summaries={{ [CALLS]: summary }}
          from={monthStart}
          to={monthEnd}
          today={today}
          title="Calls im Monat"
        />
      </div>
    </>
  );
}

export default function VertriebPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-border/30 bg-elevated/30" />}>
        <Vertrieb />
      </Suspense>
    </div>
  );
}
