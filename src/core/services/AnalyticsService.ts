import { prisma } from '../db';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo, dateRange, isOffDay, trackedDays, addDays } from '@/lib/blocks';

/**
 * Semantic Layer — rechnet Tageswerte on-read aus den vorhandenen Quellen.
 *
 * Zentrale Invariante: **NULL ≠ 0**. Fehlt eine Quellzeile, ist der Wert `null`
 * („nicht gemessen") und niemals 0. Ein vergessener Log-Tag ist etwas anderes
 * als ein Tag mit null Calls, und die UI muss beides unterscheiden können.
 *
 * Quellen kommen aus `core_metric_sources` und werden nach `priority` abgefragt;
 * der erste Treffer gewinnt. Ein neues System anzubinden ist deshalb eine Zeile
 * in der Tabelle, kein neuer Code-Pfad hier.
 */

/**
 * `erfasst` heißt: gemessen, aber ohne hinterlegtes Soll — es gibt kein Urteil,
 * nur den Wert. Genau der Fall bei Gewicht, Schlaf oder Kalorien, für die der
 * 6-Monats-Plan bewusst kein Ziel nennt.
 */
export type MetricState = 'soll' | 'basis' | 'unter' | 'erfasst' | 'ungemessen' | 'offday';

export interface DayMetric {
  value: number | null;
  base: number | null;
  stretch: number | null;
  state: MetricState;
  /** `kind` der Quelle, die den Wert geliefert hat — für „auto aus CRM" / „manuell". */
  source: string | null;
}

export type MetricMatrix = Record<string, Record<string, DayMetric>>;

export interface MetricSummary {
  metricKey: string;
  /** Tage, an denen Basis oder Soll erreicht wurde. */
  met: number;
  /** Tage mit irgendeinem gemessenen Wert. */
  measured: number;
  /** Getrackte Tage im Zeitraum (Mo–Sa, ohne Off-Days). */
  tracked: number;
  /** met / tracked — 0…1, `null` wenn nichts zu tracken war. */
  adherence: number | null;
  /** measured / tracked — 0…1. Eine hohe Adherence bei niedriger Coverage sagt etwas anderes. */
  coverage: number | null;
  /** Aktuelle Serie erfüllter Tage, rückwärts ab `to`. Off-Days unterbrechen sie nicht. */
  streak: number;
}

/** Ein Tag darf pro Metrik nur einmal in der Map stehen. */
type DayValues = Map<string, Map<string, number>>;

type SourceConfig = Record<string, unknown>;

interface ResolvedSource {
  metricKey: string;
  kind: string;
  config: SourceConfig;
  priority: number;
}

interface PersonalLogRow {
  date: string;
  sleep_hours: number | null;
  nutrition_calories: number | null;
  nutrition_water: number | null;
  workout_completed: boolean | null;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const DEFAULT_LOOKBACK_DAYS = 45;

export class AnalyticsService {
  // ── Rohdaten pro Quellenart, jeweils in einer Abfrage über den ganzen Zeitraum ──

  private static async loadCrmCalls(from: string, to: string, userName: string): Promise<Map<string, number>> {
    // Großzügige ms-Grenzen, das Bucketing macht Postgres in Berliner Zeit.
    const fromMs = Date.parse(`${from}T00:00:00.000Z`) - 2 * 86400000;
    const toMs = Date.parse(`${to}T00:00:00.000Z`) + 3 * 86400000;

    const rows = await prisma.$queryRaw<Array<{ d: string; c: number }>>`
      SELECT to_char(to_timestamp(ts / 1000.0) AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS d,
             COUNT(*)::int AS c
      FROM crm_calls
      WHERE by_user_name = ${userName}
        AND ts >= ${fromMs} AND ts < ${toMs}
      GROUP BY 1
    `;
    return new Map(rows.map(r => [r.d, Number(r.c)]));
  }

  private static async loadTrackerLogs(from: string, to: string) {
    return prisma.$queryRaw<Array<{ tracker: string; item: string; d: string; status: string }>>`
      SELECT t.name AS tracker,
             i.title AS item,
             to_char(l.date, 'YYYY-MM-DD') AS d,
             l.status AS status
      FROM jarvis_tracker_logs l
      JOIN jarvis_tracker_items i ON i.id = l.item_id
      JOIN jarvis_trackers      t ON t.id = i.tracker_id
      WHERE l.date >= ${`${from}T00:00:00.000Z`}::timestamp
        AND l.date <= ${`${to}T23:59:59.999Z`}::timestamp
    `;
  }

  private static async loadPersonalLogs(from: string, to: string) {
    return prisma.$queryRaw<PersonalLogRow[]>`
      SELECT date, sleep_hours, nutrition_calories, nutrition_water, workout_completed
      FROM jarvis_personal_logs
      WHERE date >= ${from} AND date <= ${to}
    `;
  }

  private static async loadWeight(from: string, to: string): Promise<Map<string, number>> {
    const rows = await prisma.$queryRaw<Array<{ d: string; w: number }>>`
      SELECT to_char(date, 'YYYY-MM-DD') AS d, weight AS w
      FROM jarvis_weight_entries
      WHERE date >= ${`${from}T00:00:00.000Z`}::timestamp
        AND date <= ${`${to}T23:59:59.999Z`}::timestamp
      ORDER BY date ASC
    `;
    // Mehrere Wiegungen am Tag: die letzte gilt.
    return new Map(rows.map(r => [r.d, Number(r.w)]));
  }

  /**
   * Löst alle aktiven Quellen auf. Ergebnis: kind → metricKey → date → value.
   * Quellenarten ohne Ingest-Daten (health, reminders, gproject) liefern bewusst
   * nichts, statt einen Platzhalter zu erfinden.
   */
  private static async resolveSources(
    from: string,
    to: string,
    sources: ResolvedSource[]
  ): Promise<Map<string, DayValues>> {
    const byKind = new Map<string, DayValues>();
    const kinds = new Set(sources.map(s => s.kind));
    const put = (kind: string, metricKey: string, date: string, value: number) => {
      if (!byKind.has(kind)) byKind.set(kind, new Map());
      const perMetric = byKind.get(kind)!;
      if (!perMetric.has(metricKey)) perMetric.set(metricKey, new Map());
      perMetric.get(metricKey)!.set(date, value);
    };

    if (kinds.has('crm_calls')) {
      const today = getBerlinDateStr();
      for (const s of sources.filter(x => x.kind === 'crm_calls')) {
        const userName = str(s.config.userName);
        if (!userName) continue;
        const calls = await this.loadCrmCalls(from, to, userName);
        for (const [d, v] of calls) put('crm_calls', s.metricKey, d, v);

        // Eine lückenlose Quelle vergisst nicht: das CRM protokolliert jeden
        // Anruf, also heißt „keine Zeile" hier wirklich null Anrufe und nicht
        // „nicht gemessen". Nur für vergangene Tage — der heutige läuft noch.
        if (s.config.impliesZero === true) {
          for (const d of dateRange(from, to)) {
            if (d >= today || isOffDay(d)) continue;
            if (!calls.has(d)) put('crm_calls', s.metricKey, d, 0);
          }
        }
      }
    }

    if (kinds.has('tracker')) {
      const logs = await this.loadTrackerLogs(from, to);
      for (const s of sources.filter(x => x.kind === 'tracker')) {
        const wantTracker = str(s.config.tracker).toLowerCase();
        const wantItem = str(s.config.item).toLowerCase();
        // Ohne `item` zählt die Quelle die erledigten Schritte des Trackers
        // (Morgen-/Abendroutine); mit `item` ist sie ein einzelner Haken.
        const counting = !wantItem;
        const tally = new Map<string, number>();

        for (const log of logs) {
          if (wantTracker && log.tracker.toLowerCase() !== wantTracker) continue;
          if (wantItem && log.item.toLowerCase() !== wantItem) continue;
          if (log.status === 'skipped') continue; // bewusst übersprungen ≠ gemessen
          const done = log.status === 'completed' ? 1 : 0;
          if (counting) tally.set(log.d, (tally.get(log.d) ?? 0) + done);
          else put('tracker', s.metricKey, log.d, done);
        }

        for (const [d, v] of tally) put('tracker', s.metricKey, d, v);
      }
    }

    if (kinds.has('personal_log')) {
      const logs = await this.loadPersonalLogs(from, to);
      for (const s of sources.filter(x => x.kind === 'personal_log')) {
        const field = str(s.config.field) as keyof PersonalLogRow;
        // Die App legt Tageszeilen mit Default 0 an — 0 heißt hier „nicht ausgefüllt".
        const zeroIsNull = s.config.zeroIsNull !== false;
        for (const row of logs) {
          const raw = row[field];
          if (raw === null || raw === undefined) continue;
          const value = typeof raw === 'boolean' ? (raw ? 1 : 0) : Number(raw);
          if (Number.isNaN(value)) continue;
          if (zeroIsNull && value === 0) continue;
          put('personal_log', s.metricKey, row.date, value);
        }
      }
    }

    if (kinds.has('weight')) {
      const weights = await this.loadWeight(from, to);
      for (const s of sources.filter(x => x.kind === 'weight')) {
        for (const [d, v] of weights) put('weight', s.metricKey, d, v);
      }
    }

    return byKind;
  }

  private static stateFor(
    dateStr: string,
    value: number | null,
    base: number | null,
    stretch: number | null,
    comparator: string
  ): MetricState {
    if (isOffDay(dateStr)) return 'offday';
    if (value === null) return 'ungemessen';
    if (base === null) return 'erfasst'; // gemessen, aber ohne Soll — kein Urteil möglich

    const goal = stretch ?? base;
    const hits = (v: number, target: number) => (comparator === '<=' ? v <= target : v >= target);

    if (hits(value, goal)) return 'soll';
    if (hits(value, base)) return 'basis';
    return 'unter';
  }

  /**
   * Herzstück: Tag × Metrik mit Wert, Soll und Zustand.
   * Speist alle Kalender-, Aktivitäts- und Tagesansichten.
   */
  static async getMatrix(from: string, to: string, metricKeys?: string[]): Promise<MetricMatrix> {
    const [definitions, sources, intentions] = await Promise.all([
      prisma.coreMetricDefinition.findMany({
        where: { isActive: true, ...(metricKeys?.length ? { key: { in: metricKeys } } : {}) },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.coreMetricSource.findMany({
        where: { isActive: true, ...(metricKeys?.length ? { metricKey: { in: metricKeys } } : {}) },
        orderBy: { priority: 'asc' },
      }),
      prisma.coreIntention.findMany({
        where: {
          ...(metricKeys?.length ? { metricKey: { in: metricKeys } } : {}),
          validFrom: { lte: new Date(`${to}T00:00:00.000Z`) },
          OR: [{ validTo: null }, { validTo: { gte: new Date(`${from}T00:00:00.000Z`) } }],
        },
      }),
    ]);

    const keys = definitions.map(d => d.key);
    const relevantSources: ResolvedSource[] = sources
      .filter(s => keys.includes(s.metricKey))
      .map(s => ({
        metricKey: s.metricKey,
        kind: s.kind,
        config: (s.config ?? {}) as SourceConfig,
        priority: s.priority,
      }));
    const resolved = await this.resolveSources(from, to, relevantSources);
    const intentionOf = new Map(intentions.map(i => [i.metricKey, i]));

    const matrix: MetricMatrix = {};
    for (const date of dateRange(from, to)) {
      matrix[date] = {};

      for (const key of keys) {
        const intention = intentionOf.get(key);
        const base = intention ? intention.baseValue : null;
        const stretch = intention?.stretchValue ?? null;
        const comparator = intention?.comparator ?? '>=';

        let value: number | null = null;
        let source: string | null = null;

        // Quellen in Prioritätsreihenfolge — der erste Treffer gewinnt.
        for (const s of relevantSources) {
          if (s.metricKey !== key) continue;
          const hit = resolved.get(s.kind)?.get(key)?.get(date);
          if (hit !== undefined) {
            value = hit;
            source = s.kind;
            break;
          }
        }

        matrix[date][key] = {
          value,
          base,
          stretch,
          state: this.stateFor(date, value, base, stretch, comparator),
          source,
        };
      }
    }

    return matrix;
  }

  /**
   * Adherence, Coverage und Streak einer Metrik über einen Zeitraum.
   * `erfasst` zählt als gemessen, aber nicht als erfüllt — ohne Soll gibt es
   * nichts zu erfüllen.
   */
  static summarize(matrix: MetricMatrix, metricKey: string, from: string, to: string): MetricSummary {
    const tracked = trackedDays(from, to);
    let met = 0;
    let measured = 0;

    for (const date of tracked) {
      const cell = matrix[date]?.[metricKey];
      if (!cell || cell.value === null) continue;
      measured++;
      if (cell.state === 'soll' || cell.state === 'basis') met++;
    }

    // Streak rückwärts ab `to`; Off-Days werden übersprungen, nicht gewertet.
    let streak = 0;
    for (let d = to; d >= from; d = addDays(d, -1)) {
      if (isOffDay(d)) continue;
      const cell = matrix[d]?.[metricKey];
      if (cell && (cell.state === 'soll' || cell.state === 'basis')) streak++;
      else if (d === to && (!cell || cell.value === null)) continue; // heute noch offen
      else break;
    }

    return {
      metricKey,
      met,
      measured,
      tracked: tracked.length,
      adherence: tracked.length ? met / tracked.length : null,
      coverage: tracked.length ? measured / tracked.length : null,
      streak,
    };
  }

  /** Heutiger Tag inklusive Blockposition und Kennzahlen des laufenden Blocks. */
  static async getToday(dateStr: string = getBerlinDateStr()) {
    const block = blockInfo(dateStr);
    const from = block.beforeStart ? addDays(dateStr, -DEFAULT_LOOKBACK_DAYS) : block.blockStart;

    const matrix = await this.getMatrix(from, dateStr);
    const keys = Object.keys(matrix[dateStr] ?? {});

    return {
      date: dateStr,
      block,
      today: matrix[dateStr] ?? {},
      summaries: Object.fromEntries(keys.map(k => [k, this.summarize(matrix, k, from, dateStr)])),
    };
  }

  /** Ziele — inklusive der bewusst zielwertlosen („Messphase"). */
  static async getGoals() {
    return prisma.coreGoal.findMany({ orderBy: { createdAt: 'asc' } });
  }

  /** Laufende Soll-Werte, wie sie die Einstellungen bearbeiten. */
  static async getIntentions() {
    return prisma.coreIntention.findMany({
      where: { validTo: null },
      include: { metric: true },
      orderBy: { metric: { sortOrder: 'asc' } },
    });
  }
}
