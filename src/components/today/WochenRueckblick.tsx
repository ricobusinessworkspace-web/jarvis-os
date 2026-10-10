'use client';

import { useEffect, useState } from 'react';
import { Trophy, X } from 'lucide-react';
import type { Wochenrueckblick } from '@/core/services/MotivationService';
import { formatPercent } from '@/lib/metricState';
import { cn } from '@/lib/utils';

const datum = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

const SCHLUESSEL = (von: string) => `jarvis:rueckblick:${von}`;

/**
 * Dienstags (die Blockwoche beginnt neu) der Blick zurück: Quoten, neue
 * Rekorde in Gold, beste Ursache, eine Sache für nächste Woche. Alles aus
 * `wochenrueckblick()`. Wegklicken merkt sich das Gerät je Woche.
 */
export function WochenRueckblick({ r }: { r: Wochenrueckblick }) {
  const [weg, setWeg] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage gibt es erst im Browser
      if (localStorage.getItem(SCHLUESSEL(r.von))) setWeg(true);
    } catch {
      // ohne Speicher bleibt die Karte stehen
    }
  }, [r.von]);

  if (weg) return null;

  const schliessen = () => {
    setWeg(true);
    try {
      localStorage.setItem(SCHLUESSEL(r.von), '1');
    } catch {
      // egal — dann kommt sie beim nächsten Laden wieder
    }
  };

  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">Wochenrückblick</h3>
        <span className="ml-auto mr-2 text-[11px] text-muted">{datum(r.von)} – {datum(r.bis)}</span>
        <button onClick={schliessen} aria-label="Rückblick schließen" className="text-muted hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 text-[12.5px] sm:grid-cols-3">
          {r.quoten.filter(q => q.mitZiel > 0).map(q => (
            <div key={q.key} className="flex items-baseline gap-2">
              <span className="flex-1 truncate text-muted">{q.label}</span>
              <span className="font-mono tabular-nums">{q.erfuellt}/{q.mitZiel}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 text-[12.5px]">
          {r.neueRekorde.length > 0 && (
            <div className="flex items-start gap-2 text-gold">
              <Trophy className="mt-[2px] h-3.5 w-3.5 shrink-0" />
              <span>Neuer Rekord: {r.neueRekorde.map(x => `${x.label} ${x.rekord}`).join(' · ')}</span>
            </div>
          )}
          {r.besteUrsache && (
            <div className="text-muted">
              Am stärksten: <span className="text-foreground">{r.besteUrsache.label}</span>{' '}
              <span className="font-mono">{formatPercent(r.besteUrsache.erfuellt / r.besteUrsache.mitZiel)}</span>
            </div>
          )}
          {r.naechsteWoche && (
            <div className={cn('border-t border-border/40 pt-2')}>
              <span className="text-muted">Nächste Woche: </span>
              {r.naechsteWoche}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
