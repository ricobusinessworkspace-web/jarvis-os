'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Zahlenfeld für Tageswerte. Speichert beim Verlassen oder mit Enter.
 *
 * Leer heißt **nicht gemessen**, nicht 0 — deshalb gibt das Feld bei leerer
 * Eingabe `null` zurück und der Aufrufer löscht den Wert, statt ihn zu nullen.
 * Komma wird als Dezimaltrennzeichen akzeptiert.
 */
export function NumberInput({
  value,
  unit,
  disabled,
  onSave,
  className,
}: {
  value: number | null;
  unit?: string;
  disabled?: boolean;
  onSave: (v: number | null) => void;
  className?: string;
}) {
  const asText = (v: number | null) => (v === null ? '' : String(v).replace('.', ','));
  const [draft, setDraft] = useState(asText(value));

  // Nach dem Speichern rendert der Server neu — dann gilt sein Wert. Anpassung
  // während des Renders statt im Effect, sonst rendert React zweimal.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(asText(value));
  }

  const commit = () => {
    const raw = draft.trim().replace(',', '.');
    if (raw === '') {
      if (value !== null) onSave(null);
      return;
    }
    const n = Number(raw);
    if (Number.isNaN(n)) {
      setDraft(asText(value)); // unlesbare Eingabe verwerfen statt Müll speichern
      return;
    }
    if (n !== value) onSave(n);
  };

  return (
    <div className={cn('flex shrink-0 items-center gap-1.5', className)}>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(asText(value));
            e.currentTarget.blur();
          }
        }}
        disabled={disabled}
        placeholder="–"
        inputMode="decimal"
        className="w-20 rounded-lg border border-border bg-background px-2.5 py-1.5 text-right font-mono text-[13px] tabular-nums outline-none transition-colors focus:border-accent disabled:opacity-40"
      />
      {unit && <span className="min-w-6 font-mono text-[11px] text-muted">{unit}</span>}
    </div>
  );
}
