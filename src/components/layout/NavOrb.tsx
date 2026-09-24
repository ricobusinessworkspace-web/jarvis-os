'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { JarvisOrb } from './JarvisOrb';

/**
 * Der Ladezustand beim Reiter-Wechsel — die verlässliche Schicht.
 *
 * `loading.tsx` allein reicht dafür **prinzipbedingt** nicht. Die Next-Doku
 * sagt es deutlich: ist die Zielseite vorgeladen, wird der Wartezustand
 * übersprungen, und Vor/Zurück nutzt bewusst den Verlaufsspeicher. Genau daher
 * kam, dass der Ball mal erschien, mal nur aufblitzte und einmal gar nicht —
 * je nachdem, was Next gerade schon im Speicher hatte.
 *
 * Diese Komponente hängt deshalb nicht an Nexts Wartezustand, sondern an zwei
 * Dingen, die immer eintreten: dem **Klick** und dem **Pfadwechsel**.
 *
 * - Start: ein Klick auf einen app-internen Link, in der Erfassungsphase
 *   abgegriffen, also bevor Next die Navigation beginnt.
 * - Ende: `usePathname()` meldet den neuen Pfad — das passiert erst, wenn die
 *   neue Seite steht. Danach bleibt der Ball noch bis `MIN_MS`, damit ein
 *   schneller Wechsel nicht als Zucken erscheint.
 * - Notbremse: nach `MAX_MS` ist Schluss, egal was war. Ein Overlay ohne
 *   Rückfalltür ist genau der Fehler, der hier mit dem EcosystemLoader schon
 *   einmal drinsteckte (siehe HANDOVER).
 *
 * `loading.tsx` bleibt daneben bestehen und deckt ab, was ohne Klick passiert
 * (Befehlspalette, Vor/Zurück, direkter Aufruf). Weil diese Schicht deckend
 * ist, sieht man nie zwei Bälle übereinander.
 */

/** Kürzer wirkt wie ein Zucken statt wie ein Ladevorgang. */
const MIN_MS = 480;
/** Notbremse — hier darf nichts hängen bleiben. */
const MAX_MS = 8000;

export function NavOrb() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const startedAt = useRef(0);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Alles, was der Browser selbst anders behandelt, geht uns nichts an:
      // neuer Tab, Download, Kontextmenü, bereits abgefangener Klick.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href^="/"]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href') ?? '';
      // Klick auf den Reiter, auf dem man schon steht: Next navigiert nicht,
      // der Pfad ändert sich nie — der Ball bliebe bis zur Notbremse stehen.
      if (href.split(/[?#]/)[0] === window.location.pathname) return;

      startedAt.current = Date.now();
      setPending(true);
    }

    // Erfassungsphase: vor dem Handler von <Link>.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Der neue Pfad steht — Rest der Mindestzeit absitzen, dann weg.
  // Absichtlich nur auf `pathname` hörend: `pending` mit aufzunehmen würde den
  // Zeitgeber beim Setzen von `pending` schon starten, also vor der Navigation.
  useEffect(() => {
    if (!pending) return;
    const rest = Math.max(0, MIN_MS - (Date.now() - startedAt.current));
    const timeout = setTimeout(() => setPending(false), rest);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!pending) return;
    const timeout = setTimeout(() => setPending(false), MAX_MS);
    return () => clearTimeout(timeout);
  }, [pending]);

  if (!pending) return null;

  return (
    <div className="nav-orb" aria-busy="true" aria-live="polite">
      <JarvisOrb size={168} />
      <span className="route-label">lädt</span>
    </div>
  );
}
