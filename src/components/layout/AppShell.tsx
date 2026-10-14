'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { Sun, PhoneCall, Target, Mail, Search } from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import { NavOrb } from './NavOrb';
import { CommandPalette } from './CommandPalette';
import { cn } from '@/lib/utils';

/**
 * Die Hülle im Stil einer iOS-App: vier Reiter, am Mac als Umschalter oben,
 * am iPhone als Tab-Leiste unten. Mehr braucht es nicht (Rico, 14.10.):
 * Verlauf und Health sind weg — nur heute ist bearbeitbar, die Woche steht
 * auf „Heute", Serien und Rekorde unter „Ziele".
 *
 * **Keine Datenbankabfrage** — die Hülle bleibt beim Reiter-Wechsel stehen.
 */
export const REITER = [
  { href: '/', label: 'Heute', icon: Sun },
  { href: '/vertrieb', label: 'Vertrieb', icon: PhoneCall },
  { href: '/ziele', label: 'Ziele', icon: Target },
  { href: '/mail', label: 'Mails', icon: Mail },
] as const;

const aktiv = (pfad: string, href: string) => (href === '/' ? pfad === '/' : pfad.startsWith(href));

export function AppShell({ children }: { children: ReactNode }) {
  const pfad = usePathname();

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="relative z-30 hidden h-14 shrink-0 items-center justify-center md:flex">
        <nav aria-label="Reiter" className="flex gap-0.5 rounded-[10px] bg-surface p-0.5">
          {REITER.map(r => (
            <Link
              key={r.href}
              href={r.href}
              aria-current={aktiv(pfad, r.href) ? 'page' : undefined}
              className={cn(
                'rounded-lg px-5 py-1.5 text-[13px] font-medium transition-colors',
                aktiv(pfad, r.href) ? 'bg-elevated text-foreground' : 'text-muted hover:text-foreground'
              )}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => window.dispatchEvent(new Event('jarvis:command-palette'))}
          className="absolute right-5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-muted hover:text-foreground"
          aria-label="Befehle öffnen"
        >
          <Search className="h-3.5 w-3.5" />⌘K
        </button>
      </header>

      <main className="relative flex-1 overflow-y-auto overscroll-contain">
        <PullToRefresh>{children}</PullToRefresh>
        {/* Deckt den Inhalt beim Reiter-Wechsel; Kopf und Tab-Leiste bleiben stehen. */}
        <NavOrb />
      </main>

      <nav
        aria-label="Reiter"
        className="flex shrink-0 justify-around border-t border-separator bg-background/90 pb-[calc(6px+env(safe-area-inset-bottom,0px))] pt-1.5 backdrop-blur-xl md:hidden"
      >
        {REITER.map(r => {
          const Icon = r.icon;
          const an = aktiv(pfad, r.href);
          return (
            <Link
              key={r.href}
              href={r.href}
              aria-current={an ? 'page' : undefined}
              className={cn('flex flex-col items-center gap-0.5 px-4 py-1 text-[10.5px] font-medium', an ? 'text-accent-hover' : 'text-muted')}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={an ? 2.2 : 1.8} />
              {r.label}
            </Link>
          );
        })}
      </nav>

      <CommandPalette />
    </div>
  );
}
