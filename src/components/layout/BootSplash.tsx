import { JarvisOrb } from './JarvisOrb';

/**
 * Startsequenz beim Laden und Neuladen.
 *
 * Läuft, **solange geladen wird** — nicht nach Stoppuhr. Das Inline-Skript im
 * Root-Layout setzt `data-booted` auf <html>, sobald das Dokument fertig ist,
 * und erst das lässt den Schleier weggehen.
 *
 * Kein JavaScript in dieser Komponente und kein Zustand. Hier stand schon
 * einmal ein Overlay (`EcosystemLoader`), das per `useEffect` verschwand — also
 * erst nach vollständiger Hydration — und den Start künstlich verlängert hat.
 * Diese Fassung hängt an einem Ereignis des Browsers, lässt mit
 * `pointer-events: none` jeden Klick durch und hat im Skript eine harte
 * Obergrenze, damit ein ausbleibendes `load` sie nicht stehen lassen kann.
 */
export function BootSplash() {
  return (
    <div className="boot" aria-hidden="true">
      <JarvisOrb size={264} />
      <span className="boot-word">Jarvis OS</span>
    </div>
  );
}
