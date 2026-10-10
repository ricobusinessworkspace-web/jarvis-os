'use client';

import { Volume2, VolumeX } from 'lucide-react';
import { useToene } from '@/hooks/useToene';
import { tick } from '@/lib/sound';
import { cn } from '@/lib/utils';

/** Schalter „Töne" — je Gerät, Standard an. Dieselbe Einstellung wie in ⌘K. */
export function ToeneSchalter() {
  const [an, setAn] = useToene();
  return (
    <div className="flex items-center gap-3 border-t border-border/40 pt-3">
      {an ? <Volume2 className="h-4 w-4 text-muted" /> : <VolumeX className="h-4 w-4 text-muted" />}
      <div className="flex-1">
        <div className="text-[13px]">Töne</div>
        <div className="text-[11px] text-muted">Leiser Tick beim Abhaken, heller Doppelton bei Rekord und perfektem Tag · nur auf diesem Gerät</div>
      </div>
      <button
        role="switch"
        aria-checked={an}
        onClick={() => {
          setAn(!an);
          if (!an) tick(); // Probe beim Einschalten
        }}
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full border transition-colors',
          an ? 'border-foreground bg-foreground' : 'border-border bg-white/[0.06]'
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[18px] w-[18px] rounded-full transition-all',
            an ? 'left-[18px] bg-background' : 'left-[2px] bg-muted'
          )}
        />
      </button>
    </div>
  );
}
