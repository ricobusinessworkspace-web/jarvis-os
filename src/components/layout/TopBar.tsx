'use client';
import { createTask } from '@/actions/dashboard';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';

function pageNameFromPath(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/content')) return 'Content & Tasks';
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function TopBar() {
  const pathname = usePathname();
  const pageName = pageNameFromPath(pathname);

  const [now, setNow] = useState<Date | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  
  const searchQuery = useStore((state) => state.searchQuery);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Focus input on Cmd+K
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 px-6 glass border-b border-border electron-drag select-none"
    >
      {/* ── Left: Breadcrumb ──────────────── */}
      <div className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wider', isElectron && 'pl-16')}>
        <span className="text-muted">Jarvis OS</span>
        <span className="text-muted">/</span>
        <span className="font-black text-foreground">{pageName}</span>
      </div>

      {/* ── Center / Right: Clock, Search & Notifications ── */}
      <div className="flex items-center gap-4 electron-no-drag">
        {/* Clock */}
        {now && (
          <span className="hidden md:block text-xs font-semibold text-muted tracking-wide whitespace-nowrap">
            {now.toLocaleDateString('de-DE', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}

        {/* Global Search Input */}
        <div className="relative flex items-center bg-surface border border-border rounded-lg px-2.5 py-1 text-xs text-muted hover:border-border-hover focus-within:border-accent transition-colors duration-150">
          <Search size={13} className="mr-1.5 shrink-0 text-muted" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-foreground text-xs focus:outline-none w-28 sm:w-44 placeholder:text-muted/60"
          />
          <kbd className="ml-1.5 hidden sm:inline-flex items-center rounded bg-elevated px-1.5 py-0.5 font-mono text-[9px] text-muted border border-border/40 select-none">
            ⌘K
          </kbd>
        </div>

        {/* Notification Bell */}
        <button
          className="relative rounded-lg p-1.5 text-muted hover:bg-overlay hover:text-foreground transition-all duration-150 cursor-pointer"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>
      </div>
    </header>
  );
}
