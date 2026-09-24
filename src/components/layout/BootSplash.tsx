/**
 * Startsequenz — der Drahtgitter-Ball aus dem App-Icon zeichnet sich einmal.
 *
 * **Server-Komponente ohne jedes JavaScript.** Das ist der Punkt: hier stand
 * schon einmal ein Overlay (`EcosystemLoader`), das per `useEffect` verschwand
 * — also erst nach vollständiger Hydration. Der Inhalt war längst da und wurde
 * nur verdeckt. Diese Fassung ist reines CSS, endet nach fester Zeit und lässt
 * mit `pointer-events: none` jeden Klick durch. Sie kann den Start nicht
 * verlängern, weil sie auf nichts wartet.
 *
 * Die Geometrie ist gerechnet statt abgetippt: Breitenkreise als flache
 * Ellipsen, Längenkreise als schmale, Knoten auf deren Schnittpunkten. Damit
 * sitzen die Punkte wirklich auf den Linien — von Hand gesetzte Koordinaten
 * wandern beim kleinsten Formwechsel daneben.
 */

const R = 70;
const CX = 100;
const CY = 100;

/** Breitengrade in Grad; 0 ist der Äquator. */
const LATITUDES = [0, 25, -25, 50, -50, 70, -70];
/** Längenkreise über ihre halbe Breite — 0 ergibt die senkrechte Linie. */
const MERIDIAN_RX = [57.2, 40.4, 20.6];

const rad = (deg: number) => (deg * Math.PI) / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;

const latRings = LATITUDES.map(deg => {
  const rx = R * Math.cos(rad(deg));
  return {
    cy: r2(CY - R * Math.sin(rad(deg))),
    rx: r2(rx),
    ry: r2(rx * 0.28), // flache Aufsicht — der Ball steht leicht geneigt
  };
});

/**
 * Knoten: Schnittpunkte von Breiten- und Längenkreisen, plus der Rand.
 * Auf Höhe y hat ein Längenkreis mit halber Breite `rx` die Auslenkung
 * `rx * sqrt(1 - ((y - CY) / R)^2)` — dieselbe Formel gilt für den Rand mit
 * `rx = R`, deshalb fällt der Randpunkt von selbst mit heraus.
 */
const nodes: Array<{ x: number; y: number }> = [];
for (const deg of [0, 25, -25, 50, -50]) {
  const y = CY - R * Math.sin(rad(deg));
  const k = Math.sqrt(1 - ((y - CY) / R) ** 2);
  for (const rx of [R, ...MERIDIAN_RX]) {
    const dx = rx * k;
    nodes.push({ x: r2(CX + dx), y: r2(y) });
    if (dx > 0.5) nodes.push({ x: r2(CX - dx), y: r2(y) });
  }
}
// Pole
nodes.push({ x: CX, y: CY - R }, { x: CX, y: CY + R });

export function BootSplash() {
  return (
    <div className="boot" aria-hidden="true">
      <div className="boot-glow" />

      <svg className="boot-sphere" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <g className="boot-lines">
        {/* Rand zuerst — er gibt dem Auge die Form, bevor das Gitter kommt. */}
        <circle className="boot-ring boot-ring--rim" cx={CX} cy={CY} r={R} />

        {latRings.map((ring, i) => (
          <ellipse
            key={`lat-${i}`}
            className="boot-ring"
            cx={CX}
            cy={ring.cy}
            rx={ring.rx}
            ry={ring.ry}
            style={{ animationDelay: `${60 + i * 34}ms` }}
          />
        ))}

        {MERIDIAN_RX.map((rx, i) => (
          <ellipse
            key={`mer-${i}`}
            className="boot-ring"
            cx={CX}
            cy={CY}
            rx={rx}
            ry={R}
            style={{ animationDelay: `${120 + i * 34}ms` }}
          />
        ))}

        <line
          className="boot-ring"
          x1={CX} y1={CY - R} x2={CX} y2={CY + R}
          style={{ animationDelay: '222ms' }}
        />

        {nodes.map((n, i) => (
          <circle
            key={`node-${i}`}
            className="boot-node"
            cx={n.x}
            cy={n.y}
            r={2.2}
            style={{ animationDelay: `${300 + (i % 9) * 22}ms` }}
          />
        ))}
        </g>
      </svg>

      <span className="boot-word">Jarvis OS</span>
    </div>
  );
}
