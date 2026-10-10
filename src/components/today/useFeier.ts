'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { feierFuer, type SerienStand } from '@/lib/motivation';
import { merkeGefeiert, schonGefeiert } from '@/lib/gefeiert';
import { fanfare, tick } from '@/lib/sound';
import type { Feier } from './HabitRow';

const DAUER_MS = 3200;

/**
 * Ton und Feier beim Antippen — nur aus dem Klick heraus (iOS spielt Ton nur
 * auf eine Berührung). Ob gefeiert wird, entscheiden die Zahlen des Servers
 * (`feierFuer`); eine Stufe wird je Lauf nur einmal gefeiert (`localStorage`).
 */
export function useFeier() {
  const [feiern, setFeiern] = useState<Record<string, Feier>>({});
  const uhren = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const offen = uhren.current;
    return () => Object.values(offen).forEach(clearTimeout);
  }, []);

  const ausloesen = useCallback(
    (key: string, name: string, vorher: SerienStand, nachher: SerienStand, handlung: boolean) => {
      if (!handlung) return;
      const f = feierFuer(vorher, nachher, handlung);
      const stufeNeu = f.stufe !== null && !schonGefeiert(`${key}:${f.stufe}:${nachher.start}`);

      let feier: Feier | null = null;
      if (stufeNeu) {
        merkeGefeiert(`${key}:${f.stufe}:${nachher.start}`);
        feier = { art: 'stufe', text: `Stufe ${f.stufe} erreicht — ${f.stufe} Tage ${name}` };
      } else if (f.rekord) {
        feier = { art: 'rekord', text: `Neuer Rekord — ${nachher.rekord} Tage` };
      }

      if (!feier) {
        tick();
        return;
      }
      fanfare();
      setFeiern(alt => ({ ...alt, [key]: feier }));
      clearTimeout(uhren.current[key]);
      uhren.current[key] = setTimeout(() => {
        setFeiern(alt => {
          const rest = { ...alt };
          delete rest[key];
          return rest;
        });
      }, DAUER_MS);
    },
    []
  );

  return { feiern, ausloesen };
}
