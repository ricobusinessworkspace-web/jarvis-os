import { Suspense } from 'react';
import { AnalyticsService } from '@/core/services/AnalyticsService';
import { TaskInboxService } from '@/core/services/TaskInboxService';
import { RoutineService } from '@/core/services/RoutineService';
import { ausblick, perfekteTage } from '@/core/services/MotivationService';
import { heuteUndWoche } from '@/core/services/WochenService';
import { getBerlinDateStr } from '@/lib/dateUtils';
import { blockInfo, isJokerDay, addDays } from '@/lib/blocks';
import { PHASE_2_START } from '@/lib/phases';
import { EMPTY_METRIC } from '@/lib/metricState';
import { RouteLoading } from '@/components/layout/RouteLoading';
import { TodayProvider, type CauseRow, type RuleRow } from '@/components/today/TodayProvider';
import { CallsKachel, RegelnListe, Tageskacheln } from '@/components/today/Kacheln';
import { WocheKarte } from '@/components/today/WocheKarte';
import { PerfektFeier } from '@/components/today/PerfektFeier';

export const dynamic = 'force-dynamic';

/**
 * „Heute" — der Tag ist der Hauptteil, die Woche darunter, Vorwochen gibt es
 * nicht (Rico, 14.10.). Bearbeitbar ist nur heute; um 0 Uhr ist der Tag zu.
 *
 * Alle Serien und Rekorde rechnet der Server mit `summarize` — für beide
 * Fälle des heutigen Hakens (`ausblick`). Die Kacheln wählen nur aus.
 */
const URSACHEN = [
  { key: 'sales.calls_count', label: 'Calls' },
  { key: 'training.sessions', label: 'Training' },
  { key: 'content.posts', label: 'Post' },
];

async function Today() {
  const today = getBerlinDateStr();
  const block = blockInfo(today);
  // Serien laufen ab Blockstart über den Phasenschnitt — wie bisher.
  const from = block.beforeStart ? addDays(today, -45) : block.blockStart;

  // Nacheinander, nicht parallel: der Pooler gibt pro Instanz eine Verbindung.
  const matrix = await AnalyticsService.getMatrix(from, today);
  const rules = (await AnalyticsService.getDefinitions()).filter(d => d.domain === 'rules' && d.isActive);
  const routines = await RoutineService.getRoutineBlocks(today);
  const woche = await heuteUndWoche(today);
  const crmTasks = await TaskInboxService.getCrmTasks();
  const reminders = await TaskInboxService.getReminders();

  const ruleKeys = new Set(rules.map(r => r.key));
  const cell = (key: string) => matrix[today]?.[key] ?? EMPTY_METRIC;
  const serie = (key: string) => ausblick(matrix, key, today, { serieAb: from, regel: ruleKeys.has(key) });

  const causeRows: CauseRow[] = URSACHEN.map(m => {
    const c = cell(m.key);
    const a = serie(m.key);
    return {
      metricKey: m.key,
      label: m.label,
      state: c.state,
      toggleable: m.key !== 'sales.calls_count',
      value: c.value,
      base: c.base,
      stretch: c.stretch,
      streak: a.serie,
      bestStreak: a.rekord,
      ausblick: a,
    };
  });

  const ruleRows: RuleRow[] = rules.map(r => {
    const a = serie(r.key);
    return { metricKey: r.key, label: r.label, state: cell(r.key).state, streak: a.serie, bestStreak: a.rekord, ausblick: a };
  });

  const routineBlocks = routines.map(b => {
    const m = cell(`routine.${b.kind}`);
    return { ...b, base: m.base, targetHint: m.targetHint, offDay: m.state === 'offday' };
  });

  // Perfekte Tage zählen ab Phase 2 — beide Fälle, der Browser wählt nur aus.
  const perfektAb = PHASE_2_START > from ? PHASE_2_START : from;
  const regelKeys = [...ruleKeys];
  const zahlen = (heutePerfekt: boolean) => {
    const p = perfekteTage(matrix, regelKeys, perfektAb, today, heutePerfekt);
    return { anzahl: p.anzahl, serie: p.serie, rekord: p.rekord };
  };

  const datum = new Date(`${today}T12:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });

  const aufgaben = [
    ...reminders.items.map(r => ({ id: `r${r.id}`, titel: r.title, meta: `Erinnerung${r.listName ? ` · ${r.listName}` : ''}${r.overdue ? ' · überfällig' : ''}`, rot: r.overdue })),
    ...crmTasks.map(t => ({ id: `c${t.id}`, titel: t.text, meta: `CRM · ${t.leadName}`, rot: false })),
  ];

  return (
    <TodayProvider heute={{ causes: causeRows, rules: ruleRows, routines: routineBlocks }}>
      <h1 className="mt-2 font-display text-[34px] font-bold tracking-[-0.025em]">Heute</h1>
      <PerfektFeier
        date={today}
        untertitel={`${datum} · bearbeitbar bis 0 Uhr`}
        perfekt={{ wennPerfekt: zahlen(true), wennNicht: zahlen(false) }}
      />

      <div className="grid grid-cols-2 gap-3">
        <CallsKachel woche={`${woche.woche.calls.ist} / ${woche.woche.calls.basis ?? '–'}`} />
        <Tageskacheln date={today} />
      </div>

      {ruleRows.length > 0 && (
        <section>
          <h2 className="mb-2.5 mt-8 flex items-baseline justify-between text-[20px] font-semibold tracking-tight">
            Regeln <span className="text-[13px] font-normal text-muted">antippen bei Rückfall</span>
          </h2>
          <RegelnListe date={today} joker={isJokerDay(today)} />
        </section>
      )}

      <WocheKarte
        zeilen={woche.woche.zeilen}
        heuteIndex={woche.woche.tage.indexOf(today)}
        tageUebrig={woche.woche.tageUebrig}
        von={woche.woche.von}
        bis={woche.woche.bis}
        rueckfaelleHeuteServer={ruleRows.filter(r => r.state === 'unter').length}
      />

      {aufgaben.length > 0 && (
        <section>
          <h2 className="mb-2.5 mt-8 flex items-baseline justify-between text-[20px] font-semibold tracking-tight">
            Aufgaben <span className="text-[13px] font-normal text-muted">{Math.min(5, aufgaben.length)} von {aufgaben.length}</span>
          </h2>
          <div className="overflow-hidden rounded-[14px] bg-surface">
            {aufgaben.slice(0, 5).map((a, i) => (
              <div key={a.id} className={`relative px-4 py-3 ${i > 0 ? 'before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-separator' : ''}`}>
                <div className="text-[15px]">{a.titel}</div>
                <div className={`text-[13px] ${a.rot ? 'text-error' : 'text-muted'}`}>{a.meta}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </TodayProvider>
  );
}

// Die Grenze liegt außen: der Ladezustand ersetzt den ganzen Inhaltsbereich.
export default function DashboardPage() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <div className="mx-auto w-full max-w-[760px] px-5 pb-16 pt-4">
        <Today />
      </div>
    </Suspense>
  );
}
