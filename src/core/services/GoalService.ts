import { prisma } from '@/lib/prisma';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { getBerlinDateStr } from '@/lib/dateUtils';

/**
 * Alles, was der Reiter „Ziele" zeigt — und woher es kommt.
 *
 * Drei Besitzer, drei Regeln:
 * - **Jarvis** (`core_intentions`, `core_goals`): hier bearbeitbar.
 * - **CRM** (`crm_metric_targets`): nur gezeigt, bearbeitet wird im CRM.
 * - **Apple Health** (`ingest_health_targets`): Kalorien- und Gewichtsziel nur
 *   gezeigt, sie kommen per Kurzbefehl. Die Toleranz darum gehört aber Jarvis.
 *
 * Was hier als „gilt heute" steht, kommt aus derselben Matrix wie das
 * Dashboard — die Seite rechnet kein Ziel selbst nach.
 */

/** Was im Reiter bearbeitet werden darf — alles andere ist Anzeige. */
export const EDITABLE = {
  fixed: ['body.sleep_hours', 'training.sessions', 'content.posts'],
  routine: ['routine.morning', 'routine.evening'],
  tolerance: { 'body.calories': 'tolerancePct', 'body.weight': 'toleranceKg' },
} as const;

const CRM_KEYS = ['sales.calls_count', 'sales.calls_cold_gross', 'sales.calls_cold_tarif', 'sales.calls_followup'];

/** Der Umsatz ist ein Ergebnis-Ziel (kumulativ bis Stichtag), kein Tagesziel. */
export const REVENUE_METRIC = 'sales.closed_value_eur';

const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export interface RevenueGoal {
  /** `null` heißt: kein Ziel hinterlegt — nie als 0 € darstellen. */
  amount: number | null;
  until: string | null;
}

export class GoalService {
  static async getRevenueGoal(): Promise<RevenueGoal> {
    const goal = await prisma.coreGoal.findFirst({ where: { metricKey: REVENUE_METRIC } });
    const amount = goal?.targetValue != null ? Number(goal.targetValue) : null;
    return {
      amount: amount !== null && Number.isFinite(amount) ? amount : null,
      until: dateStr(goal?.horizonEnd ?? null),
    };
  }

  static async getGoalsPage() {
    const today = getBerlinDateStr();

    // Nacheinander — eine Pooler-Verbindung (siehe Dashboard).
    const matrix = await AnalyticsService.getMatrix(today, today);
    const intentions = await prisma.coreIntention.findMany({
      where: { validTo: null },
      include: { metric: true },
      orderBy: { metric: { sortOrder: 'asc' } },
    });
    const trackers = await prisma.tracker.findMany({
      where: { type: 'routine' },
      select: { name: true, _count: { select: { items: { where: { archivedOn: null } } } } },
    });
    const healthTargets = await prisma.ingestHealthTarget.findMany();
    const revenue = await this.getRevenueGoal();

    const byKey = new Map(intentions.map(i => [i.metricKey, i]));
    const cell = (key: string) => matrix[today]?.[key];
    const since = (key: string) => dateStr(byKey.get(key)?.validFrom ?? null);
    const config = (key: string) => (byKey.get(key)?.derivedConfig ?? {}) as Record<string, unknown>;
    const label = (key: string) => byKey.get(key)?.metric.label ?? key;
    const unit = (key: string) => byKey.get(key)?.metric.unit ?? '';

    const fixed = EDITABLE.fixed.flatMap(key => {
      const i = byKey.get(key);
      if (!i) return [];
      return [{
        metricKey: key,
        label: label(key),
        unit: unit(key),
        base: i.baseValue,
        stretch: i.stretchValue,
        since: since(key),
      }];
    });

    const routines = EDITABLE.routine.flatMap(key => {
      const i = byKey.get(key);
      if (!i) return [];
      const tracker = String(config(key).tracker ?? '');
      const total = trackers.find(t => t.name.toLowerCase() === tracker.toLowerCase())?._count.items ?? 0;
      const maxSkip = config(key).maxSkip;
      return [{
        metricKey: key,
        label: label(key),
        total,
        maxSkip: typeof maxSkip === 'number' ? maxSkip : null,
        since: since(key),
      }];
    });

    // Seit Phase 2 ohne laufendes Ziel → `null`, der Reiter zeigt dann nichts
    // zum Einstellen an, was gar nicht mehr bewertet wird.
    const health = (key: 'body.calories' | 'body.weight') => {
      if (!byKey.has(key)) return null;
      const t = healthTargets.find(h => h.metricKey === key);
      const c = cell(key);
      const field = EDITABLE.tolerance[key];
      const tol = config(key)[field];
      return {
        metricKey: key,
        label: label(key),
        unit: unit(key),
        field,
        tolerance: typeof tol === 'number' ? tol : null,
        since: since(key),
        source: t ? { target: t.targetValue, until: dateStr(t.targetDate), start: t.startValue } : null,
        today: c ? { base: c.base, stretch: c.stretch, hint: c.targetHint } : null,
      };
    };

    const crm = CRM_KEYS.map(key => {
      const c = cell(key);
      return {
        metricKey: key,
        label: label(key),
        base: c?.base ?? null,
        stretch: c?.stretch ?? null,
        hint: c?.targetHint,
      };
    });

    // Regeln: Ziel ist immer „gehalten", an allen sieben Tagen. Nur Anzeige.
    const rules = intentions
      .filter(i => i.metric.domain === 'rules' && i.metric.isActive)
      .map(i => ({
        metricKey: i.metricKey,
        label: i.metric.label,
        weekdays: i.activeWeekdays.length,
        since: dateStr(i.validFrom),
      }));

    return {
      today,
      fixed,
      routines,
      rules,
      calories: health('body.calories'),
      weight: health('body.weight'),
      crm,
      revenue,
    };
  }
}

export type GoalsPageData = Awaited<ReturnType<typeof GoalService.getGoalsPage>>;
