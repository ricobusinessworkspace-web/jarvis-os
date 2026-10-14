'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, ChevronRight } from 'lucide-react';
import { toggleCause } from '@/actions/today';
import { clearCause } from '@/actions/verlauf';
import { logTrackerItem } from '@/actions/dashboard';
import { GOLD_AB } from '@/lib/motivation';
import { tick } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { erfuellt, useHeute, type CauseRow, type RoutineBlock } from './TodayProvider';
import { useFeier } from './useFeier';

/**
 * Der Tag als Kacheln — die Fläche ist der Zustand, wie im Blocksystem:
 * Weiß = erledigt (Soll), Grau = Basis, dunkel = offen. Antippen hakt ab,
 * nochmal antippen nimmt den Haken zurück (zurück auf „offen", nicht auf
 * „nicht geschafft": bis 0 Uhr ist der Tag offen).
 */

const ton = (state: string) => (state === 'soll' ? 'voll' : state === 'basis' ? 'halb' : 'offen');

const FLAECHE = {
  voll: 'bg-foreground text-background',
  halb: 'bg-muted text-background',
  offen: 'bg-surface text-foreground',
} as const;

const NEBEN = {
  voll: 'text-background/55',
  halb: 'text-background/60',
  offen: 'text-muted',
} as const;

/** Die Serie mit Flamme — zählt beim Antippen hoch, ab 7 in Gold. */
export function Flamme({ serie, auf = 'offen' }: { serie: number; auf?: keyof typeof FLAECHE }) {
  const gold = serie >= GOLD_AB;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[13px] font-medium tabular-nums',
        gold ? (auf === 'offen' ? 'text-gold' : 'text-[#8a6514]') : auf === 'offen' ? (serie ? 'text-foreground' : 'text-muted') : NEBEN[auf]
      )}
      title={`${serie} ${serie === 1 ? 'Tag' : 'Tage'} in Folge`}
    >
      <Flame className="h-3.5 w-3.5" strokeWidth={2.2} />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={serie} initial={{ y: 7, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -7, opacity: 0 }} transition={{ duration: 0.2 }}>
          {serie}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function Kachel({
  children, flaeche, onClick, breit = false, label,
}: {
  children: React.ReactNode;
  flaeche: keyof typeof FLAECHE;
  onClick?: () => void;
  breit?: boolean;
  label?: string;
}) {
  const Tag = onClick ? motion.button : motion.div;
  return (
    <Tag
      onClick={onClick}
      aria-label={label}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      className={cn(
        'flex min-h-[128px] flex-col rounded-[22px] p-4 text-left transition-colors duration-200',
        FLAECHE[flaeche],
        breit && 'col-span-2 min-h-0',
        onClick && 'cursor-pointer'
      )}
    >
      {children}
    </Tag>
  );
}

function Leiste({ anteil, auf }: { anteil: number; auf: keyof typeof FLAECHE }) {
  return (
    <span className={cn('relative mt-3 block h-1 overflow-hidden rounded-full', auf === 'offen' ? 'bg-tertiary' : 'bg-black/20')}>
      <motion.i
        className={cn('absolute inset-y-0 left-0 block rounded-full', auf === 'offen' ? 'bg-foreground' : 'bg-black')}
        initial={false}
        animate={{ width: `${Math.min(1, anteil) * 100}%` }}
        transition={{ type: 'spring', stiffness: 160, damping: 22 }}
      />
    </span>
  );
}

/** Calls kommen aus dem CRM — die Kachel zeigt nur, mit Wochenstand. */
export function CallsKachel({ woche }: { woche: string }) {
  const { stand } = useHeute();
  const c = stand.causes.find(x => x.metricKey === 'sales.calls_count');
  if (!c) return null;
  const f = ton(c.state);
  return (
    <Kachel flaeche={f} breit>
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">Calls</span>
        <span className={cn('text-[13px]', NEBEN[f])}>aus dem CRM</span>
      </div>
      <span className="mt-3 font-display text-[40px] font-semibold leading-none tracking-tight tabular-nums">
        {c.value ?? '–'}
        <span className={cn('ml-1 text-[18px] font-medium', NEBEN[f])}>/ {c.base ?? '–'}</span>
      </span>
      <Leiste anteil={c.value && c.stretch ? c.value / c.stretch : 0} auf={f} />
      <span className={cn('mt-auto flex justify-between pt-3 text-[13px]', NEBEN[f])}>
        <span>Basis {c.base ?? '–'} · Soll {c.stretch ?? '–'}</span>
        <span className="tabular-nums">Woche {woche}</span>
      </span>
    </Kachel>
  );
}

/** Training, Post — antippen hakt ab. */
export function UrsacheKachel({ metricKey, date }: { metricKey: string; date: string }) {
  const { stand, anwenden } = useHeute();
  const { feiern, ausloesen } = useFeier();
  const row = stand.causes.find(x => x.metricKey === metricKey);
  if (!row) return null;
  const an = erfuellt(row.state);
  const frei = row.state === 'offday';
  const f = ton(row.state);

  const toggle = (r: CauseRow) => {
    const done = !an;
    const nachher = r.ausblick ? (done ? r.ausblick.wennErfuellt : r.ausblick.wennNicht) : null;
    if (nachher && r.ausblick) ausloesen(r.metricKey, r.label, r.ausblick, nachher, done);
    anwenden(
      { art: 'zeile', liste: 'causes', metricKey: r.metricKey, state: done ? 'soll' : 'ungemessen', streak: nachher?.serie, bestStreak: nachher?.rekord },
      async () => {
        const res = done ? await toggleCause(r.metricKey, date, true) : await clearCause(r.metricKey, date);
        if (!res?.success) console.error('[Heute]', res?.error);
      }
    );
  };
  const feier = feiern[metricKey];

  return (
    <Kachel flaeche={f} onClick={frei ? undefined : () => toggle(row)} label={an ? `${row.label}: Haken entfernen` : `${row.label} abhaken`}>
      <span className="text-[15px] font-semibold">{row.label}</span>
      <span
        className={cn(
          'mt-3 grid h-[26px] w-[26px] place-items-center rounded-full',
          an ? 'bg-background' : 'border-2 border-tertiary'
        )}
      >
        {an && <span className="mb-0.5 h-[5px] w-[10px] -rotate-45 border-b-[2.5px] border-l-[2.5px] border-foreground" />}
      </span>
      <span className={cn('mt-auto flex items-center justify-between gap-2 pt-3 text-[13px]', NEBEN[f])}>
        <AnimatePresence initial={false} mode="wait">
          {feier ? (
            <motion.span key="f" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={cn('font-medium', an ? 'text-[#8a6514]' : 'text-gold')}>
              {feier.text}
            </motion.span>
          ) : (
            <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {frei ? 'heute frei' : an ? 'Erledigt' : 'Antippen'}
            </motion.span>
          )}
        </AnimatePresence>
        <Flamme serie={row.streak} auf={f} />
      </span>
    </Kachel>
  );
}

/** Morgen- oder Abendroutine — antippen klappt die Schritte auf. */
export function RoutineKachel({ block, offen, onOpen }: { block: RoutineBlock; offen: boolean; onOpen: () => void }) {
  const n = block.items.filter(i => i.done).length;
  const total = block.items.length;
  const f = block.offDay ? 'offen' : n >= total && total > 0 ? 'voll' : block.base !== null && n >= block.base ? 'halb' : 'offen';
  return (
    <Kachel flaeche={f} onClick={onOpen} label={`${block.name}: Schritte ${offen ? 'zuklappen' : 'aufklappen'}`}>
      <span className="text-[15px] font-semibold">{block.kind === 'morning' ? 'Morgen' : 'Abend'}</span>
      <span className="mt-3 font-display text-[40px] font-semibold leading-none tracking-tight tabular-nums">
        {n}<span className={cn('ml-1 text-[18px] font-medium', NEBEN[f])}>/ {total}</span>
      </span>
      <Leiste anteil={total ? n / total : 0} auf={f} />
      <span className={cn('mt-auto flex items-center justify-between pt-3 text-[13px]', NEBEN[f])}>
        <span>
          {block.offDay ? 'heute frei' : block.base === null ? (block.targetHint ?? 'Ziel fehlt')
            : n >= total ? 'Komplett' : n >= block.base ? 'Basis erreicht' : `Basis ab ${block.base}`}
        </span>
        <span className="inline-flex items-center">{offen ? 'Fertig' : 'Schritte'}<ChevronRight className={cn('h-3.5 w-3.5 transition-transform', offen && 'rotate-90')} /></span>
      </span>
    </Kachel>
  );
}

export function RoutineSchritte({ block, date }: { block: RoutineBlock; date: string }) {
  const { anwenden } = useHeute();
  const toggle = (id: string, done: boolean) => {
    if (!done) tick(); // nur beim Abhaken, aus dem Klick heraus
    anwenden({ art: 'schritt', id, done: !done }, () => logTrackerItem(id, done ? 'not_done' : 'completed', date));
  };
  return (
    <div className="overflow-hidden rounded-[14px] bg-surface">
      {block.items.map((i, idx) => (
        <button
          key={i.id}
          onClick={() => toggle(i.id, i.done)}
          className={cn('relative flex min-h-[50px] w-full items-center gap-3 px-4 text-left text-[15px]', idx > 0 && 'before:absolute before:left-[52px] before:right-0 before:top-0 before:h-px before:bg-separator')}
        >
          <Kreis an={i.done} />
          <span className={cn('flex-1', i.done && 'text-muted')}>{i.title}</span>
        </button>
      ))}
    </div>
  );
}

function Kreis({ an, rot = false }: { an: boolean; rot?: boolean }) {
  return (
    <motion.span
      key={`${an}${rot}`}
      initial={{ scale: 0.75 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-full',
        rot ? 'bg-error text-background' : an ? 'bg-foreground' : 'border-2 border-tertiary'
      )}
    >
      {rot ? <span className="-mt-px text-[15px] font-bold leading-none">×</span>
        : an && <span className="mb-0.5 h-[5px] w-[9px] -rotate-45 border-b-[2.5px] border-l-[2.5px] border-background" />}
    </motion.span>
  );
}

/**
 * Regeln als iOS-Liste. Gehalten ist der Normalfall — antippen trägt einen
 * Rückfall ein, nochmal antippen nimmt ihn zurück. Kein Ton, keine Feier.
 */
export function RegelnListe({ date, joker }: { date: string; joker: boolean }) {
  const { stand, anwenden } = useHeute();
  const toggle = (metricKey: string, broken: boolean) => {
    const r = stand.rules.find(x => x.metricKey === metricKey)!;
    const nachher = r.ausblick ? (broken ? r.ausblick.wennErfuellt : r.ausblick.wennNicht) : null;
    anwenden(
      { art: 'zeile', liste: 'rules', metricKey, state: broken ? 'soll' : 'unter', streak: nachher?.serie, bestStreak: nachher?.rekord },
      async () => {
        const res = broken ? await clearCause(metricKey, date) : await toggleCause(metricKey, date, false);
        if (!res?.success) console.error('[Regeln]', res?.error);
      }
    );
  };
  return (
    <div className="overflow-hidden rounded-[14px] bg-surface">
      {stand.rules.map((r, idx) => {
        const broken = r.state === 'unter';
        return (
          <button
            key={r.metricKey}
            onClick={() => toggle(r.metricKey, broken)}
            aria-label={broken ? `${r.label}: Rückfall zurücknehmen` : `${r.label}: Rückfall eintragen`}
            className={cn('relative flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left', idx > 0 && 'before:absolute before:left-[52px] before:right-0 before:top-0 before:h-px before:bg-separator')}
          >
            <Kreis an={!broken} rot={broken} />
            <span className="flex-1">
              <span className="block text-[15px]">{r.label}</span>
              <span className={cn('block text-[13px]', broken ? 'text-error' : 'text-muted')}>
                {broken ? (joker ? 'Rückfall · Sonntag ist Joker, Serie bleibt' : 'Rückfall heute · antippen zum Zurücknehmen') : 'gehalten'}
              </span>
            </span>
            <Flamme serie={r.streak} />
          </button>
        );
      })}
    </div>
  );
}

/** Die vier Kacheln + aufklappbare Schritte — der Block unter der Calls-Kachel. */
export function Tageskacheln({ date }: { date: string }) {
  const { stand } = useHeute();
  const [offen, setOffen] = useState<string | null>(null);
  const routine = (kind: 'morning' | 'evening') => stand.routines.find(b => b.kind === kind);
  const offenBlock = stand.routines.find(b => b.trackerId === offen);
  return (
    <>
      <UrsacheKachel metricKey="training.sessions" date={date} />
      <UrsacheKachel metricKey="content.posts" date={date} />
      {(['morning', 'evening'] as const).map(k => {
        const b = routine(k);
        return b ? <RoutineKachel key={k} block={b} offen={offen === b.trackerId} onOpen={() => setOffen(o => (o === b.trackerId ? null : b.trackerId))} /> : null;
      })}
      {offenBlock && (
        <div className="col-span-2">
          <RoutineSchritte block={offenBlock} date={date} />
        </div>
      )}
    </>
  );
}
