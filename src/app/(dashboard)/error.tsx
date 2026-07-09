'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 max-w-md text-center surface p-10 animate-fade-in">
        {/* Error Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--error)]/10 border border-[var(--error)]/20">
          <AlertCircle size={28} className="text-[var(--error)]" />
        </div>

        {/* Error Message */}
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            Etwas ist schiefgelaufen
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            {error.message || 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.'}
          </p>
          {error.digest && (
            <p className="text-[10px] text-[var(--fg-faint)] font-mono mt-1">
              Fehler-ID: {error.digest}
            </p>
          )}
        </div>

        {/* Retry Button */}
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors duration-150 cursor-pointer shadow-[var(--shadow-md)]"
        >
          <RotateCcw size={14} />
          Erneut versuchen
        </button>
      </div>
    </div>
  );
}
