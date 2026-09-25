import { JarvisOrb } from './JarvisOrb';

/**
 * Der Ladezustand im Inhaltsbereich — **der einzige.**
 *
 * Steht in `loading.tsx` und als `fallback` jeder Suspense-Grenze der Reiter.
 * Vorher hatten die Reiter eigene graue Platzhalterkästen: die Seite war sofort
 * „fertig", nur ihr Inhalt fehlte noch 1–2 s. Der Ball verschwand deshalb nach
 * einer halben Sekunde und die Kästen standen allein da.
 *
 * `data-route-loading` ist das Signal für `NavOrb`: solange ein Element mit
 * diesem Merkmal im Dokument steht, lädt noch etwas, und der Ball bleibt.
 */
export function RouteLoading() {
  return (
    <div className="route" data-route-loading="" aria-busy="true" aria-live="polite">
      <JarvisOrb />
      <span className="route-label">lädt</span>
    </div>
  );
}
