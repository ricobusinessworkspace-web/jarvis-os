import { NextResponse } from 'next/server';
import { AnalyticsService, type DayMetric, type MetricState } from '@/core/services/AnalyticsService';
import { STATE_LABEL, EMPTY_METRIC, targetSub, formatValue } from '@/lib/metricState';
import { getBerlinDateStr, getBerlinHour } from '@/lib/dateUtils';
import { isOffDay } from '@/lib/blocks';
import { checkWidgetAuth, widgetAuthResponse } from '@/lib/widgetAuth';

/**
 * Tages-Calls für das iPhone-Widget.
 *
 * Liest denselben Semantic Layer wie das Dashboard — nicht `crm_calls` direkt.
 * Damit zeigt das Widget zwangsläufig dieselbe Zahl wie der Vertriebs-Reiter,
 * egal ob Rico gerade am Mac oder am iPhone arbeitet: beide Oberflächen und das
 * CRM hängen an derselben Datenbank, und das Ziel kommt aus `crm_metric_targets`.
 *
 *   GET /api/widgets/calls
 *   Authorization: Bearer <WIDGET_SECRET_TOKEN>
 *
 * Alternativ `?token=…`, weil Scriptable-Widgets sich mit Kopfzeilen schwer tun.
 * Die Anzeigetexte kommen fertig aus dieser Antwort: die deutsche Formulierung
 * steht damit einmal im System (`metricState.ts`) und nicht ein zweites Mal im
 * Widget-Skript, wo sie beim nächsten Zielwechsel still falsch würde.
 */

export const dynamic = 'force-dynamic';

const CALLS = 'sales.calls_count';

/** Die Tagesarbeit aus dem Plan — dieselbe Aufteilung wie im Vertriebs-Reiter. */
const TEILE = [
  { key: 'sales.calls_cold_gross', label: 'Cold Groß' },
  { key: 'sales.calls_cold_tarif', label: 'Cold Tarif' },
  { key: 'sales.calls_followup', label: 'Nachgreifen' },
];

/**
 * Ab dieser Berliner Stunde heißt ein nicht erreichtes Tagesziel „verfehlt".
 *
 * Auf dem Dashboard ist `unter` den ganzen Tag richtig: dort steht die Zahl in
 * einer Tabelle neben der Uhrzeit, der Zusammenhang ist sichtbar. Ein Widget
 * steht dagegen ab Mitternacht auf dem Homescreen — ein roter Balken um 08:00
 * Uhr bei drei Calls behauptet „Tag verfehlt", obwohl der Tag noch läuft. Bis
 * zum Feierabend ist der Zustand deshalb `laeuft`. Der Wert selbst wird dabei
 * nicht geschönt, nur das Urteil zurückgehalten.
 */
const FEIERABEND_HOUR = 18;

/** Wie `MetricState`, plus „Tag läuft noch" — nur für die Anzeige, nie in der Matrix. */
type Verdict = MetricState | 'laeuft';

const VERDICT_LABEL: Record<Verdict, string> = { ...STATE_LABEL, laeuft: 'läuft' };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Ein Wert für die Schiene: Füllstand und die Stelle, an der die Basis sitzt.
 * Beides `null`, solange kein Soll aufgelöst ist — eine Schiene ohne Maß wäre
 * eine erfundene Zahl.
 */
function rail(m: DayMetric) {
  const goal = m.stretch ?? m.base;
  if (goal === null || goal <= 0 || m.value === null) return { progress: null, basePoint: null };
  return {
    progress: clamp01(m.value / goal),
    basePoint: m.base === null ? null : clamp01(m.base / goal),
  };
}

function shape(key: string, label: string, m: DayMetric, dayOver: boolean) {
  const verdict: Verdict = m.state === 'unter' && !dayOver ? 'laeuft' : m.state;
  return {
    key,
    label,
    value: m.value,
    base: m.base,
    stretch: m.stretch,
    /** Der echte Zustand aus dem Semantic Layer — unverändert. */
    state: m.state,
    /** Derselbe Zustand fürs Widget, mit `laeuft` für den noch offenen Tag. */
    verdict,
    verdictLabel: VERDICT_LABEL[verdict],
    /** „Basis 30 · Soll 100" — aus den echten Zielen gebildet, nicht getippt. */
    bounds: targetSub(m),
    display: formatValue(m.value, 'count'),
    source: m.source,
    targetHint: m.targetHint ?? null,
    ...rail(m),
  };
}

export async function GET(request: Request) {
  const denied = widgetAuthResponse(checkWidgetAuth(request));
  if (denied) return denied;

  try {
    const today = getBerlinDateStr();
    const hour = getBerlinHour();
    const offDay = isOffDay(today);
    const dayOver = hour >= FEIERABEND_HOUR;

    const matrix = await AnalyticsService.getMatrix(today, today, [
      CALLS,
      ...TEILE.map(t => t.key),
    ]);
    const cell = (key: string) => matrix[today]?.[key] ?? EMPTY_METRIC;

    return NextResponse.json(
      {
        ok: true,
        date: today,
        generatedAt: new Date().toISOString(),
        offDay,
        dayOver,
        calls: shape(CALLS, 'Calls', cell(CALLS), dayOver),
        teile: TEILE.map(t => shape(t.key, t.label, cell(t.key), dayOver)),
        /**
         * Wie lange das Widget die Antwort für frisch halten darf. Während der
         * Arbeitszeit kurz, sonst lang: iOS deckelt die Aktualisierungen pro Tag,
         * und die sollen in den Stunden landen, in denen sich die Zahl bewegt.
         */
        refreshAfterSeconds: offDay ? 3600 : hour >= 7 && hour < 20 ? 300 : 1800,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[widgets/calls]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
