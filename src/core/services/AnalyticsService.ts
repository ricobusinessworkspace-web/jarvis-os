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


const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Der Semantic Layer ist winzig (unter 30 Zeilen) und ändert sich nur, wenn
 * du ein Soll bearbeitest. Ihn bei jedem Seitenaufruf dreimal abzufragen
 * kostet über den Pooler mehr als der ganze Rest — also kurz cachen.
 */
type SemanticConfig = {
  definitions: Awaited<ReturnType<typeof prisma.coreMetricDefinition.findMany>>;
  sources: Awaited<ReturnType<typeof prisma.coreMetricSource.findMany>>;
  intentions: Awaited<ReturnType<typeof prisma.coreIntention.findMany>>;
};

let configCache: { at: number; value: SemanticConfig } | null = null;
const CONFIG_TTL_MS = 30_000;

/** Nach jeder Änderung an Metriken, Quellen oder Soll-Werten aufrufen. */
export function invalidateSemanticConfig() {
  configCache = null;
}

async function loadSemanticConfig(): Promise<SemanticConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;

  const definitions = await prisma.coreMetricDefinition.findMany({ orderBy: { sortOrder: 'asc' } });
  const sources = await prisma.coreMetricSource.findMany({ orderBy: { priority: 'asc' } });
  const intentions = await prisma.coreIntention.findMany();

  const value = { definitions, sources, intentions };
  configCache = { at: Date.now(), value };
  return value;
}

/**
 * Fremde Tabellen (`crm_*`) gehören einer anderen Anwendung. Fällt sie aus
 * oder ändert ihr Schema, darf das Dashboard nicht mit einer leeren Seite
 * antworten — die Metrik steht dann eben auf „nicht gemessen".
 */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[AnalyticsService] Quelle "${label}" nicht verfügbar:`, error);
    return fallback;
  }
}

const DEFAULT_LOOKBACK_DAYS = 45;

export class AnalyticsService {
  // ── Rohdaten pro Quellenart, jeweils in einer Abfrage über den ganzen Zeitraum ──

  /**
   * Alle Tageswerte in **einer** Abfrage.
   *
   * Prisma packt über den pgbouncer jede Abfrage in BEGIN/DEALLOCATE/COMMIT —
   * vier Round-Trips pro Aufruf. Fünf getrennte Quellabfragen kosteten damit
   * mehr als eine Sekunde, obwohl die Daten winzig sind. Ein UNION ALL mit
   * Kennzeichnungsspalte macht daraus einen Round-Trip.
   */
  private static async loadAllRows(from: string, to: string) {
    const fromTs = `${from}T00:00:00.000Z`;
    const toTs = `${to}T23:59:59.999Z`;
    const fromMs = Date.parse(`${from}T00:00:00.000Z`) - 2 * 86400000;
    const toMs = Date.parse(`${to}T00:00:00.000Z`) + 3 * 86400000;

    return prisma.$queryRaw<
      Array<{ kind: string; k1: string; k2: string; d: string; value: number }>
    >`
      SELECT 'crm_calls' AS kind, by_user_name AS k1, '' AS k2,
             to_char(to_timestamp(ts / 1000.0) AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS d,
             COUNT(*)::float8 AS value
        FROM crm_calls
       WHERE ts >= ${fromMs} AND ts < ${toMs} AND by_user_name IS NOT NULL
       GROUP BY 1, 2, 3, 4

      UNION ALL
      SELECT 'tracker', t.name, i.title,
             to_char(l.date, 'YYYY-MM-DD'),
             (l.status = 'completed')::int::float8
        FROM jarvis_tracker_logs l
        JOIN jarvis_tracker_items i ON i.id = l.item_id
        JOIN jarvis_trackers      t ON t.id = i.tracker_id
       WHERE l.date >= ${fromTs}::timestamp AND l.date <= ${toTs}::timestamp
         AND l.status <> 'skipped'

      UNION ALL
      SELECT 'personal_log', 'sleep_hours', '', date, sleep_hours::float8
        FROM jarvis_personal_logs
       WHERE date >= ${from} AND date <= ${to} AND coalesce(sleep_hours, 0) <> 0

      UNION ALL
      SELECT 'personal_log', 'nutrition_calories', '', date, nutrition_calories::float8
        FROM jarvis_personal_logs
       WHERE date >= ${from} AND date <= ${to} AND coalesce(nutrition_calories, 0) <> 0

      UNION ALL
      SELECT 'personal_log', 'workout_completed', '', date, workout_completed::int::float8
        FROM jarvis_personal_logs
       WHERE date >= ${from} AND date <= ${to} AND workout_completed IS TRUE

      UNION ALL
      -- DISTINCT ON in der Unterabfrage: mehrere Wiegungen am Tag, die letzte gilt.
      -- (ORDER BY darf in einem UNION-Zweig nicht direkt stehen.)
      SELECT 'weight', '', '', w.d, w.value
        FROM (
          SELECT DISTINCT ON (to_char(date, 'YYYY-MM-DD'))
                 to_char(date, 'YYYY-MM-DD') AS d, weight::float8 AS value
            FROM jarvis_weight_entries
           WHERE date >= ${fromTs}::timestamp AND date <= ${toTs}::timestamp
           ORDER BY to_char(date, 'YYYY-MM-DD'), date DESC
        ) w

      UNION ALL
      SELECT 'health', metric_key, '', to_char(date, 'YYYY-MM-DD'), value::float8
        FROM ingest_health_daily
       WHERE date >= ${from}::date AND date <= ${to}::date
    `;
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
    const put = (kind: string, metricKey: string, date: string, value: number) => {
      if (!byKind.has(kind)) byKind.set(kind, new Map());
      const perMetric = byKind.get(kind)!;
      if (!perMetric.has(metricKey)) perMetric.set(metricKey, new Map());
      perMetric.get(metricKey)!.set(date, value);
    };

    // Eine Abfrage für alles. Schlägt sie fehl — etwa weil das fremde CRM
    // gerade nicht da ist —, stehen die Metriken auf „nicht gemessen", statt
    // dass die Seite kippt.
    const rows = await safe('Sammelabfrage', () => this.loadAllRows(from, to), []);

    for (const s of sources) {
      switch (s.kind) {
        case 'crm_calls': {
          const userName = str(s.config.userName);
          if (!userName) break;
          const seen = new Set<string>();
          for (const r of rows) {
            if (r.kind !== 'crm_calls' || r.k1 !== userName) continue;
            put('crm_calls', s.metricKey, r.d, Number(r.value));
            seen.add(r.d);
          }
          // Eine lückenlose Quelle vergisst nicht: das CRM protokolliert jeden
          // Anruf, also heißt „keine Zeile" wirklich null Anrufe und nicht
          // „nicht gemessen". Nur künftige Tage bleiben offen.
          if (s.config.impliesZero === true && rows.length > 0) {
            const today = getBerlinDateStr();
            for (const d of dateRange(from, to)) {
              if (d > today || isOffDay(d) || seen.has(d)) continue;
              put('crm_calls', s.metricKey, d, 0);
            }
          }
          break;
        }

        case 'tracker': {
          const wantTracker = str(s.config.tracker).toLowerCase();
          const wantItem = str(s.config.item).toLowerCase();
          // Ohne `item` zählt die Quelle die erledigten Schritte des Trackers
          // (Morgen-/Abendroutine); mit `item` ist sie ein einzelner Haken.
          const counting = !wantItem;
          const tally = new Map<string, number>();

          for (const r of rows) {
            if (r.kind !== 'tracker') continue;
            if (wantTracker && r.k1.toLowerCase() !== wantTracker) continue;
            if (wantItem && r.k2.toLowerCase() !== wantItem) continue;
            if (counting) tally.set(r.d, (tally.get(r.d) ?? 0) + Number(r.value));
            else put('tracker', s.metricKey, r.d, Number(r.value));
          }
          for (const [d, v] of tally) put('tracker', s.metricKey, d, v);
          break;
        }

        case 'personal_log': {
          const field = str(s.config.field);
          for (const r of rows) {
            if (r.kind !== 'personal_log' || r.k1 !== field) continue;
            put('personal_log', s.metricKey, r.d, Number(r.value));
          }
          break;
        }

        case 'weight':
          for (const r of rows) {
            if (r.kind !== 'weight') continue;
            put('weight', s.metricKey, r.d, Number(r.value)); // spätere Wiegung gewinnt
          }
          break;

        case 'health': {
          const wanted = str(s.config.metric) || s.metricKey;
          for (const r of rows) {
            if (r.kind !== 'health' || r.k1 !== wanted) continue;
            put('health', s.metricKey, r.d, Number(r.value));
          }
          break;
        }

        // reminders und gproject liefern noch nichts — bewusst kein Platzhalter.
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
    // Sequenziell — siehe Kommentar in app/(dashboard)/page.tsx: eine Verbindung.
    // Aus dem Cache; gefiltert wird im Speicher, die Tabellen sind winzig.
    const config = await loadSemanticConfig();

    const wanted = metricKeys?.length ? new Set(metricKeys) : null;
    const definitions = config.definitions.filter(
      d => d.isActive && (!wanted || wanted.has(d.key))
    );
    const sources = config.sources.filter(
      s => s.isActive && (!wanted || wanted.has(s.metricKey))
    );
    const toDate = new Date(`${to}T00:00:00.000Z`);
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const intentions = config.intentions.filter(
      i =>
        (!wanted || wanted.has(i.metricKey)) &&
        i.validFrom <= toDate &&
        (i.validTo === null || i.validTo >= fromDate)
    );

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
