'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from './SidebarContext';
import { CommandPalette } from './CommandPalette';

/**
 * Ort, Zeit, Sprungmarke — mehr nicht.
 *
 * Vorher standen hier eine Suchleiste, die in einen ungelesenen Store schrieb,
 * eine Glocke ohne Ereignisquelle und ein Export-Knopf für Claude. Alle drei
 * sahen nach Funktion aus und hatten keine. Was bleibt, tut wirklich etwas.
 */

function pageNameFromPath(pathname: string): string {
  if (pathname === '/') return 'Heute';
  const segment = pathname.split('/').filter(Boolean).pop() ?? '';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

const CLOCK_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short', day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
};

export default function TopBar({ initialClock }: { initialClock: string }) {
  const pathname = usePathname();
  const pageName = pageNameFromPath(pathname);
  const { toggleSidebar } = useSidebar();

  // Startwert kommt aus dem Layout, also serverseitig — die Uhrzeit steht
  // damit schon im ersten Frame und nichts springt mehr nach. Beide Seiten
  // formatieren mit `Europe/Berlin`, die Zeichenketten stimmen überein.
  const [clock, setClock] = useState(initialClock);
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleDateString('de-DE', CLOCK_FORMAT));
    tick();
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-border px-4 glass electron-drag select-none md:px-6">
      <div className="flex items-center gap-2 text-xs font-medium tracking-wide">
        <button
          onClick={toggleSidebar}
          className="press electron-no-drag -ml-1 mr-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-overlay hover:text-foreground md:hidden"
          aria-label="Menü"
        >
          <Menu size={18} />
        </button>
        <span className="hidden text-muted sm:inline">Jarvis OS</span>
        <span className="hidden text-muted/50 sm:inline">/</span>
        <span className="max-w-[140px] truncate font-semibold text-foreground sm:max-w-none">
          {pageName}
        </span>
      </div>

      <div className="electron-no-drag flex items-center gap-3">
        <span className="hidden whitespace-nowrap font-mono text-[11.5px] tabular-nums text-muted md:block">
          {clock}
        </span>

        <button
          onClick={() => window.dispatchEvent(new Event('jarvis:command-palette'))}
          aria-label="Befehle öffnen"
          className={cn(
            'press flex h-7 items-center gap-1.5 rounded-lg border border-border/60 bg-overlay/40 pl-2 pr-1.5 text-muted transition-colors',
            'hover:border-border-hover hover:bg-overlay hover:text-foreground'
          )}
        >
          <Search size={13} />
          <kbd className="hidden rounded border border-border/50 px-1 py-px font-mono text-[10px] leading-none tracking-wide sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      <CommandPalette />
    </header>
  );
}
