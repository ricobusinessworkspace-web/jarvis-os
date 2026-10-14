'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Sun, PhoneCall, Target, Mail, CornerDownLeft, Volume2, VolumeX } from 'lucide-react';
import { useToene } from '@/hooks/useToene';
import { tick } from '@/lib/sound';

/**
 * ⌘K — Sprungmarken statt Suchfeld.
 *
 * Die alte Suchleiste in der TopBar schrieb in einen Store, den niemand las:
 * ein Feld, das aussah, als täte es etwas. Hier ist der Umkehrschluss — nichts
 * ist dauerhaft sichtbar, aber jede Zeile führt wirklich irgendwohin.
 */

const PAGES = [
  { label: 'Heute', href: '/', icon: Sun, hint: 'Tag und Woche' },
  { label: 'Vertrieb', href: '/vertrieb', icon: PhoneCall, hint: 'Calls diese Woche' },
  { label: 'Ziele', href: '/ziele', icon: Target, hint: 'Umsatz, Rekorde, Einstellungen' },
  { label: 'Mails', href: '/mail', icon: Mail, hint: 'Warteschlange aus dem CRM' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [toene, setToene] = useToene();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Das Ereignis kommt aus der TopBar — sie zeigt nur den Auslöser, die
  // Palette selbst wohnt hier.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('jarvis:command-palette', onOpen);
    return () => window.removeEventListener('jarvis:command-palette', onOpen);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Wohin?" />
      <CommandList>
        <CommandEmpty className="text-muted">Nichts gefunden.</CommandEmpty>

        <CommandGroup heading="Seiten">
          {PAGES.map(({ label, href, icon: Icon, hint }) => (
            <CommandItem key={href} value={`${label} ${hint}`} onSelect={() => go(href)}>
              <Icon className="mr-2.5 h-4 w-4 shrink-0 text-muted" />
              <span>{label}</span>
              <span className="ml-auto text-[11px] text-muted">{hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Einstellungen">
          <CommandItem
            value="töne ton sound an aus"
            onSelect={() => {
              setToene(!toene);
              if (!toene) tick(); // Probe beim Einschalten — der Klick erlaubt den Ton
            }}
          >
            {toene ? (
              <Volume2 className="mr-2.5 h-4 w-4 shrink-0 text-muted" />
            ) : (
              <VolumeX className="mr-2.5 h-4 w-4 shrink-0 text-muted" />
            )}
            <span>Töne {toene ? 'ausschalten' : 'einschalten'}</span>
            <span className="ml-auto text-[11px] text-muted">beim Abhaken · {toene ? 'an' : 'aus'}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <div className="flex items-center gap-1.5 border-t border-border/60 px-4 py-2 text-[10.5px] text-muted">
        <CornerDownLeft className="h-3 w-3" />
        öffnen
        <span className="mx-1.5 opacity-40">·</span>
        esc schließen
      </div>
    </CommandDialog>
  );
}
