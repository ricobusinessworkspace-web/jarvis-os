'use client';

import type { WochenZeile, Zelle } from '@/core/services/WochenService';
import { cn } from '@/lib/utils';
import { ZELLE, WOCHENTAGE_KURZ } from '@/lib/zellen';
import { erfuellt, useHeute, type Heute } from './TodayProvider';

/**
 * Die laufende Woche Mo–So im Jarvis-Blocksystem: Weiß = Soll, Grau = Basis,
 * Rot = darunter, Rahmen = nicht gemessen bzw. heute offen, gedämpft = frei
 * oder kommt noch. Vorwochen gibt es hier nicht — die Woche ist das, was sich
 * noch retten lässt.
 *
 * Die heutige Spalte läuft live mit den Kacheln (gemeinsamer Zustand); alle
 * anderen Tage stehen fest, wie sie bis 0 Uhr eingetragen waren.
 */
const TAGE = WOCHENTAGE_KURZ;
const zaehlt = (z: Zelle) => z === 'soll' || z === 'basis';

/** Heutige Zelle aus dem optimistischen Zustand — dieselben Regeln wie `zelle()` im WochenService. */
function heuteLive(key: string, stand: Heute, server: Zelle): Zelle {
  if (server === 'frei') return 'frei';
  const c = stand.causes.find(x => x.metricKey === key);
  if (c && key !== 'sales.calls_count') return erfuellt(c.state) ? 'soll' : 'offen';
  const kind = key === 'routine.morning' ? 'morning' : key === 'routine.evening' ? 'evening' : null;
  const b = kind && stand.routines.find(r => r.kind === kind);
  if (b) {
    const n = b.items.filter(i => i.done).length;
    return n >= b.items.length && n > 0 ? 'soll' : b.base !== null && n >= b.base ? 'basis' : 'offen';
  }
  if (key === 'regeln') return stand.rules.some(r => r.state === 'unter') ? 'unter' : 'soll';
  return server;
}

export function WocheKarte({
  zeilen, heuteIndex, tageUebrig, von, bis, rueckfaelleHeuteServer,
}: {
  zeilen: WochenZeile[];
  heuteIndex: number;
  tageUebrig: number;
  von: string;
  bis: string;
  /** Rückfälle heute laut Server — damit die Wochensumme live mitzählt. */
  rueckfaelleHeuteServer: number;
}) {
  const { stand } = useHeute();
  const datum = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });

  return (
    <section>
      <h2 className="mb-2.5 mt-8 flex items-baseline justify-between text-[20px] font-semibold tracking-tight">
        Diese Woche
        <span className="text-[13px] font-normal text-muted">
          {datum(von)} – {datum(bis)} · {tageUebrig === 0 ? 'Woche vorbei' : `${tageUebrig} ${tageUebrig === 1 ? 'Tag' : 'Tage'} übrig`}
        </span>
      </h2>
      <div className="rounded-[14px] bg-surface p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(7,18px)_56px] items-center gap-x-[5px] gap-y-2 text-[14px] sm:grid-cols-[minmax(0,1fr)_repeat(7,22px)_68px] sm:gap-x-[7px]">
          <span />
          {TAGE.map((t, i) => (
            <span key={i} className={cn('text-center text-[11px] font-medium', i === heuteIndex ? 'text-foreground' : 'text-muted')}>{t}</span>
          ))}
          <span />
          {zeilen.map(z => {
            const serverHeute = z.zellen[heuteIndex];
            const live = heuteIndex >= 0 ? heuteLive(z.key, stand, serverHeute) : serverHeute;
            const zellen = z.zellen.map((c, i) => (i === heuteIndex ? live : c));
            let rechts: React.ReactNode;
            if (z.key === 'regeln') {
              const heute = stand.rules.filter(r => r.state === 'unter').length;
              const summe = z.ist - rueckfaelleHeuteServer + heute;
              rechts = summe ? <span className="text-error">{summe} Rückf.</span> : <span className="text-muted">gehalten</span>;
            } else {
              const ist = z.key === 'sales.calls_count' ? z.ist : z.ist - (zaehlt(serverHeute) ? 1 : 0) + (zaehlt(live) ? 1 : 0);
              rechts = <>{ist}<span className="text-[12px] text-muted"> / {z.ziel ?? '–'}</span></>;
            }
            return (
              <div key={z.key} className="contents">
                <span className="truncate">{z.name}</span>
                {zellen.map((c, i) => (
                  <i
                    key={i}
                    className={cn('block aspect-square w-full rounded-[5px] sm:rounded-[6px]', ZELLE[c], i === heuteIndex && 'outline outline-2 outline-offset-2 outline-accent-hover')}
                    title={c}
                  />
                ))}
                <span className="text-right tabular-nums">{rechts}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-muted">
          {([['soll', 'Soll'], ['basis', 'Basis'], ['unter', 'darunter'], ['leer', 'nicht gemessen'], ['frei', 'frei']] as const).map(([z, l]) => (
            <span key={z} className="inline-flex items-center gap-1.5"><i className={cn('inline-block h-3 w-3 rounded-[3.5px]', ZELLE[z])} />{l}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
