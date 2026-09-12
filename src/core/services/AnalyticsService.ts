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
 * `erfasst` heißt: gemessen, aber **bewusst ohne Soll** — es gibt kein Urteil,
 * nur den Wert. Genau der Fall bei einer Metrik, für die niemand ein Ziel
 * hinterlegt hat.
 *
 * `zielfehlt` ist etwas anderes und der Unterschied ist wichtig: hier *ist* ein
 * Ziel konfiguriert, es lässt sich nur gerade nicht auflösen — das Kalorienziel
 * aus Cronometer kam nie an, oder in der Routine ist kein Pflichtschritt
 * markiert. Der Wert steht da, das Maß fehlt. Beides als `erfasst` zu zeigen
 * hieße, einen kaputten Anschluss wie eine Design-Entscheidung aussehen zu
 * lassen.
 */
export type MetricState =
  | 'soll' | 'basis' | 'unter' | 'erfasst' | 'zielfehlt' | 'ungemessen' | 'offday';

export interface DayMetric {
  value: number | null;
  base: number | null;
  stretch: number | null;
  state: MetricState;
  /** `kind` der Quelle, die den Wert geliefert hat — für „auto aus CRM" / „manuell". */
  source: string | null;
  /** Warum kein Ziel auflösbar war — nur gesetzt bei `zielfehlt`. */
  targetHint?: string;
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
  /** Für `routine_completeness`: wie viele Schritte hat die Routine, wie viele davon sind Pflicht. */
  routines: Array<{ name: string; total: number; required: number }>;
  /** Zielwerte aus Health/Cronometer, für `health_target` und `weight_trajectory`. */
  healthTargets: Awaited<ReturnType<typeof prisma.ingestHealthTarget.findMany>>;
  /**
   * Vertriebsziele aus dem CRM, für `crm_target`. Historisiert: je Metrik gilt
   * die Zeile mit dem größten `validFrom`, das nicht nach dem Stichtag liegt.
   * Ohne das würde eine Zielerhöhung die Vergangenheit rückwirkend schlechter
   * aussehen lassen. Aufsteigend sortiert, die Auswahl verlässt sich darauf.
   */
  crmTargets: Array<{
    metricKey: string;
    base: number;
    target: number | null;
    comparator: string;
    validFrom: string;
  }>;
};

let configCache: { at: number; value: SemanticConfig } | null = null;
const CONFIG_TTL_MS = 30_000;

/** Nach jeder Änderung an Metriken, Quellen oder Soll-Werten aufrufen. */
export function invalidateSemanticConfig() {
  configCache = null;
}

async function loadSemanticConfig(): Promise<SemanticConfig> {
  if (configCache && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;

  // Gebündelt: $transaction schickt die Abfragen in einem Rutsch statt in
  // ebenso vielen Runden. Über den pgbouncer kostet jede Runde mehrere hundert
  // Millisekunden.
  // `crm_metric_targets` gehört dem CRM — nur lesen, und über rohes SQL, weil
  // die Spalten `numeric` sind: der Treiber gäbe sie sonst als Zeichenketten
  // zurück, und `base + 1` ergäbe „301". Ebenso `to_char` für `valid_from` —
  // eine `date`-Spalte käme sonst als Berliner Mitternacht und läge nach
  // `toISOString()` einen Tag zu früh.
  const [definitions, sources, intentions, trackers, healthTargets, crmTargets] =
    await prisma.$transaction([
      prisma.coreMetricDefinition.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.coreMetricSource.findMany({ orderBy: { priority: 'asc' } }),
      prisma.coreIntention.findMany(),
      prisma.tracker.findMany({ select: { name: true, items: { select: { required: true } } } }),
      prisma.ingestHealthTarget.findMany(),
      prisma.$queryRaw<SemanticConfig['crmTargets']>`
        SELECT metric_key                        AS "metricKey",
               base_value::float8                AS "base",
               target_value::float8              AS "target",
               comparator,
               to_char(valid_from, 'YYYY-MM-DD') AS "validFrom"
          FROM crm_metric_targets
         ORDER BY metric_key, valid_from
      `,
    ]);

  const value = {
    definitions,
    sources,
    intentions,
    routines: trackers.map(t => ({
      name: t.name,
      total: t.items.length,
      required: t.items.filter(i => i.required).length,
    })),
    healthTargets,
    crmTargets,
  };
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

    // `flag` trägt je Zweig eine andere Ja/Nein-Information: beim Tracker, ob
    // der Schritt ein Pflichtschritt ist; bei den Korrekturen von Hand, dass
    // die Zeile überhaupt existiert (der Wert darf dort NULL sein und heißt
    // dann „an dem Tag bewusst nicht gemessen").
    return prisma.$queryRaw<
      Array<{ kind: string; k1: string; k2: string; d: string; value: number | null; flag: boolean }>
    >`
      SELECT 'crm_calls' AS kind, by_user_name AS k1, '' AS k2,
             to_char(to_timestamp(ts / 1000.0) AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS d,
             COUNT(*)::float8 AS value, FALSE AS flag
        FROM crm_calls
       WHERE ts >= ${fromMs} AND ts < ${toMs} AND by_user_name IS NOT NULL
       GROUP BY 1, 2, 3, 4

      UNION ALL
      SELECT 'tracker', t.name, i.title,
             to_char(l.date, 'YYYY-MM-DD'),
             (l.status = 'completed')::int::float8, i.required
        FROM jarvis_tracker_logs l
        JOIN jarvis_tracker_items i ON i.id = l.item_id
        JOIN jarvis_trackers      t ON t.id = i.tracker_id
       WHERE l.date >= ${fromTs}::timestamp AND l.date <= ${toTs}::timestamp
         AND l.status <> 'skipped'

      UNION ALL
      SELECT 'personal_log', 'sleep_hours', '', date, sleep_hours::float8, FALSE
        FROM jarvis_personal_logs
       WHERE date >= ${from} AND date <= ${to} AND coalesce(sleep_hours, 0) <> 0

      UNION ALL
      SELECT 'personal_log', 'nutrition_calories', '', date, nutrition_calories::float8, FALSE
        FROM jarvis_personal_logs
       WHERE date >= ${from} AND date <= ${to} AND coalesce(nutrition_calories, 0) <> 0

      UNION ALL
      SELECT 'personal_log', 'workout_completed', '', date, workout_completed::int::float8, FALSE
        FROM jarvis_personal_logs
       WHERE date >= ${from} AND date <= ${to} AND workout_completed IS TRUE

      UNION ALL
      -- DISTINCT ON in der Unterabfrage: mehrere Wiegungen am Tag, die letzte gilt.
      -- (ORDER BY darf in einem UNION-Zweig nicht direkt stehen.)
      SELECT 'weight', '', '', w.d, w.value, FALSE
        FROM (
          SELECT DISTINCT ON (to_char(date, 'YYYY-MM-DD'))
                 to_char(date, 'YYYY-MM-DD') AS d, weight::float8 AS value
            FROM jarvis_weight_entries
           WHERE date >= ${fromTs}::timestamp AND date <= ${toTs}::timestamp
           ORDER BY to_char(date, 'YYYY-MM-DD'), date DESC
        ) w

      UNION ALL
      SELECT 'health', metric_key, '', to_char(date, 'YYYY-MM-DD'), value::float8, FALSE
        FROM ingest_health_daily
       WHERE date >= ${from}::date AND date <= ${to}::date

      UNION ALL
      SELECT 'manual', metric_key, '', to_char(date, 'YYYY-MM-DD'), value::float8, TRUE
        FROM core_manual_values
       WHERE date >= ${from}::date AND date <= ${to}::date

      UNION ALL
      -- Vertriebskennzahlen aus dem CRM. to_char statt der Spalte selbst:
      -- tag ist eine date-Spalte, der Treiber macht daraus Berliner
      -- Mitternacht, und ein naives toISOString() läge einen Tag zu früh.
      -- wert ist numeric und käme ohne Cast als Zeichenkette zurück.
      SELECT 'crm_metrics', metric_key, '', to_char(tag, 'YYYY-MM-DD'), wert::float8, FALSE
        FROM crm_daily_metrics
       WHERE tag >= ${from}::date AND tag <= ${to}::date
    `;
  }

  /**
   * Löst alle aktiven Quellen auf. Ergebnis: kind → metricKey → date → value.
   * Quellenarten ohne Ingest-Daten (reminders, gproject) liefern bewusst
   * nichts, statt einen Platzhalter zu erfinden.
   *
   * Zwei Dinge fallen dabei zusätzlich ab:
   * - `routineProgress`: wie viele Schritte einer Routine an dem Tag erledigt
   *   waren und wie viele davon Pflicht — eine reine Zahl reicht nicht, weil
   *   „4 von 6" nichts darüber sagt, ob die *richtigen* vier erledigt sind.
   * - `manual`: Korrekturen von Hand. Sie stehen bewusst außerhalb der
   *   Quellenliste — eine Korrektur ist kein weiteres angeschlossenes System,
   *   sondern schlägt jedes.
   */
  private static async resolveSources(
    from: string,
    to: string,
    sources: ResolvedSource[]
  ): Promise<{
    byKind: Map<string, DayValues>;
    routineProgress: Map<string, Map<string, { done: number; requiredDone: number }>>;
    manual: Map<string, Map<string, number | null>>;
  }> {
    const byKind = new Map<string, DayValues>();
    const put = (kind: string, metricKey: string, date: string, value: number) => {
      if (!byKind.has(kind)) byKind.set(kind, new Map());
      const perMetric = byKind.get(kind)!;
      if (!perMetric.has(metricKey)) perMetric.set(metricKey, new Map());
      perMetric.get(metricKey)!.set(date, value);
    };

    const routineProgress = new Map<string, Map<string, { done: number; requiredDone: number }>>();
    const manual = new Map<string, Map<string, number | null>>();

    // Eine Abfrage für alles. Schlägt sie fehl — etwa weil das fremde CRM
    // gerade nicht da ist —, stehen die Metriken auf „nicht gemessen", statt
    // dass die Seite kippt.
    const rows = await safe('Sammelabfrage', () => this.loadAllRows(from, to), []);

    // Korrekturen von Hand zuerst: sie hängen an keiner Quelle und gelten für
    // jede Metrik. Eine vorhandene Zeile mit `value = null` heißt „an dem Tag
    // bewusst nicht gemessen" und ist etwas anderes als „keine Zeile".
    for (const r of rows) {
      if (r.kind !== 'manual') continue;
      if (!manual.has(r.k1)) manual.set(r.k1, new Map());
      manual.get(r.k1)!.set(r.d, r.value === null ? null : Number(r.value));
    }

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
          const tally = new Map<string, { done: number; requiredDone: number }>();

          for (const r of rows) {
            if (r.kind !== 'tracker') continue;
            if (wantTracker && r.k1.toLowerCase() !== wantTracker) continue;
            if (wantItem && r.k2.toLowerCase() !== wantItem) continue;
            const done = Number(r.value ?? 0);
            if (counting) {
              const acc = tally.get(r.d) ?? { done: 0, requiredDone: 0 };
              acc.done += done;
              if (r.flag) acc.requiredDone += done;
              tally.set(r.d, acc);
            } else {
              put('tracker', s.metricKey, r.d, done);
            }
          }

          if (counting) {
            for (const [d, acc] of tally) put('tracker', s.metricKey, d, acc.done);
            routineProgress.set(s.metricKey, tally);
          }
          break;
        }

        case 'personal_log': {
          const field = str(s.config.field);
          for (const r of rows) {
            if (r.kind !== 'personal_log' || r.k1 !== field || r.value === null) continue;
            put('personal_log', s.metricKey, r.d, Number(r.value));
          }
          break;
        }

        case 'weight':
          for (const r of rows) {
            if (r.kind !== 'weight' || r.value === null) continue;
            put('weight', s.metricKey, r.d, Number(r.value)); // spätere Wiegung gewinnt
          }
          break;

        case 'health': {
          const wanted = str(s.config.metric) || s.metricKey;
          for (const r of rows) {
            if (r.kind !== 'health' || r.k1 !== wanted || r.value === null) continue;
            put('health', s.metricKey, r.d, Number(r.value));
          }
          break;
        }

        case 'crm_metrics': {
          const wanted = str(s.config.metric) || s.metricKey;
          const seen = new Set<string>();
          for (const r of rows) {
            if (r.kind !== 'crm_metrics' || r.k1 !== wanted || r.value === null) continue;
            put('crm_metrics', s.metricKey, r.d, Number(r.value));
            seen.add(r.d);
          }

          /**
           * Implizite Null — aber erst ab `zeroFrom`.
           *
           * Für Anrufe stimmt „keine Zeile heißt null": das CRM protokolliert
           * jeden gewählten Anruf. Für Stufenwechsel stimmt es erst, seit sie
           * strukturiert festgehalten werden. Ohne dieses Datum zeigte Jarvis
           * für jeden Tag davor eine lückenlose Null-Reihe — „kein einziges
           * Angebot rausgeschickt" statt „wurde damals nicht erfasst". Genau
           * der Fehler, den NULL ≠ 0 verhindern soll.
           */
          const zeroFrom = str(s.config.zeroFrom);
          if (zeroFrom) {
            const today = getBerlinDateStr();
            for (const d of dateRange(from, to)) {
              if (d < zeroFrom || d > today || isOffDay(d) || seen.has(d)) continue;
              put('crm_metrics', s.metricKey, d, 0);
            }
          }
          break;
        }

        // reminders und gproject liefern noch nichts — bewusst kein Platzhalter.
      }
    }

    return { byKind, routineProgress, manual };
  }

  /**
   * Rechnet ein abgeleitetes Ziel für einen Tag aus.
   *
   * Kommt nichts zurück (`resolved: false`), wird **nichts geraten** — die
   * Metrik landet auf `zielfehlt` und der Hinweis sagt, was fehlt. Das ist die
   * Zielwert-Seite derselben Regel, die für Werte schon gilt: NULL ≠ 0.
   */
  private static derivedTarget(
    kind: string,
    config: SourceConfig,
    date: string,
    ctx: SemanticConfig
  ): { base: number | null; stretch: number | null; hint?: string } {
    switch (kind) {
      // Basis = alle Pflichtschritte, Soll = alle Schritte. Beide Zahlen kommen
      // aus der Routine selbst und wandern mit, wenn Rico sie umbaut.
      case 'routine_completeness': {
        const name = str(config.tracker).toLowerCase();
        const routine = ctx.routines.find(r => r.name.toLowerCase() === name);
        if (!routine || routine.total === 0) {
          return { base: null, stretch: null, hint: `Routine „${str(config.tracker)}" nicht gefunden` };
        }
        if (routine.required === 0) {
          return { base: null, stretch: null, hint: 'kein Pflichtschritt markiert' };
        }
        return { base: routine.required, stretch: routine.total };
      }

      // Kalorienziel aus Cronometer/Health. Soll = das Ziel, Basis = Ziel plus
      // Toleranz (Vergleich `<=`, also ist mehr schlechter).
      case 'health_target': {
        const key = str(config.metric) || 'body.calories';
        const target = ctx.healthTargets.find(t => t.metricKey === key);
        if (!target) return { base: null, stretch: null, hint: 'Ziel nicht aus Health angekommen' };
        const tolerance = typeof config.tolerancePct === 'number' ? config.tolerancePct : 0.1;
        return { base: target.targetValue * (1 + tolerance), stretch: target.targetValue };
      }

      // Gewicht: zwischen Start und Ziel linear interpoliert — das Soll für
      // *heute*, nicht das Endziel. Ohne Startpunkt gilt schlicht das Endziel.
      case 'weight_trajectory': {
        const target = ctx.healthTargets.find(t => t.metricKey === 'body.weight');
        if (!target) return { base: null, stretch: null, hint: 'Gewichtsziel nicht aus Health angekommen' };

        const tolerance = typeof config.toleranceKg === 'number' ? config.toleranceKg : 1.5;
        let goal = target.targetValue;

        if (target.startValue !== null && target.startDate && target.targetDate) {
          const start = target.startDate.getTime();
          const end = target.targetDate.getTime();
          const now = Date.parse(`${date}T00:00:00.000Z`);
          if (end > start) {
            const t = Math.min(1, Math.max(0, (now - start) / (end - start)));
            goal = target.startValue + (target.targetValue - target.startValue) * t;
          }
        }

        const round = (n: number) => Math.round(n * 10) / 10;
        // Abnehmen heißt `<=`: Basis ist das großzügigere (höhere) der beiden.
        const losing = target.startValue === null || target.targetValue <= target.startValue;
        return {
          stretch: round(goal),
          base: round(losing ? goal + tolerance : goal - tolerance),
        };
      }

      /**
       * Vertriebsziele kommen aus dem CRM, nicht aus dem Plan — dort werden sie
       * bearbeitet, dort gehören sie hin. Jarvis spiegelt sie nur.
       *
       * Es gilt die Zeile mit dem größten `validFrom`, das nicht nach dem
       * Stichtag liegt. Eine Zielerhöhung legt im CRM eine neue Zeile an, statt
       * die alte zu überschreiben; würde Jarvis immer die neueste nehmen, sähe
       * jeder vergangene Tag rückwirkend schlechter aus.
       */
      case 'crm_target': {
        const key = str(config.metric);
        if (!key) return { base: null, stretch: null, hint: 'keine Metrik angegeben' };

        // Aufsteigend sortiert geladen — der letzte Treffer ist der jüngste gültige.
        let treffer: SemanticConfig['crmTargets'][number] | null = null;
        for (const t of ctx.crmTargets) {
          if (t.metricKey === key && t.validFrom <= date) treffer = t;
        }
        if (!treffer) return { base: null, stretch: null, hint: 'kein Ziel im CRM hinterlegt' };

        // CRM nennt es `target_value`, Jarvis `stretch_value` — gleiche Bedeutung.
        return { base: treffer.base, stretch: treffer.target };
      }

      default:
        return { base: null, stretch: null, hint: `unbekannte Ableitung „${kind}"` };
    }
  }

  private static stateFor(
    dateStr: string,
    value: number | null,
    base: number | null,
    stretch: number | null,
    comparator: string,
    /** Ein Ziel *ist* konfiguriert, ließ sich aber nicht auflösen. */
    targetMissing = false
  ): MetricState {
    if (isOffDay(dateStr)) return 'offday';
    if (value === null) return 'ungemessen';
    if (targetMissing) return 'zielfehlt'; // Wert da, Maß fehlt — kein Design, ein Defekt
    if (base === null) return 'erfasst'; // bewusst ohne Soll — kein Urteil gewollt

    const goal = stretch ?? base;
    const hits = (v: number, target: number) => (comparator === '<=' ? v <= target : v >= target);

    if (hits(value, goal)) return 'soll';
    if (hits(value, base)) return 'basis';
    return 'unter';
  }

  /**
   * Routinen werden nicht nach Anzahl beurteilt, sondern danach, *welche*
   * Schritte erledigt sind: vier von sechs sagen nichts, solange nicht klar
   * ist, ob die Pflichtschritte dabei waren.
   */
  private static routineStateFor(
    dateStr: string,
    progress: { done: number; requiredDone: number } | undefined,
    requiredTotal: number,
    total: number
  ): MetricState {
    if (isOffDay(dateStr)) return 'offday';
    if (!progress || progress.done === 0) return 'ungemessen';
    if (progress.done >= total) return 'soll';
    if (progress.requiredDone >= requiredTotal) return 'basis';
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
    const { byKind, routineProgress, manual } = await this.resolveSources(from, to, relevantSources);
    const intentionOf = new Map(intentions.map(i => [i.metricKey, i]));

    const matrix: MetricMatrix = {};
    for (const date of dateRange(from, to)) {
      matrix[date] = {};

      for (const key of keys) {
        const intention = intentionOf.get(key);

        // Ziel bestimmen: fest aus dem Plan oder aus einer Verbindung abgeleitet.
        let base = intention?.baseValue ?? null;
        let stretch = intention?.stretchValue ?? null;
        let targetHint: string | undefined;
        let targetMissing = false;

        if (intention?.derivedKind) {
          const derived = this.derivedTarget(
            intention.derivedKind,
            (intention.derivedConfig ?? {}) as SourceConfig,
            date,
            config
          );
          base = derived.base;
          stretch = derived.stretch;
          if (base === null) {
            targetMissing = true;
            targetHint = derived.hint;
          }
        }

        let value: number | null = null;
        let source: string | null = null;

        // Eine Korrektur von Hand schlägt jede Automatik — auch einen späteren
        // Sync. Sie gilt, bis sie für den Tag gelöscht wird.
        const override = manual.get(key);
        if (override?.has(date)) {
          value = override.get(date) ?? null;
          source = 'manual';
        } else {
          // Sonst die Quellen in Prioritätsreihenfolge — erster Treffer gewinnt.
          for (const s of relevantSources) {
            if (s.metricKey !== key) continue;
            const hit = byKind.get(s.kind)?.get(key)?.get(date);
            if (hit !== undefined) {
              value = hit;
              source = s.kind;
              break;
            }
          }
        }

        const state =
          intention?.derivedKind === 'routine_completeness' && !targetMissing
            ? this.routineStateFor(date, routineProgress.get(key)?.get(date), base ?? 0, stretch ?? 0)
            : this.stateFor(date, value, base, stretch, intention?.comparator ?? '>=', targetMissing);

        matrix[date][key] = { value, base, stretch, state, source, targetHint };
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
