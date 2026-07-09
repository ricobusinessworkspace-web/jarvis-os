'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-8 max-w-md text-center animate-fade-in">
        {/* 404 Display */}
        <div className="relative">
          <span className="text-[120px] font-bold leading-none bg-gradient-to-b from-[var(--fg-muted)] to-transparent bg-clip-text text-transparent select-none">
            404
          </span>
        </div>

        {/* Message */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">
            Seite nicht gefunden
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            Die angeforderte Seite existiert nicht oder wurde verschoben.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] transition-colors duration-150 shadow-[var(--shadow-md)]"
          >
            <Home size={14} />
            Zum Dashboard
          </Link>
          <button
            onClick={() => typeof window !== 'undefined' && window.history.back()}
            className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--fg-secondary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] transition-colors duration-150 cursor-pointer"
          >
            <ArrowLeft size={14} />
            Zurück
          </button>
        </div>
      </div>
    </div>
  );
}
