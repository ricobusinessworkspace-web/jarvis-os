'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { Check, Sun, Moon, Pencil, Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { logTrackerItem } from '@/actions/dashboard';
import {
  addRoutineItem, renameRoutineItem, deleteRoutineItem, moveRoutineItem, renameRoutine,
} from '@/actions/routines';
import { cn } from '@/lib/utils';

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
  /** Ab so vielen erledigten Schritten gilt die Basis — aus der Metrik, nicht
   *  hier gerechnet. `null`: keine Grenze hinterlegt, `targetHint` sagt warum. */
  base: number | null;
  targetHint?: string;
}

/**
 * Morgen- und Abendroutine nebeneinander, beide vollständig sichtbar.
 * Kein Umschalter: „alles auf einen Blick" heißt, dass abends auch der
 * Morgen noch nachgetragen werden kann.
 *
 * Im Bearbeiten-Modus lassen sich Schritte umbenennen, verschieben, löschen
 * und ergänzen. Löschen nimmt die Historie des Schritts mit, deshalb braucht
 * es dort einen zweiten Klick.
 *
 * Basis = alle Schritte bis auf höchstens drei (`maxSkip` der Metrik), gleich
 * welche; Soll = alle. Die Grenze kommt als `base` aus der Metrik — die Karte
 * rechnet sie nicht selbst nach, sonst stünde sie zweimal im Code.
 */
export function RoutineCard({ blocks, date }: { blocks: RoutineBlock[]; date: string }) {
  const [editing, setEditing] = useState(false);

  /**
   * `useOptimistic` statt eigenem State: der gesetzte Haken bleibt genau so
   * lange stehen, bis die neuen Server-Daten da sind, und geht dann nahtlos
   * in sie über. Vorher habe ich den optimistischen Wert selbst gelöscht,
   * sobald die Action zurückkam — da war die Seite aber noch nicht neu
   * gerendert, und der Haken sprang sichtbar zurück.
   */
  const [optimisticBlocks, applyOptimistic] = useOptimistic(
    blocks,
    (state: RoutineBlock[], patch: { id: string; done: boolean }) =>
      state.map(b => ({
        ...b,
        items: b.items.map(i => (i.id === patch.id ? { ...i, done: patch.done } : i)),
      }))
  );

  const toggle = (item: RoutineItem, startTransition: React.TransitionStartFunction) => {
    startTransition(async () => {
      applyOptimistic({ id: item.id, done: !item.done });
      await logTrackerItem(item.id, !item.done ? 'completed' : 'not_done', date);
    });
  };

  return (
    <div className="crm-card">
      <div className="crm-header">
        <h3 className="crm-title">Routine</h3>
        <button
          onClick={() => setEditing(e => !e)}
          className={cn(
            'ml-auto flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-colors',
            editing
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-border/60 text-muted hover:text-foreground'
          )}
        >
          {editing ? <X className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
          {editing ? 'Fertig' : 'Bearbeiten'}
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2 md:gap-0">
        {optimisticBlocks.map((block, idx) => (
          <RoutineColumn
            key={block.trackerId}
            block={block}
            editing={editing}
            onToggle={toggle}
            className={
              idx === 0
                ? 'md:pr-6'
                : 'border-t border-border/40 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0'
            }
          />
        ))}
      </div>
    </div>
  );
}

function RoutineColumn({
  block, editing, onToggle, className,
}: {
  block: RoutineBlock;
  editing: boolean;
  onToggle: (i: RoutineItem, start: React.TransitionStartFunction) => void;
  className: string;
}) {
  const [, startTransition] = useTransition();
  const isDone = (item: RoutineItem) => item.done;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(block.name);

  const run = (fn: () => Promise<unknown>) => startTransition(() => void fn());

  const done = block.items.filter(isDone).length;
  const total = block.items.length;
  const { base } = block;
  // Morgen und Abend unterscheiden sich durchs Symbol, nicht durch die Farbe —
  // Farbe bleibt im ganzen Dashboard für Zustände reserviert.
  const Icon = block.kind === 'morning' ? Sun : Moon;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
        {editing && editingName ? (
          <input
            value={nameDraft}
            onChange={e => setNameDraft(e.target.value)}
            onBlur={() => {
              setEditingName(false);
              if (nameDraft.trim() && nameDraft !== block.name) run(() => renameRoutine(block.trackerId, nameDraft));
            }}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            autoFocus
            className="flex-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] uppercase tracking-[0.1em] outline-none focus:border-accent"
          />
        ) : (
          <button
            onClick={() => editing && (setNameDraft(block.name), setEditingName(true))}
            disabled={!editing}
            className={cn(
              'text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted',
              editing && 'hover:text-foreground'
            )}
          >
            {block.name}
          </button>
        )}
        <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted">
          {done}/{total}
        </span>
      </div>

      {/* Zwei Marken, eine Leiste: der helle Teil ist der Fortschritt, der
          Strich sitzt dort, wo die Basis erreicht ist. */}
      <div className="relative mb-1.5 h-1 rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-foreground transition-all duration-500"
          style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
        />
        {base !== null && base < total && (
          <span
            className="absolute -top-[3px] h-[10px] w-px bg-white/30"
            style={{ left: `${(base / total) * 100}%` }}
            title={`${base} von ${total} Schritten = Basis`}
          />
        )}
      </div>

      <div className="mb-3 text-[10.5px] text-muted">
        {base === null ? (
          <span>{block.targetHint ?? 'Ziel fehlt'} — keine Basis</span>
        ) : (
          <span>
            Basis ab{' '}
            <span className={cn('font-mono tabular-nums', done >= base && 'text-foreground')}>
              {base}/{total}
            </span>
            {total > base && <> · {total - base} dürfen fehlen</>}
          </span>
        )}
      </div>

      <div className="flex flex-col">
        {block.items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2 border-t border-border/30 py-[6px] first:border-t-0">
            {!editing ? (
              <button
                onClick={() => onToggle(item, startTransition)}
                className="flex flex-1 items-center gap-2.5 text-left text-[12.5px]"
              >
                <span
                  className={cn(
                    'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors',
                    isDone(item) ? 'border-foreground bg-foreground' : 'border-white/35'
                  )}
                >
                  {isDone(item) && <Check className="h-3 w-3 text-background" strokeWidth={3.5} />}
                </span>
                <span
                  className={cn(
                    'truncate',
                    isDone(item) && 'text-muted line-through'
                  )}
                >
                  {item.title}
                </span>
              </button>
            ) : (
              <>
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => run(() => moveRoutineItem(item.id, 'up'))}
                    disabled={i === 0}
                    className="text-muted hover:text-foreground disabled:opacity-20"
                    aria-label="nach oben"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => run(() => moveRoutineItem(item.id, 'down'))}
                    disabled={i === block.items.length - 1}
                    className="text-muted hover:text-foreground disabled:opacity-20"
                    aria-label="nach unten"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {renamingId === item.id ? (
                  <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => {
                      setRenamingId(null);
                      if (draft.trim() && draft !== item.title) run(() => renameRoutineItem(item.id, draft));
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') { setRenamingId(null); }
                    }}
                    autoFocus
                    className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[12.5px] outline-none focus:border-accent"
                  />
                ) : (
                  <button
                    onClick={() => { setRenamingId(item.id); setDraft(item.title); }}
                    className="min-w-0 flex-1 truncate text-left text-[12.5px] hover:text-accent"
                  >
                    {item.title}
                  </button>
                )}

                <button
                  onClick={() => {
                    if (confirmDelete === item.id) {
                      run(() => deleteRoutineItem(item.id));
                      setConfirmDelete(null);
                    } else {
                      setConfirmDelete(item.id);
                    }
                  }}
                  onBlur={() => setConfirmDelete(null)}
                  className={cn(
                    'shrink-0 rounded px-1.5 py-1 text-[10px] transition-colors',
                    confirmDelete === item.id
                      ? 'bg-red-500/15 text-red-400'
                      : 'text-muted hover:text-red-400'
                  )}
                  title={confirmDelete === item.id ? 'Wirklich löschen — auch die Historie' : 'Löschen'}
                >
                  {confirmDelete === item.id ? 'Sicher?' : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </>
            )}
          </div>
        ))}

        {editing && (
          <div className="mt-2 flex items-center gap-2 border-t border-border/30 pt-2">
            <Plus className="h-3.5 w-3.5 shrink-0 text-muted" />
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  run(() => addRoutineItem(block.trackerId, newTitle));
                  setNewTitle('');
                }
              }}
              placeholder="Schritt hinzufügen …"
              className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[12.5px] outline-none placeholder:text-muted/60 focus:border-accent"
            />
          </div>
        )}
      </div>

      {editing && (
        <p className="mt-2 text-[10.5px] leading-relaxed text-muted">
          Namen antippen zum Umbenennen. Löschen entfernt auch die bisherige Historie dieses
          Schritts.
        </p>
      )}
    </div>
  );
}
