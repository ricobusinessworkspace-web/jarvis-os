import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { CrmService } from '@/core/services/CrmService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo, blockWeekRange, trackedDays, dateRange } from '@/lib/blocks';
import { MetricCard } from '@/components/today/MetricCard';
import { ActivityGrid } from '@/components/today/ActivityGrid';
import { EMPTY_METRIC, STATE_TEXT, targetSub, formatValue } from '@/lib/metricState';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CALLS = 'sales.calls_count';

/** Beginn des 6-Monats-Plans — der Umsatz zählt ab hier, nicht ab Monatsanfang. */
const PLAN_START = '2026-09-01';

/**
 * Die Tagesarbeit aus dem Plan: 40 Cold Großkunden, 40 Cold Tarif, 20
 * Nachgreifen. Die Summe ist das Gesamtziel — sie steht bewusst darüber, damit
 * ein verfehlter Tag nicht nur „unter 100" heißt, sondern zeigt, *welcher* Teil
 * gefehlt hat.
 */
const TEILE = [
  { key: 'sales.calls_cold_gross', label: 'Cold Großkunden', sub: 'Vormittag' },
  { key: 'sales.calls_cold_tarif', label: 'Cold Tarif', sub: 'Nachmittag' },
  { key: 'sales.calls_followup', label: 'Nachgreifen', sub: 'aus der Pipeline' },
];

/** Stufenwechsel, in der Reihenfolge des Trichters. */
const STUFEN = [
  { key: 'sales.stage_cold_pitch', label: 'Entscheider gesprochen' },
  { key: 'sales.stage_pitch_data', label: 'Daten bekommen' },
  { key: 'sales.stage_data_offer', label: 'Angebot raus' },
  { key: 'sales.stage_offer_closed', label: 'Abschluss' },
];

const UMSATZ = 'sales.closed_value_eur';
const ABSCHLUESSE = 'sales.closed_count';

/** Das Ergebnis-Ziel aus dem Plan. Kumulativ, nicht pro Tag. */
const UMSATZ_ZIEL = 10_000;
const UMSATZ_BIS = '2027-03-01';

const ALLE_METRIKEN = [
  CALLS, ...TEILE.map(t => t.key), ...STUFEN.map(s => s.key), UMSATZ, ABSCHLUESSE,
];

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
            className={cn(
              'h-5 rounded border',
              s.tone === 'won'
                ? 'border-foreground/25 bg-foreground/15'
                : s.tone === 'cold'
                  ? 'border-border/60 bg-white/[0.05]'
                  : 'border-foreground/15 bg-foreground/[0.08]'
            )}
            style={{ width: `${Math.max(3, (s.count / max) * 100)}%` }}
          />
          <span className="font-mono tabular-nums">{s.count}</span>
        </div>
      ))}
    </div>
  );
}

/** Eine Zeile Bestandszahl. Fehlt sie, steht das da — keine 0. */
function Bestand({ label, wert, hinweis }: { label: string; wert?: number; hinweis?: string }) {
  return (
    <div className="flex items-baseline gap-3 border-t border-border/40 py-2 first:border-t-0 first:pt-0">
      <span className="min-w-0 flex-1 truncate text-[12.5px]">{label}</span>
      {hinweis && <span className="shrink-0 text-[10.5px] text-muted">{hinweis}</span>}
      <span className="shrink-0 font-mono text-[13px] tabular-nums">
        {wert === undefined ? <span className="text-muted">–</span> : wert.toLocaleString('de-DE')}
      </span>
    </div>
  );
}

async function Vertrieb() {
  const today = getBerlinDateStr();
  const block = blockInfo(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = lastDayOfMonth(today);
  const summaryFrom = block.beforeStart ? monthStart : block.blockStart;
  const fromKandidat = summaryFrom < monthStart ? summaryFrom : monthStart;
  const from = PLAN_START < fromKandidat ? PLAN_START : fromKandidat;

  // Nacheinander, nicht parallel: der Pooler gibt pro Instanz eine Verbindung.
  const matrix = await AnalyticsService.getMatrix(from, monthEnd, ALLE_METRIKEN);
  const pipeline = await CrmService.getPipeline();
  const bestand = await CrmService.getStockMetrics();

  const cell = (key: string) => matrix[today]?.[key] ?? EMPTY_METRIC;
  const calls = cell(CALLS);
  const summary = AnalyticsService.summarize(matrix, CALLS, summaryFrom, today);

  const [weekFrom, weekTo] = blockWeekRange(today);
  const weekDays = trackedDays(weekFrom, weekTo);
  const weekActual = weekDays.reduce((sum, d) => sum + (matrix[d]?.[CALLS]?.value ?? 0), 0);
  const weekGoal = weekDays.length * (calls.stretch ?? calls.base ?? 0);

  // Stufenwechsel über den laufenden Block summiert. Ein Tag ohne Wechsel ist
  // eine echte Null; ein Tag vor der strukturierten Erfassung bleibt ungemessen
  // und fällt hier heraus — deshalb zählt `gemessen` mit.
  const blockTage = dateRange(summaryFrom, today);
  const stufenSumme = STUFEN.map(s => {
    let summe = 0;
    let gemessen = 0;
    for (const d of blockTage) {
      const c = matrix[d]?.[s.key];
      if (!c || c.value === null) continue;
      summe += c.value;
      gemessen++;
    }
    return { ...s, summe, gemessen };
  });
  const trichterHatDaten = stufenSumme.some(s => s.gemessen > 0);

  // Gesamtziel und Teilziele müssen zusammenpassen — sonst misst der Reiter
  // gegen etwas anderes als das CRM-Dashboard.
  const teilSollSumme = TEILE.reduce((s, t) => s + (cell(t.key).stretch ?? 0), 0);
  const gesamtSoll = calls.stretch ?? 0;
  const zieleWidersprechen = gesamtSoll > 0 && teilSollSumme > 0 && teilSollSumme !== gesamtSoll;

  const gridMetriken = [
    { key: CALLS, label: 'Calls', sub: targetSub(calls) },
    ...TEILE.map(t => ({ key: t.key, label: t.label.replace('Cold ', ''), sub: targetSub(cell(t.key)) })),
  ];
  // Auch die Teilziele bekommen ihre Blockbilanz — sonst steht in der Zeile
  // „Großkunden" ein Strich, obwohl die Zahlen danebenliegen.
  const gridSummaries = Object.fromEntries(
    gridMetriken.map(m => [m.key, AnalyticsService.summarize(matrix, m.key, summaryFrom, today)])
  );

  // Erwartete Provision seit Planbeginn — kumulativ gegen das Ergebnis-Ziel.
  // Datiert über closed_at_ms; undatierte Altabschlüsse tauchen hier bewusst
  // nicht auf und werden separat genannt.
  const planTage = dateRange(PLAN_START, today);
  let umsatzBisher = 0;
  let abschluesseDatiert = 0;
  for (const d of planTage) {
    umsatzBisher += matrix[d]?.[UMSATZ]?.value ?? 0;
    abschluesseDatiert += matrix[d]?.[ABSCHLUESSE]?.value ?? 0;
  }

  const ohneWert = bestand.get('sales.leads_without_value');
  const abschluesse = bestand.get('sales.closed_total');
  const abschluesseOhneWert = bestand.get('sales.closed_without_value_total');

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-tight">Vertrieb</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">
        Kennzahlen und Ziele kommen aus dem CRM — Jarvis liest sie, statt sie nachzubauen.
      </p>

      {zieleWidersprechen && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-border/60 bg-elevated/40 px-4 py-3 text-[12px] text-muted">
          <AlertTriangle className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>
            Die Teilziele ergeben zusammen{' '}
            <span className="text-foreground">{teilSollSumme}</span>, das Gesamtziel steht auf{' '}
            <span className="text-foreground">{gesamtSoll}</span>. Im CRM korrigieren — sonst
            misst dieser Reiter gegen etwas anderes als das CRM-Dashboard.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          title="Calls heute"
          source="CRM"
          value={calls.value}
          base={calls.base}
          stretch={calls.stretch}
          unit="count"
          state={calls.state}
          targetHint={calls.targetHint}
          footLeft="Ziel aus dem CRM"
          footRight={`${summary.met}/${summary.tracked} Tage im Block`}
        />

        {/* Der eigentliche Plan: wo genau hat der Tag gefehlt. */}
        <div className="crm-card h-full">
          <div className="crm-header">
            <h3 className="crm-title">Aufteilung heute</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted">40 · 40 · 20</span>
          </div>
          <div className="flex flex-col">
            {TEILE.map(t => {
              const c = cell(t.key);
              const soll = c.stretch ?? c.base;
              return (
                <div
                  key={t.key}
                  className="flex items-center gap-3 border-t border-border/40 py-2 first:border-t-0 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px]">{t.label}</div>
                    <div className="mt-0.5 text-[10.5px] text-muted">{t.sub}</div>
                  </div>
                  <div className={cn('shrink-0 font-mono text-[15px] tabular-nums', STATE_TEXT[c.state])}>
                    {formatValue(c.value, 'count')}
                    {soll !== null && <span className="text-muted"> / {soll}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <MetricCard
          title="Diese Blockwoche"
          value={weekActual}
          base={null}
          stretch={weekGoal || null}
          unit="count"
          state={weekGoal && weekActual >= weekGoal ? 'soll' : 'unter'}
          footLeft={`${weekDays.length} getrackte Tage`}
          footRight={`Woche ${block.weekOfBlock} von 12`}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="crm-card">
          <div className="crm-header">
            <h3 className="crm-title">Trichter im Block</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted">Stufenwechsel</span>
          </div>
          {trichterHatDaten ? (
            <>
              <div className="flex flex-col">
                {stufenSumme.map(s => (
                  <Bestand key={s.key} label={s.label} wert={s.summe} />
                ))}
              </div>
              {/* Ohne diese Zeile liest sich eine 0 wie „im ganzen Block nichts
                  erreicht" statt „wir haben Daten für einen Tag". */}
              <p className="mt-auto border-t border-border/40 pt-3 text-[11px] leading-relaxed text-muted">
                Gemessen an{' '}
                <span className="text-foreground">
                  {stufenSumme[0].gemessen} von {blockTage.length}
                </span>{' '}
                Tagen des Blocks — davor wurden Stufenwechsel nicht strukturiert festgehalten.
              </p>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted">
              Noch kein Stufenwechsel strukturiert erfasst. Das CRM hält seit dem 12.09. alte
              und neue Stufe fest — der Trichter beginnt mit dem ersten Wechsel, der ankommt.
              Bis dahin steht hier bewusst keine Zahl.
            </p>
          )}
        </div>

        <div className="crm-card">
          <div className="crm-header">
            <h3 className="crm-title">Pipeline</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted">crm_leads.stage</span>
          </div>
          {pipeline.stages.length > 0 ? (
            <>
              <Funnel stages={pipeline.stages} />
              <p className="mt-4 border-t border-border/40 pt-3 text-[11px] leading-relaxed text-muted">
                Kaltkartei liegt außerhalb der Pipeline.
                {ohneWert !== undefined && ohneWert > 0 && (
                  <>
                    {' '}
                    <span className="text-foreground">{ohneWert}</span> Leads darin haben keinen
                    hinterlegten Wert.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="text-[13px] leading-relaxed text-muted">
              Das CRM ist gerade nicht erreichbar. Die Stufen erscheinen wieder, sobald es
              antwortet — hier steht bewusst keine veraltete Zahl.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="crm-card">
          <div className="crm-header">
            <h3 className="crm-title">Liegt an</h3>
            <span className="text-[10px] uppercase tracking-wider text-muted">Bestand</span>
          </div>
          <div className="flex flex-col">
            <Bestand label="Überfällige Wiedervorlagen" wert={bestand.get('sales.overdue_followups')} />
            <Bestand label="Kaltkartei" wert={bestand.get('sales.cold_stock')} />
            <Bestand
              label="davon nie angerufen"
              wert={bestand.get('sales.cold_never_called')}
            />
            <Bestand label="Aussortiert" wert={bestand.get('sales.disqualified_total')} />
          </div>
          {bestand.size === 0 && (
            <p className="mt-2 text-[11.5px] text-muted">
              Bestandszahlen gerade nicht abrufbar.
            </p>
          )}
        </div>

        <div className="crm-card">
          <div className="crm-header">
            <h3 className="crm-title">Umsatz</h3>
            <span className="rounded-md border border-border/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
              10.000 € bis 01.03.2027
            </span>
          </div>
          {umsatzBisher > 0 ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[38px] leading-none tabular-nums">
                  {umsatzBisher.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                </span>
                <span className="font-mono text-[13px] text-muted">
                  / {UMSATZ_ZIEL.toLocaleString('de-DE')} €
                </span>
              </div>
              <div className="mt-4 h-1.5 rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${Math.min(100, (umsatzBisher / UMSATZ_ZIEL) * 100)}%` }}
                />
              </div>
              <p className="mt-auto border-t border-border/40 pt-3 text-[11px] leading-relaxed text-muted">
                Erwartete Provision aus{' '}
                <span className="text-foreground">{abschluesseDatiert}</span> datierten
                Abschlüssen.
                {abschluesseOhneWert !== undefined && abschluesseOhneWert > 0 && (
                  <> {abschluesseOhneWert} weitere haben keinen Wert und fehlen hier.</>
                )}{' '}
                Was tatsächlich ankommt, steht erst in der Provisionsabrechnung.
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-muted">
                Noch nicht messbar:{' '}
                {abschluesse !== undefined && abschluesseOhneWert !== undefined ? (
                  <>
                    von <span className="text-foreground">{abschluesse}</span> Abschlüssen hat{' '}
                    <span className="text-foreground">
                      {abschluesseOhneWert >= abschluesse ? 'keiner' : `${abschluesseOhneWert} keinen`}
                    </span>{' '}
                    hinterlegten Wert.
                  </>
                ) : (
                  <>es liegen keine Abschlusswerte vor.</>
                )}{' '}
                Eine 0 € stünde hier für die fehlende Eingabe, nicht für das Ergebnis.
              </p>
              <p className="mt-auto border-t border-border/40 pt-3 text-[11px] leading-relaxed text-muted">
                Der Wert wird im CRM beim Abschluss abgefragt. Sobald der erste steht, rechnet
                Jarvis hier gegen die {UMSATZ_ZIEL.toLocaleString('de-DE')} € bis{' '}
                {UMSATZ_BIS.slice(8)}.{UMSATZ_BIS.slice(5, 7)}.{UMSATZ_BIS.slice(0, 4)}.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-3">
        <ActivityGrid
          matrix={matrix}
          metrics={gridMetriken}
          summaries={gridSummaries}
          from={monthStart}
          to={monthEnd}
          today={today}
          title="Anrufe im Monat"
        />
      </div>
    </>
  );
}

export default function VertriebPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-2xl border border-border/30 bg-elevated/30" />}
      >
        <Vertrieb />
      </Suspense>
    </div>
  );
}
