'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import type { MetricState } from '@/core/services/AnalyticsService';
import { GOLD_AB, naechsteStufe, stufe } from '@/lib/motivation';
import { cn } from '@/lib/utils';
import { StateBox } from './StateBox';

/** Was gerade gefeiert wird — kommt aus den Zahlen des Servers (`feierFuer`). */
export interface Feier {
  art: 'rekord' | 'stufe';
  text: string;
}

/** Die Flamme wächst mit der Stufe — ab 7 in Gold. */
const FLAMME: Record<number, string> = {
  0: 'h-3.5 w-3.5',
  3: 'h-[15px] w-[15px]',
  7: 'h-4 w-4',
  14: 'h-[17px] w-[17px]',
  21: 'h-[18px] w-[18px]',
  30: 'h-[19px] w-[19px]',
  50: 'h-5 w-5',
  100: 'h-[22px] w-[22px]',
};

/**
 * Eine Zeile in Ursachen und Regeln — beide Karten sehen gleich aus:
 * Kästchen, Name, eine ruhige Unterzeile, rechts die Serie. Die Serie steht
 * immer da, auch bei 0: sie ist das, worum es in beiden Karten geht.
 *
 * Rückmeldung beim Antippen: das Kästchen ploppt, die Flamme zuckt, die Zahl
 * zählt. Alles nur bei einer Änderung, nie beim ersten Bild
 * (`AnimatePresence initial={false}`). Gold nur für Stufen ab 7 und Feiern.
 */
export function HabitRow({
  label, sub, subTone = 'muted', state, markMissed = false, streak, onToggle, toggleLabel, feier = null,
}: {
  label: string;
  sub: React.ReactNode;
  subTone?: 'muted' | 'error';
  /** Der Zustand, wie das Kästchen ihn zeigen soll. */
  state: MetricState;
  /** Kreuz im roten Kästchen — bei Regeln heißt rot „gebrochen", nicht „offen". */
  markMissed?: boolean;
  streak: number;
  /** Ohne Handler ist das Kästchen reine Anzeige (Calls kommen aus dem CRM). */
  onToggle?: () => void;
  toggleLabel: string;
  feier?: Feier | null;
}) {
  // Fehlt die Zahl (Hot Reload mit alten Zeilen), steht „–" — nie NaN.
  const known = Number.isFinite(streak);
  const level = known ? stufe(streak) : 0;
  const gold = level >= GOLD_AB;
  const next = known ? naechsteStufe(streak) : null;
  const done = state === 'soll' || state === 'basis';

  const titel = known
    ? [
        `${streak} ${streak === 1 ? 'Tag' : 'Tage'} in Folge`,
        level ? `Stufe ${level}` : null,
        next ? `nächste Stufe bei ${next}` : null,
      ].filter(Boolean).join(' · ')
    : undefined;

  return (
    <div className="flex items-center gap-3 border-t border-border/40 py-2.5 first:border-t-0 first:pt-0">
      <button
        onClick={onToggle}
        disabled={!onToggle}
        aria-label={toggleLabel}
        title={onToggle ? toggleLabel : undefined}
        className={cn('shrink-0 transition-transform', onToggle ? 'cursor-pointer active:scale-90' : 'cursor-default')}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={`${state}-${done}`}
            initial={{ scale: done ? 0.6 : 0.85 }}
            animate={{ scale: 1 }}
            exit={{ opacity: 1, transition: { duration: 0 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 16 }}
          >
            <StateBox state={state} markMissed={markMissed} />
          </motion.div>
        </AnimatePresence>
      </button>

      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm leading-snug">{label}</div>
        <AnimatePresence initial={false} mode="wait">
          {feier ? (
            <motion.div
              key={feier.text}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-0.5 text-[11px] font-medium text-gold [text-shadow:0_0_10px_var(--color-gold-glow)]"
            >
              {feier.text}
            </motion.div>
          ) : (
            <motion.div
              key="sub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn('mt-0.5 text-[11px]', subTone === 'error' ? 'text-error' : 'text-muted')}
            >
              {sub}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div
        className={cn(
          'flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums',
          gold ? 'text-gold' : streak > 0 ? 'text-foreground' : 'text-muted'
        )}
        title={titel}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={`f${streak}`}
            initial={{ scale: 1.45, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 11 }}
            className="flex"
          >
            <Flame
              className={cn(
                FLAMME[level] ?? FLAMME[0],
                streak === 0 && 'opacity-50',
                gold && 'drop-shadow-[0_0_6px_var(--color-gold-glow)]'
              )}
            />
          </motion.span>
        </AnimatePresence>
        <span className="relative inline-flex min-w-[1ch] justify-end overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={`n${streak}`}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {known ? streak : '–'}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}
