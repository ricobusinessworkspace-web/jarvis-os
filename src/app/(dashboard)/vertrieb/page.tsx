import { Suspense } from 'react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { CrmService } from '@/core/services/CrmService';
import { heuteUndWoche, CALLS } from '@/core/services/WochenService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { ZELLE, WOCHENTAGE_KURZ } from '@/lib/zellen';
import { RouteLoading } from '@/components/layout/RouteLoading';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Vertrieb im Wochenzyklus (`docs/wochenzyklus-spec.md`): primär die
 * laufende Woche gegen das Wochenziel mit den verbleibenden Arbeitstagen,
 * darunter Split, Ergebnis und die Tage der Woche. Vorwochen gibt es hier
 * nicht. Wochenziele = Tagesziel aus dem CRM × Arbeitstage — Konfiguration,
 * keine Konstante.
 *
 * Das Tippziel des „Jarvis Calls"-Widgets — die Adresse `/vertrieb` bleibt.
 */
const ABSCHLUESSE = 'sales.closed_count';

const zahl = (n: number | null | undefined) => (n === null || n === undefined ? '–' : n.toLocaleString('de-DE'));

function Schiene({ ist, basis, soll, hoch = 8 }: { ist: number; basis: number | null; soll: number | null; hoch?: number }) {
  const ziel = soll ?? basis;
  return (
    <div className="relative rounded-full bg-elevated" style={{ height: hoch }}>
      {ziel ? <i className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${Math.min(100, (ist / ziel) * 100)}%` }} /> : null}
      {basis && soll && basis < soll ? (
        <b className="absolute -bottom-1 -top-1 w-0.5 rounded bg-muted" style={{ left: `${(basis / soll) * 100}%` }} />
      ) : null}
    </div>
  );
}

async function Vertrieb() {
  const today = getBerlinDateStr();
  // Nacheinander — eine Pooler-Verbindung pro Instanz.
  const d = await heuteUndWoche(today);
  const abschluesseMatrix = await AnalyticsService.getMatrix(d.woche.von, today, [ABSCHLUESSE]);
  const bestand = await CrmService.getStockMetrics();

  const w = d.woche.calls;
  const callsZeile = d.woche.zeilen.find(z => z.key === CALLS)!;
  const callsHeute = d.heute.kacheln.find(k => k.key === CALLS)!;

  // Abschlüsse: das CRM meldet nur Tage mit Abschluss — ohne jede Meldung
  // ist das „keine erfasst", nicht 0.
  const gemeldet = d.woche.tage
    .map(t => abschluesseMatrix[t]?.[ABSCHLUESSE]?.value)
    .filter((v): v is number => v !== null && v !== undefined);
  const abschluesse = gemeldet.length ? gemeldet.reduce((a, b) => a + b, 0) : null;
  const quote = abschluesse !== null && w.ist > 0 ? abschluesse / w.ist : null;

  const datum = (t: string) => new Date(`${t}T12:00:00Z`).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const rest = d.woche.tageUebrig === 0 ? 'Woche vorbei'
    : `${d.woche.tageUebrig} ${d.woche.tageUebrig === 1 ? 'Tag' : 'Tage'} übrig`;

  return (
    <>
      <h1 className="mt-2 font-display text-[34px] font-bold tracking-[-0.025em]">Vertrieb</h1>
      <p className="mb-6 mt-0.5 text-[15px] text-muted">Diese Woche · {datum(d.woche.von)} – {datum(d.woche.bis)}</p>

      <section className="rounded-[22px] bg-surface p-5">
        <div className="text-[15px] font-medium text-muted">Anrufe</div>
        <div className="mt-2 font-display text-[56px] font-bold leading-none tracking-[-0.035em] tabular-nums">
          {zahl(w.ist)}<span className="ml-1.5 text-[22px] font-medium tracking-normal text-muted">/ {zahl(w.basis)}</span>
        </div>
        <div className="my-4"><Schiene ist={w.ist} basis={w.basis} soll={w.soll} /></div>
        <div className="flex flex-wrap justify-between gap-2 text-[13px] text-muted">
          <span>
            {rest}
            {w.proTag ? ` · noch ${w.proTag} pro Tag bis zur Basis` : w.basis !== null && w.ist >= w.basis ? ' · Basis erreicht' : ''}
          </span>
          <span>Performance {zahl(w.soll)}</span>
        </div>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {w.split.map(s => (
          <div key={s.key} className="rounded-2xl bg-surface p-4">
            <div className="text-[13px] text-muted">{s.name}</div>
            <div className="mt-1.5 font-display text-[26px] font-semibold tabular-nums">
              {zahl(s.ist)}<span className="ml-1 text-[14px] font-medium text-muted">/ {zahl(s.basis)}</span>
            </div>
            <div className="mt-2.5"><Schiene ist={s.ist} basis={s.basis} soll={s.soll} hoch={4} /></div>
          </div>
        ))}
      </div>

      <h2 className="mb-2.5 mt-8 text-[20px] font-semibold tracking-tight">Ergebnis</h2>
      <div className="overflow-hidden rounded-[14px] bg-surface">
        {[
          { l: 'Termine', v: 'keine Daten aus dem CRM', leise: true },
          { l: 'Abschlüsse', v: abschluesse === null ? 'keine erfasst' : zahl(abschluesse), leise: abschluesse === null },
          { l: 'Abschlussquote', v: quote === null ? '–' : `${(quote * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`, leise: quote === null },
          { l: 'Offene Angebote', v: zahl(bestand.get('sales.pipeline_count')), leise: !bestand.has('sales.pipeline_count') },
          { l: 'Pipeline-Wert', v: bestand.has('sales.pipeline_value_eur') ? `${zahl(bestand.get('sales.pipeline_value_eur'))} €` : '–', leise: !bestand.has('sales.pipeline_value_eur') },
        ].map((r, i) => (
          <div key={r.l} className={cn('relative flex min-h-[48px] items-center px-4 text-[15px]', i > 0 && 'before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator')}>
            <span className="flex-1">{r.l}</span>
            <span className={cn('tabular-nums', r.leise ? 'text-[13px] text-muted' : 'text-muted')}>{r.v}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-2.5 mt-8 flex items-baseline justify-between text-[20px] font-semibold tracking-tight">
        Calls je Tag <span className="text-[13px] font-normal text-muted">heute {zahl(callsHeute.wert)}</span>
      </h2>
      <div className="rounded-[14px] bg-surface p-4">
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {d.woche.tage.map((t, i) => {
            const c = callsZeile.zellen[i];
            const v = callsZeile.werte[i];
            return (
              <div key={t} className="flex flex-col items-center gap-1.5">
                <span className={cn('text-[11px] font-medium', t === today ? 'text-foreground' : 'text-muted')}>{WOCHENTAGE_KURZ[i]}</span>
                <i className={cn('block aspect-square w-full max-w-[44px] rounded-[8px]', ZELLE[c], t === today && 'outline outline-2 outline-offset-2 outline-accent-hover')} />
                <span className="h-4 text-[12px] tabular-nums text-muted">{t > today ? '' : v === null ? '–' : zahl(v)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// Grenze außen, siehe „Heute".
export default function VertriebPage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <div className="mx-auto w-full max-w-[760px] px-5 pb-16 pt-4">
        <Vertrieb />
      </div>
    </Suspense>
  );
}
