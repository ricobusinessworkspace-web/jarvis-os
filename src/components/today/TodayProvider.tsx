'use client';

import { createContext, useContext, useOptimistic, useTransition } from 'react';
import type { MetricState } from '@/core/services/AnalyticsService';
import type { Ausblick, TagesStand } from '@/lib/motivation';

/**
 * Ein gemeinsamer Zustand für „Heute": Kacheln, Regeln und Woche teilen sich
 * **ein** `useOptimistic`. Der Haken sitzt sofort und bleibt sitzen, bis die
 * neuen Server-Daten da sind — `useOptimistic` löst ihn genau dann ab (eigener
 * State hatte den Wert zu früh verworfen, die Anzeige sprang zurück).
 */

export interface CauseRow {
  metricKey: string;
  label: string;
  state: MetricState;
  /** Calls kommen aus dem CRM und werden nicht abgehakt. */
  toggleable: boolean;
  /** Nur Calls: Wert und Ziele für die breite Kachel. */
  value?: number | null;
  base?: number | null;
  stretch?: number | null;
  streak: number;
  bestStreak: number;
  /** Serie und Rekord für beide Fälle des heutigen Hakens — vom Server gerechnet. */
  ausblick?: Ausblick;
}

export interface RuleRow {
  metricKey: string;
  label: string;
  state: MetricState;
  streak: number;
  bestStreak: number;
  ausblick?: Ausblick;
}

export interface RoutineItem {
  id: string;
  title: string;
  done: boolean;
}

export interface RoutineBlock {
  trackerId: string;
  name: string;
  kind: 'morning' | 'evening';
  items: RoutineItem[];
  /** Ab so vielen Schritten gilt die Basis — aus der Metrik, nicht hier gerechnet. */
  base: number | null;
  targetHint?: string;
  /** Sonntag: die Routine gilt nicht. */
  offDay?: boolean;
}

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

export const erfuellt = (s: MetricState) => s === 'soll' || s === 'basis';

/**
 * Der Tag in der Form, die „perfekter Tag" braucht — dieselbe wie auf dem
 * Server (`tagAusMatrix`). Off-Day und „erfasst" zählen nicht.
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
