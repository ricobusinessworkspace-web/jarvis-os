import { prisma } from '../db';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo, dateRange, isOffDay, isoWeekday, addDays, JOKER_WEEKDAY } from '@/lib/blocks';

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
 * aus Cronometer kam nie an, oder für die Routine ist keine Grenze
 * hinterlegt, wie viele Schritte ausgelassen werden dürfen. Der Wert steht da, das Maß fehlt. Beides als `erfasst` zu zeigen
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
  /** Getrackte Tage im Zeitraum — ohne die Off-Days *dieser* Metrik (Regeln kennen keinen). */
  tracked: number;
  /**
   * Getrackte Tage, an denen überhaupt ein Ziel galt. Kleiner als `tracked`,
   * wenn eine Metrik im Zeitraum erst dazukam oder ihr Ziel endete (Phase 2).
   */
  targeted: number;
  /** met / targeted — 0…1, `null` wenn im Zeitraum kein Ziel galt. */
  adherence: number | null;
  /** measured / tracked — 0…1. Eine hohe Adherence bei niedriger Coverage sagt etwas anderes. */
  coverage: number | null;
  /**
   * Aktuelle Serie erfüllter Tage, rückwärts ab `to`. Off-Days unterbrechen sie
   * nicht, ein verfehlter Joker-Tag (Sonntag) auch nicht.
   */
  streak: number;
  /** Längste Serie im Zeitraum. */
  bestStreak: number;
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
  /**
   * Für `routine_completeness`: die Schritte jeder Routine mit ihrem
   * Gültigkeitsfenster. Die Schrittzahl wird **je Tag** gezählt — ein neuer
   * Schritt hebt das Soll erst ab seinem Anlegetag, ein archivierter senkt es
   * erst ab seinem Archivtag.
   */
  routines: Array<{ name: string; items: Array<{ activeFrom: string | null; archivedOn: string | null }> }>;
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
      prisma.tracker.findMany({
        select: { name: true, items: { select: { activeFrom: true, archivedOn: true } } },
      }),
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
      items: t.items.map(i => ({
        activeFrom: i.activeFrom ? i.activeFrom.toISOString().slice(0, 10) : null,
        archivedOn: i.archivedOn ? i.archivedOn.toISOString().slice(0, 10) : null,
      })),
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

    // `flag` braucht nur der Zweig der Korrekturen von Hand: die Zeile
    // existiert (der Wert darf dort NULL sein und heißt dann „an dem Tag
    // bewusst nicht gemessen").
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
             (l.status = 'completed')::int::float8, FALSE
        FROM jarvis_tracker_logs l
        JOIN jarvis_tracker_items i ON i.id = l.item_id
        JOIN jarvis_trackers      t ON t.id = i.tracker_id
       WHERE l.date >= ${fromTs}::timestamp AND l.date <= ${toTs}::timestamp
         AND l.status <> 'skipped'
         -- Nur Haken aus dem Gültigkeitsfenster des Schritts — dasselbe Fenster,
         -- aus dem die Schrittzahl des Tages entsteht.
         AND (i.active_from IS NULL OR l.date >= i.active_from)
         AND (i.archived_on IS NULL OR l.date <  i.archived_on)

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
   * Zusätzlich fällt `manual` ab: Korrekturen von Hand. Sie stehen bewusst außerhalb der
   *   Quellenliste — eine Korrektur ist kein weiteres angeschlossenes System,
   *   sondern schlägt jedes.
   */
  private static async resolveSources(
    from: string,
    to: string,
    sources: ResolvedSource[]
  ): Promise<{
    byKind: Map<string, DayValues>;
    manual: Map<string, Map<string, number | null>>;
  }> {
    const byKind = new Map<string, DayValues>();
    const put = (kind: string, metricKey: string, date: string, value: number) => {
      if (!byKind.has(kind)) byKind.set(kind, new Map());
      const perMetric = byKind.get(kind)!;
      if (!perMetric.has(metricKey)) perMetric.set(metricKey, new Map());
      perMetric.get(metricKey)!.set(date, value);
    };

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
          const tally = new Map<string, number>();
          const seen = new Set<string>();

          for (const r of rows) {
            if (r.kind !== 'tracker') continue;
            if (wantTracker && r.k1.toLowerCase() !== wantTracker) continue;
            if (wantItem && r.k2.toLowerCase() !== wantItem) continue;
            const done = Number(r.value ?? 0);
            if (counting) {
              tally.set(r.d, (tally.get(r.d) ?? 0) + done);
            } else {
              put('tracker', s.metricKey, r.d, done);
              seen.add(r.d);
            }
          }

          if (counting) {
            for (const [d, n] of tally) put('tracker', s.metricKey, d, n);
          }

          /**
           * Regeln: gehalten, bis ein Rückfall eingetragen ist — ab
           * `assumeDoneFrom`, bis einschließlich heute. Dieselbe Idee wie
           * `impliesZero` bei den Calls, nur umgekehrt: hier ist „kein Eintrag"
           * die Regel und nur die Ausnahme wird festgehalten. Schlägt die
           * Sammelabfrage fehl (`rows` leer), wird nichts angenommen.
           */
          const assumeFrom = str(s.config.assumeDoneFrom);
          if (!counting && assumeFrom && rows.length > 0) {
            const today = getBerlinDateStr();
            for (const d of dateRange(from, to)) {
              if (d < assumeFrom || d > today || seen.has(d)) continue;
              put('tracker', s.metricKey, d, 1);
            }
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

    return { byKind, manual };
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
      // Basis = alle Schritte bis auf höchstens `maxSkip` (in der Konfiguration
      // der Intention, nicht im Code), Soll = alle Schritte, die an *diesem*
      // Tag galten. Umbauen der Routine bewertet so die Vergangenheit nicht neu.
      case 'routine_completeness': {
        const name = str(config.tracker).toLowerCase();
        const routine = ctx.routines.find(r => r.name.toLowerCase() === name);
        const total = routine?.items.filter(
          i => (i.activeFrom === null || i.activeFrom <= date) && (i.archivedOn === null || i.archivedOn > date)
        ).length ?? 0;
        if (total === 0) {
          return { base: null, stretch: null, hint: `Routine „${str(config.tracker)}" nicht gefunden` };
        }
        const maxSkip = config.maxSkip;
        if (typeof maxSkip !== 'number' || !Number.isInteger(maxSkip) || maxSkip < 0) {
          return { base: null, stretch: null, hint: 'keine Grenze fürs Auslassen hinterlegt' };
        }
        // Mindestens ein Schritt: bei einer Routine mit höchstens `maxSkip`
        // Schritten hieße Basis sonst „nichts getan".
        const base = Math.max(1, total - maxSkip);
        return { base, stretch: total };
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
    offDay: boolean,
    value: number | null,
    base: number | null,
    stretch: number | null,
    comparator: string,
    /** Ein Ziel *ist* konfiguriert, ließ sich aber nicht auflösen. */
    targetMissing = false
  ): MetricState {
    if (offDay) return 'offday';
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
   * Basis heißt: höchstens `maxSkip` Schritte ausgelassen (`done >= base`),
   * gleich welche. Soll heißt: alle.
   */
  private static routineStateFor(
    offDay: boolean,
    done: number | null,
    base: number,
    total: number
  ): MetricState {
    if (offDay) return 'offday';
    if (!done) return 'ungemessen';
    if (done >= total) return 'soll';
    if (done >= base) return 'basis';
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
    const { byKind, manual } = await this.resolveSources(from, to, relevantSources);
    // Ziele sind historisiert: eine Änderung legt eine neue Zeile ab dem
    // Änderungstag an und schließt die alte am Vortag. Deshalb wird das Ziel
    // **je Tag** gewählt — sonst würde eine Zielerhöhung die Vergangenheit
    // rückwirkend schlechter aussehen lassen (dieselbe Regel wie bei
    // `crm_metric_targets`).
    const intentionsOf = new Map<string, typeof intentions>();
    for (const i of intentions) {
      const list = intentionsOf.get(i.metricKey) ?? [];
      list.push(i);
      intentionsOf.set(i.metricKey, list);
    }
    const intentionFor = (key: string, date: string) => {
      const day = new Date(`${date}T00:00:00.000Z`);
      const versions = intentionsOf.get(key) ?? [];
      let hit: (typeof intentions)[number] | undefined;
      for (const i of versions) {
        if (i.validFrom > day || (i.validTo !== null && i.validTo < day)) continue;
        if (!hit || i.validFrom > hit.validFrom) hit = i;
      }
      // Vor der ältesten Fassung galt schon immer die älteste — so war es,
      // bevor Ziele historisiert wurden, und so bleibt es.
      if (!hit && versions.length) {
        hit = versions.reduce((a, b) => (b.validFrom < a.validFrom ? b : a));
        if (hit.validFrom < day) hit = undefined; // Lücke zwischen Fassungen: nichts erfinden
      }
      return hit;
    };

    const matrix: MetricMatrix = {};
    for (const date of dateRange(from, to)) {
      matrix[date] = {};

      for (const key of keys) {
        const intention = intentionFor(key, date);

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

        // Off-Day je Ziel: Sonntag ist frei, außer das Ziel gilt an allen
        // sieben Tagen (die Regeln). Ohne Ziel gilt der Plan-Sonntag.
        const offDay = intention
          ? !intention.activeWeekdays.includes(isoWeekday(date))
          : isOffDay(date);

        const state =
          intention?.derivedKind === 'routine_completeness' && !targetMissing
            ? this.routineStateFor(offDay, value, base ?? 0, stretch ?? 0)
            : this.stateFor(offDay, value, base, stretch, intention?.comparator ?? '>=', targetMissing);

        matrix[date][key] = { value, base, stretch, state, source, targetHint };
      }
    }

    return matrix;
  }

  /**
   * Adherence, Coverage und Streak einer Metrik über einen Zeitraum.
   * `erfasst` zählt als gemessen, aber nicht als erfüllt — ohne Soll gibt es
   * nichts zu erfüllen. Off-Day ist, was die Matrix für *diese* Metrik als
   * Off-Day führt: der Sonntag zählt für Regeln mit, für den Rest nicht.
   */
  static summarize(
    matrix: MetricMatrix,
    metricKey: string,
    from: string,
    to: string,
    /**
     * Ab wann Serie und Rekord zählen — früher als `from` erlaubt. Eine Quote
     * beginnt am Phasenstart neu, eine Serie nicht: wer am Tag vor dem Schnitt
     * trainiert hat, hat am Tag danach immer noch eine laufende Serie.
     * Die Matrix muss diesen Zeitraum enthalten.
     *
     * `missIsFinal`: ein Verfehlen steht sofort fest, auch heute — bei Regeln
     * ist ein eingetragener Rückfall endgültig. Sonst ist heute bis zum
     * Tagesende offen, auch wenn ein Haken wieder entfernt wurde.
     *
     * `jokerWeekday`: an diesem Wochentag zählt ein erfüllter Tag in die Serie,
     * ein verfehlter wird für Serie und Rekord übersprungen — auch ein
     * endgültiger Rückfall (`missIsFinal`) an einem heutigen Sonntag. Die
     * Quote betrifft das nicht. `null` schaltet den Joker ab.
     */
    {
      streakFrom = from,
      missIsFinal = false,
      jokerWeekday = JOKER_WEEKDAY,
    }: { streakFrom?: string; missIsFinal?: boolean; jokerWeekday?: number | null } = {}
  ): MetricSummary {
    const cellOf = (d: string) => matrix[d]?.[metricKey];
    const off = (d: string) => {
      const cell = cellOf(d);
      return cell ? cell.state === 'offday' : isOffDay(d);
    };
    const fulfilled = (cell: DayMetric | undefined) => cell?.state === 'soll' || cell?.state === 'basis';
    // Heute noch nicht erfüllt heißt offen, nicht verfehlt — zählt nicht in
    // die Quote und bricht keine Serie. Nur der echte heutige Tag: das letzte
    // Datum einer vergangenen Woche ist vorbei.
    const today = getBerlinDateStr();
    const stillOpen = (d: string) => {
      if (d !== today) return false;
      const cell = cellOf(d);
      if (fulfilled(cell)) return false;
      return !missIsFinal || !cell || cell.value === null;
    };
    // Verfehlter Joker-Tag: zählt nicht, reißt aber auch nichts.
    const joker = (d: string) =>
      jokerWeekday !== null && isoWeekday(d) === jokerWeekday && !fulfilled(cellOf(d));

    let tracked = 0;
    let targeted = 0;
    let met = 0;
    let measured = 0;

    for (const date of dateRange(from, to)) {
      // Heute ohne Eintrag zählt weder für noch gegen die Quote — der Tag läuft.
      if (off(date) || stillOpen(date)) continue;
      tracked++;
      const cell = cellOf(date);
      // Ein Ziel galt, auch wenn es sich nicht auflösen ließ (`zielfehlt`).
      if (cell && (cell.base !== null || cell.targetHint)) targeted++;

      if (!cell || cell.value === null) continue;
      measured++;
      if (fulfilled(cell)) met++;
    }

    // Rekord: längste Serie ab `streakFrom`.
    let run = 0;
    let bestStreak = 0;
    for (const date of dateRange(streakFrom, to)) {
      if (off(date) || stillOpen(date) || joker(date)) continue;
      run = fulfilled(cellOf(date)) ? run + 1 : 0;
      bestStreak = Math.max(bestStreak, run);
    }

    // Streak rückwärts ab `to`; Off-Days und verfehlte Joker-Tage werden
    // übersprungen, nicht gewertet.
    let streak = 0;
    for (let d = to; d >= streakFrom; d = addDays(d, -1)) {
      if (off(d) || joker(d)) continue;
      if (fulfilled(cellOf(d))) streak++;
      else if (stillOpen(d)) continue;
      else break;
    }

    return {
      metricKey,
      met,
      measured,
      tracked,
      targeted,
      adherence: targeted ? met / targeted : null,
      coverage: tracked ? measured / tracked : null,
      streak,
      bestStreak,
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

  /** Metrik-Definitionen (Name, Einheit) — aus dem Cache des Semantic Layer, meist ohne Abfrage. */
  static async getDefinitions() {
    return (await loadSemanticConfig()).definitions;
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
