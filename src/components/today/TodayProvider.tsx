'use client';

import { createContext, useContext, useOptimistic, useTransition } from 'react';
import type { MetricState } from '@/core/services/AnalyticsService';
import type { TagesStand } from '@/lib/motivation';
import type { CauseRow } from './CausesCard';
import type { RuleRow } from './RulesCard';
import type { RoutineBlock } from './RoutineCard';

/**
 * Ein gemeinsamer Zustand für „Heute": Ursachen, Regeln und Routine teilen
 * sich **ein** `useOptimistic`. Nur so laufen Ringe und „perfekter Tag" live
 * mit, egal in welcher Karte ein Haken fällt.
 *
 * Der Haken sitzt sofort und bleibt sitzen, bis die neuen Server-Daten da
 * sind — `useOptimistic` löst ihn genau dann ab (siehe Handover: eigener
 * State hatte den Wert zu früh verworfen, die Anzeige sprang zurück).
 */
export interface Heute {
  causes: CauseRow[];
  rules: RuleRow[];
  routines: RoutineBlock[];
}

export type HeutePatch =
  | {
      art: 'zeile';
      liste: 'causes' | 'rules';
      metricKey: string;
      state: MetricState;
      /** Die vom Server vorab gerechnete Serie für den neuen Zustand. */
      streak?: number;
      bestStreak?: number;
    }
  | { art: 'schritt'; id: string; done: boolean };

function anwendenAuf(stand: Heute, p: HeutePatch): Heute {
  if (p.art === 'schritt') {
    return {
      ...stand,
      routines: stand.routines.map(b => ({
        ...b,
        items: b.items.map(i => (i.id === p.id ? { ...i, done: p.done } : i)),
      })),
    };
  }
  const zeile = <T extends { metricKey: string; state: MetricState; streak: number; bestStreak: number }>(r: T): T =>
    r.metricKey === p.metricKey
      ? { ...r, state: p.state, streak: p.streak ?? r.streak, bestStreak: p.bestStreak ?? r.bestStreak }
      : r;
  return p.liste === 'causes'
    ? { ...stand, causes: stand.causes.map(zeile) }
    : { ...stand, rules: stand.rules.map(zeile) };
}

const erfuellt = (s: MetricState) => s === 'soll' || s === 'basis';

/**
 * Der Tag in der Form, die Ringe und „perfekter Tag" brauchen — dieselbe wie
 * auf dem Server (`tagAusMatrix`). Offene Ursachen zählen mit, Off-Day und
 * „erfasst" nicht.
 */
export function tagesStand(h: Heute): TagesStand {
  return {
    ursachen: h.causes.map(c => ({ erfuellt: erfuellt(c.state), zaehlt: c.state !== 'offday' && c.state !== 'erfasst' })),
    routinen: h.routines.map(b => ({
      erledigt: b.items.filter(i => i.done).length,
      gesamt: b.items.length,
      basis: b.base,
      zaehlt: !b.offDay,
    })),
    regeln: h.rules.map(r => ({ gebrochen: r.state === 'unter' })),
  };
}

interface Kontext {
  stand: Heute;
  /** Patch sofort zeigen, Aktion im Hintergrund — bis der Server neu rendert. */
  anwenden: (p: HeutePatch, aktion: () => Promise<unknown>) => void;
}

const HeuteKontext = createContext<Kontext | null>(null);

export function TodayProvider({ heute, children }: { heute: Heute; children: React.ReactNode }) {
  const [stand, zeige] = useOptimistic(heute, anwendenAuf);
  const [, starte] = useTransition();
  const anwenden = (p: HeutePatch, aktion: () => Promise<unknown>) =>
    starte(async () => {
      zeige(p);
      await aktion();
    });
  return <HeuteKontext.Provider value={{ stand, anwenden }}>{children}</HeuteKontext.Provider>;
}

export function useHeute(): Kontext {
  const k = useContext(HeuteKontext);
  if (!k) throw new Error('useHeute braucht einen TodayProvider.');
  return k;
}
