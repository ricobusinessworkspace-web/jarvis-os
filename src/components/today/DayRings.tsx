'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { istPerfekt, ringe, type Ring } from '@/lib/motivation';
import { merkeGefeiert, schonGefeiert } from '@/lib/gefeiert';
import { fanfare } from '@/lib/sound';
import { JarvisOrb } from '@/components/layout/JarvisOrb';
import { cn } from '@/lib/utils';
import { tagesStand, useHeute } from './TodayProvider';

/** Perfekte Tage für beide Fälle des heutigen Tages — vom Server gerechnet. */
export interface PerfektAusblick {
  wennPerfekt: { anzahl: number; serie: number; rekord: number };
  wennNicht: { anzahl: number; serie: number; rekord: number };
}

const RINGE = [
  { key: 'ursachen', label: 'Ursachen', r: 38 },
  { key: 'routinen', label: 'Routinen', r: 29 },
  { key: 'regeln', label: 'Regeln', r: 20 },
] as const;

const BREITE = 7;
const FEIER_MS = 3200;

/** Ein Ring: Spur, Füllung, geschlossen mit Gold-Rand. */
function RingBogen({ ring, r }: { ring: Ring; r: number }) {
  const umfang = 2 * Math.PI * r;
  const anteil = ring.gesamt ? Math.min(1, ring.wert / ring.gesamt) : 0;
  return (
    <g>
      <circle cx={50} cy={50} r={r} fill="none" strokeWidth={BREITE} className="stroke-white/[0.07]" />
      <motion.circle
        cx={50} cy={50} r={r} fill="none" strokeWidth={BREITE} strokeLinecap="round"
        className={ring.zu ? 'stroke-gold' : 'stroke-foreground'}
        style={{ rotate: -90, transformOrigin: '50% 50%' }}
        strokeDasharray={umfang}
        initial={false}
        animate={{ strokeDashoffset: umfang * (1 - anteil) }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      />
      {ring.zu && (
        <circle
          cx={50} cy={50} r={r + BREITE / 2 + 0.6} fill="none" strokeWidth={0.8}
          className="stroke-gold/70 drop-shadow-[0_0_4px_var(--color-gold-glow)]"
        />
      )}
    </g>
  );
}

/**
 * Drei Ringe wie bei Apple Activity, oben auf „Heute" — live aus dem
 * gemeinsamen Zustand, also im selben Moment wie der Haken. Ein geschlossener
 * Ring bekommt einen Gold-Rand. Ist der Tag perfekt, feiert der Jarvis-Orb in
 * Gold — einmal je Tag und Gerät.
 */
export function DayRings({ date, perfekt }: { date: string; perfekt: PerfektAusblick }) {
  const { stand } = useHeute();
  const t = tagesStand(stand);
  const r = ringe(t);
  const jetztPerfekt = istPerfekt(t);
  const zahlen = jetztPerfekt ? perfekt.wennPerfekt : perfekt.wennNicht;

  // Feiern, wenn der Tag perfekt wird — einmal je Datum. Der Ton klappt nach
  // einem Tipp (der Tick hat den Audio-Kontext entsperrt); kommt der perfekte
  // Tag von außen (ChatGPT), feiert die Seite beim Laden eben leise.
  const [feier, setFeier] = useState(false);
  const zuletzt = useRef(jetztPerfekt);
  useEffect(() => {
    const neu = jetztPerfekt && !schonGefeiert(`perfekt:${date}`);
    if (jetztPerfekt && !zuletzt.current && neu) fanfare();
    zuletzt.current = jetztPerfekt;
    if (!neu) return;
    merkeGefeiert(`perfekt:${date}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Feier ist ein Ereignis, kein abgeleiteter Zustand
    setFeier(true);
    const aus = setTimeout(() => setFeier(false), FEIER_MS);
    return () => clearTimeout(aus);
  }, [jetztPerfekt, date]);

  // Nur im Dev: `?feier=1` zeigt die Feier, ohne echte Daten anzufassen.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!new URLSearchParams(window.location.search).has('feier')) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Vorschau, nur im Dev
    setFeier(true);
  }, []);

  return (
    <>
      <div className={cn('crm-card !flex-row items-center gap-5 !space-y-0', jetztPerfekt && 'ring-1 ring-gold/40')}>
        <svg viewBox="0 0 100 100" className="h-[92px] w-[92px] shrink-0" aria-hidden>
          {RINGE.map(({ key, r: radius }) => (
            <RingBogen key={key} ring={r[key]} r={radius} />
          ))}
        </svg>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {RINGE.map(({ key, label }) => {
            const ring = r[key];
            return (
              <div key={key} className="flex items-center gap-2 text-[12.5px]">
                <span className="flex-1 text-muted">{label}</span>
                <span className={cn('font-mono tabular-nums', ring.zu ? 'text-gold' : 'text-foreground')}>
                  {ring.gesamt ? `${ring.wert}/${ring.gesamt}` : '–'}
                </span>
                <Check className={cn('h-3.5 w-3.5', ring.zu ? 'text-gold' : 'text-transparent')} strokeWidth={3} />
              </div>
            );
          })}
          <div className="mt-1 border-t border-border/40 pt-1.5 text-[11px] text-muted">
            {jetztPerfekt ? (
              <span className="text-gold">Perfekter Tag Nr. {zahlen.anzahl}</span>
            ) : (
              <>Perfekte Tage {zahlen.anzahl}</>
            )}
            {zahlen.serie > 1 && <> · Serie {zahlen.serie}</>}
            {zahlen.rekord > 1 && <> · Rekord {zahlen.rekord}</>}
          </div>
        </div>
      </div>

      {/* Per Portal an <body>: ein Vorfahr mit `backdrop-filter` macht `fixed`
          sonst relativ zu sich selbst — die Feier lag unterhalb des Bildschirms. */}
      {feier && typeof document !== 'undefined' && createPortal(<FeierOverlay perfekt={perfekt} />, document.body)}
    </>
  );
}

/** Die Feier selbst: Orb in Gold, Text, blendet sich über die ganze Dauer selbst ein und aus. */
function FeierOverlay({ perfekt }: { perfekt: PerfektAusblick }) {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: FEIER_MS / 1000, times: [0, 0.1, 0.85, 1] }}
      role="status"
    >
      <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}>
        <JarvisOrb gold />
      </motion.div>
      <motion.div
        className="mt-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-gold [text-shadow:0_0_18px_var(--color-gold-glow)]"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Sparkles className="h-4 w-4" />
        Perfekter Tag Nr. {perfekt.wennPerfekt.anzahl}
      </motion.div>
      {perfekt.wennPerfekt.serie > 1 && (
        <div className="mt-1 text-[13px] text-gold/80">{perfekt.wennPerfekt.serie} in Folge</div>
      )}
    </motion.div>
  );
}
