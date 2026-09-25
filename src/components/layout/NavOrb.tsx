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
 * - Ende: der neue Pfad steht **und** kein Ladezustand (`data-route-loading`,
 *   siehe `RouteLoading`) ist mehr im Dokument. Der Pfad allein reicht nicht:
 *   Next schaltet ihn um, sobald die Hülle der neuen Seite da ist — gemessen
 *   nach ~200 ms, der Inhalt kam aber erst nach 1–2,4 s. Danach bleibt der
 *   Ball noch bis `MIN_MS`, damit ein schneller Wechsel nicht zuckt.
 * - Notbremse: nach `MAX_MS` ist Schluss, egal was war. Ein Overlay ohne
 *   Rückfalltür ist genau der Fehler, der hier mit dem EcosystemLoader schon
 *   einmal drinsteckte (siehe HANDOVER).
 *
 * `RouteLoading` bleibt daneben bestehen und deckt ab, was ohne Klick passiert
 * (Befehlspalette, Vor/Zurück, Tag im Verlauf). Beide zeigen denselben Ball an
 * derselben Stelle; weil diese Schicht deckend ist, sieht man nie zwei.
 */

/** Kürzer wirkt wie ein Zucken statt wie ein Ladevorgang. */
const MIN_MS = 480;
/** Notbremse — hier darf nichts hängen bleiben. */
const MAX_MS = 8000;

/**
 * Steht irgendwo ein **sichtbarer** Ladezustand? Nur sichtbare zählen: React
 * streamt Inhalte in versteckten Behältern (`<div hidden id="S:0">`) an, die
 * mitunter liegen bleiben — mit dem alten Platzhalter darin. Ohne diese
 * Prüfung blieb der Ball über dem längst fertigen Inhalt stehen.
 * `getClientRects()` ist leer, sobald ein Vorfahr `display: none` hat.
 */
function isLoadingVisible(): boolean {
  return Array.from(document.querySelectorAll('[data-route-loading]')).some(
    el => el.getClientRects().length > 0,
  );
}

export function NavOrb() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const startedAt = useRef(0);
  /** Pfad beim Klick — solange er noch gilt, hat Next nicht umgeschaltet. */
  const fromPath = useRef('');

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
      fromPath.current = window.location.pathname;
      setPending(true);
    }

    // Erfassungsphase: vor dem Handler von <Link>.
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // Weg erst, wenn der neue Pfad steht und nichts mehr lädt. Der Beobachter
  // meldet, wann ein Ladezustand verschwindet — genau dann setzt React den
  // fertigen Inhalt ein. Danach den Rest der Mindestzeit absitzen.
  useEffect(() => {
    if (!pending) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    function check() {
      clearTimeout(timeout);
      if (pathname === fromPath.current) return;
      if (isLoadingVisible()) return;
      const rest = Math.max(0, MIN_MS - (Date.now() - startedAt.current));
      timeout = setTimeout(() => setPending(false), rest);
    }

    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      // React blendet Inhalte über `style`/`hidden` aus und ein.
      attributes: true,
      attributeFilter: ['style', 'hidden'],
    });
    check();
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [pending, pathname]);

  useEffect(() => {
    if (!pending) return;
    const timeout = setTimeout(() => setPending(false), MAX_MS);
    return () => clearTimeout(timeout);
  }, [pending]);

  if (!pending) return null;

  return (
    <div className="nav-orb" aria-busy="true" aria-live="polite">
      <JarvisOrb />
      <span className="route-label">lädt</span>
    </div>
  );
}
