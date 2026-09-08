'use client';

import { useState, useTransition } from 'react';
import { Check, Sun, Moon } from 'lucide-react';
import { logTrackerItem } from '@/actions/dashboard';
import { cn } from '@/lib/utils';

export interface RoutineItem {
  id: string;
  title: string;
  done: boolean;
}

export interface RoutineBlock {
  name: string;
  kind: 'morning' | 'evening';
  items: RoutineItem[];
}

/**
 * Morgen- und Abendroutine nebeneinander, beide vollständig sichtbar.
 * Kein Umschalter: „alles auf einen Blick" heißt, dass abends auch der
 * Morgen noch nachgetragen werden kann.
 */
export function RoutineCard({ blocks, date }: { blocks: RoutineBlock[]; date: string }) {
  const [local, setLocal] = useState(blocks);
  const [, startTransition] = useTransition();

  const toggle = (kind: string, itemId: string, done: boolean) => {
    setLocal(prev =>
      prev.map(b =>
        b.kind !== kind ? b : { ...b, items: b.items.map(i => (i.id === itemId ? { ...i, done } : i)) }
      )
    );
    startTransition(async () => {
      await logTrackerItem(itemId, done ? 'completed' : 'not_done', date);
    });
  };

  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">Routine</h3>
      </div>

      <div className="grid gap-5 md:grid-cols-2 md:gap-0">
        {local.map((block, idx) => {
          const done = block.items.filter(i => i.done).length;
          const total = block.items.length;
          const Icon = block.kind === 'morning' ? Sun : Moon;
          const accent = block.kind === 'morning' ? 'text-amber-400' : 'text-indigo-400';
          const bar = block.kind === 'morning' ? 'bg-amber-400' : 'bg-indigo-400';

          return (
            <div
              key={block.kind}
              className={cn(
                'min-w-0',
                idx === 0 ? 'md:pr-6' : 'border-t border-border/40 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0'
              )}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className={cn('h-3.5 w-3.5', accent)} />
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                  {block.name}
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-muted">
                  {done}/{total}
                </span>
              </div>

              <div className="mb-3 h-1 rounded-full bg-white/[0.07]">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', bar)}
                  style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
                />
              </div>

              <div className="flex flex-col">
                {block.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => toggle(block.kind, item.id, !item.done)}
                    className="flex items-center gap-2.5 border-t border-border/30 py-[7px] text-left text-[12.5px] first:border-t-0"
                  >
                    <span
                      className={cn(
                        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors',
                        item.done
                          ? block.kind === 'morning'
                            ? 'border-amber-400 bg-amber-400'
                            : 'border-indigo-400 bg-indigo-400'
                          : 'border-white/20'
                      )}
                    >
                      {item.done && <Check className="h-3 w-3 text-black/70" strokeWidth={3.5} />}
                    </span>
                    <span className={cn('truncate', item.done && 'text-muted line-through')}>{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
