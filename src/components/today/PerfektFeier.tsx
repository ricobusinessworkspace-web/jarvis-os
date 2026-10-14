'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { istPerfekt } from '@/lib/motivation';
import { merkeGefeiert, schonGefeiert } from '@/lib/gefeiert';
import { fanfare } from '@/lib/sound';
import { JarvisOrb } from '@/components/layout/JarvisOrb';
import { tagesStand, useHeute } from './TodayProvider';

/** Perfekte Tage für beide Fälle des heutigen Tages — vom Server gerechnet. */
export interface PerfektAusblick {
  wennPerfekt: { anzahl: number; serie: number; rekord: number };
  wennNicht: { anzahl: number; serie: number; rekord: number };
}

const FEIER_MS = 3200;

/**
 * Untertitel unter „Heute" — und die Feier, wenn der Tag perfekt wird: alle
 * Kacheln erledigt, Routinen auf Basis, keine Regel gebrochen. Der Jarvis-Orb
 * in Gold, einmal je Tag und Gerät. Per Portal an `<body>`: ein Vorfahr mit
 * `backdrop-filter` macht `fixed` sonst relativ zu sich selbst.
 */
export function PerfektFeier({ date, untertitel, perfekt }: { date: string; untertitel: string; perfekt: PerfektAusblick }) {
  const { stand } = useHeute();
  const jetzt = istPerfekt(tagesStand(stand));
  const zahlen = jetzt ? perfekt.wennPerfekt : perfekt.wennNicht;

  const [feier, setFeier] = useState(false);
  const zuletzt = useRef(jetzt);
  useEffect(() => {
    const neu = jetzt && !schonGefeiert(`perfekt:${date}`);
    // Der Ton klappt nach einem Tipp (der Tick hat den Audio-Kontext entsperrt);
    // kommt der perfekte Tag von außen (ChatGPT), feiert die Seite leise.
    if (jetzt && !zuletzt.current && neu) fanfare();
    zuletzt.current = jetzt;
    if (!neu) return;
    merkeGefeiert(`perfekt:${date}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Feier ist ein Ereignis, kein abgeleiteter Zustand
    setFeier(true);
    const aus = setTimeout(() => setFeier(false), FEIER_MS);
    return () => clearTimeout(aus);
  }, [jetzt, date]);

  // Nur im Dev: `?feier=1` zeigt die Feier, ohne echte Daten anzufassen.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!new URLSearchParams(window.location.search).has('feier')) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Vorschau, nur im Dev
    setFeier(true);
  }, []);

  return (
    <>
      <p className="mb-6 mt-0.5 text-[15px] text-muted">
        {untertitel}
        {jetzt ? <span className="text-gold"> · Perfekter Tag Nr. {zahlen.anzahl}</span>
          : zahlen.serie > 1 ? <> · {zahlen.serie} perfekte Tage in Folge</> : null}
      </p>
      {feier && typeof document !== 'undefined' && createPortal(
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
          <div className="mt-4 flex items-center gap-2 text-lg font-semibold tracking-tight text-gold">
            <Sparkles className="h-4 w-4" />
            Perfekter Tag Nr. {perfekt.wennPerfekt.anzahl}
          </div>
          {perfekt.wennPerfekt.serie > 1 && <div className="mt-1 text-[13px] text-gold/80">{perfekt.wennPerfekt.serie} in Folge</div>}
        </motion.div>,
        document.body
      )}
    </>
  );
}
