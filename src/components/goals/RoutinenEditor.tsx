'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  addRoutineItem, deleteRoutineItem, moveRoutineItem, renameRoutine, renameRoutineItem,
} from '@/actions/routines';
import { cn } from '@/lib/utils';

interface Block {
  trackerId: string;
  name: string;
  items: Array<{ id: string; title: string }>;
}

/**
 * Routinen bearbeiten — umbenennen, verschieben, entfernen, ergänzen. Lebte
 * früher im Bearbeiten-Modus der Routine-Karte auf „Heute"; dort stehen jetzt
 * nur noch die Kacheln.
 *
 * Entfernen **archiviert** ab heute: bisherige Haken und die Bewertung
 * vergangener Tage bleiben (siehe Handover — `onDelete: Cascade` hat einmal
 * Daten vernichtet). Trotzdem ein zweiter Tipp zur Sicherheit.
 */
export function RoutinenEditor({ bloecke }: { bloecke: Block[] }) {
  const [laeuft, starte] = useTransition();
  const [sicher, setSicher] = useState<string | null>(null);
  const [neu, setNeu] = useState<Record<string, string>>({});
  const run = (fn: () => Promise<unknown>) => starte(() => void fn());

  return (
    <div className={cn('flex flex-col gap-5', laeuft && 'opacity-70')}>
      {bloecke.map(b => (
        <div key={b.trackerId}>
          <input
            defaultValue={b.name}
            aria-label="Name der Routine"
            onBlur={e => e.target.value.trim() && e.target.value !== b.name && run(() => renameRoutine(b.trackerId, e.target.value))}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            className="mb-2 w-full bg-transparent text-[13px] font-semibold uppercase tracking-wide text-muted outline-none focus:text-foreground"
          />
          <div className="overflow-hidden rounded-[14px] bg-elevated/60">
            {b.items.map((i, idx) => (
              <div key={i.id} className={cn('relative flex min-h-[48px] items-center gap-2 px-3', idx > 0 && 'before:absolute before:left-3 before:right-0 before:top-0 before:h-px before:bg-separator')}>
                <div className="flex flex-col">
                  <button aria-label="nach oben" disabled={idx === 0} onClick={() => run(() => moveRoutineItem(i.id, 'up'))} className="text-muted hover:text-foreground disabled:opacity-20"><ChevronUp className="h-3.5 w-3.5" /></button>
                  <button aria-label="nach unten" disabled={idx === b.items.length - 1} onClick={() => run(() => moveRoutineItem(i.id, 'down'))} className="text-muted hover:text-foreground disabled:opacity-20"><ChevronDown className="h-3.5 w-3.5" /></button>
                </div>
                <input
                  defaultValue={i.title}
                  aria-label="Schritt"
                  onBlur={e => e.target.value.trim() && e.target.value !== i.title && run(() => renameRoutineItem(i.id, e.target.value))}
                  onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                />
                <button
                  onClick={() => (sicher === i.id ? (run(() => deleteRoutineItem(i.id)), setSicher(null)) : setSicher(i.id))}
                  onBlur={() => setSicher(null)}
                  title={sicher === i.id ? 'Ab heute entfernen — bisherige Haken bleiben' : 'Entfernen'}
                  className={cn('shrink-0 rounded-md px-2 py-1 text-[12px]', sicher === i.id ? 'bg-error/15 text-error' : 'text-muted hover:text-error')}
                >
                  {sicher === i.id ? 'Entfernen?' : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
            <div className="relative flex min-h-[48px] items-center gap-2 px-3 before:absolute before:left-3 before:right-0 before:top-0 before:h-px before:bg-separator">
              <Plus className="h-4 w-4 text-muted" />
              <input
                value={neu[b.trackerId] ?? ''}
                onChange={e => setNeu(n => ({ ...n, [b.trackerId]: e.target.value }))}
                onKeyDown={e => {
                  const t = (neu[b.trackerId] ?? '').trim();
                  if (e.key === 'Enter' && t) {
                    run(() => addRoutineItem(b.trackerId, t));
                    setNeu(n => ({ ...n, [b.trackerId]: '' }));
                  }
                }}
                placeholder="Schritt hinzufügen"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
              />
            </div>
          </div>
        </div>
      ))}
      <p className="text-[12px] text-muted">Entfernen gilt ab heute — vergangene Tage behalten ihre Haken. Neue Schritte zählen ab heute.</p>
    </div>
  );
}
