/**
 * Der Drahtgitter-Ball aus dem App-Icon — ein Bauteil, zwei Auftritte:
 * die Startsequenz über der ganzen Seite und der Ladezustand der Reiter.
 *
 * **Kein JavaScript.** Alles läuft über CSS, damit der Ball mit dem ersten
 * Frame malt und niemals auf Hydration wartet.
 *
 * Die Drehung ist gerechnet, nicht vorgetäuscht: Ein Längenkreis erscheint in
 * der Aufsicht als Ellipse, deren halbe Breite `R · cos(φ)` beträgt. Dreht sich
 * die Kugel, läuft φ durch — die Ellipse wird schmal, zur Linie, wieder breit.
 * Deshalb animiert das CSS die Eigenschaft `rx` statt das Bild zu kippen: ein
 * gedrehtes flaches SVG würde stauchen, das hier sieht aus wie ein Globus.
 *
 * Die Knoten sitzen nur auf den Breitenkreisen. Ein Punkt dort bleibt bei jeder
 * Drehung ein gültiger Punkt der Kugel, einer auf dem Schnittpunkt mit einem
 * Längenkreis nicht — sonst bräche das Gitter beim Drehen auf.
 *
 * Jede Linie mit Strichmuster trägt `pathLength={1}`. Ohne das rechnet
 * `vector-effect: non-scaling-stroke` das Muster in **Bildschirm**pixeln, die
 * `stroke-dasharray` im CSS aber in Koordinaten — bei 300 px Anzeige fehlten
 * so 29 % des Randkreises, sichtbar als Lücke oben rechts. Mit `pathLength=1`
 * ist „ein Umlauf" immer genau 1, unabhängig von der Anzeigegröße.
 *
 * Bewusst **ohne `<defs>`/Verläufe mit `id`**: Startsequenz und Ladezustand
 * können gleichzeitig im Dokument stehen, doppelte IDs wären die Folge. Die
 * Masse im Inneren kommt deshalb aus zwei weichgezeichneten Kreisen.
 */

const R = 70;
const CX = 100;
const CY = 100;

/** Breitengrade in Grad; 0 ist der Äquator. */
const LATITUDES = [0, 25, -25, 50, -50, 70, -70];
/** So viele Längenkreise laufen phasenversetzt durch die Drehung. */
const MERIDIAN_COUNT = 6;
/** Eine halbe Umdrehung — danach sieht das Gitter wieder gleich aus. */
const SPIN_MS = 7200;

const rad = (deg: number) => (deg * Math.PI) / 180;
const r2 = (n: number) => Math.round(n * 100) / 100;

const latRings = LATITUDES.map(deg => {
  const rx = R * Math.cos(rad(deg));
  return {
    cy: r2(CY - R * Math.sin(rad(deg))),
    rx: r2(rx),
    ry: r2(rx * 0.28), // leichte Aufsicht — der Ball steht geneigt
  };
});

/** Knoten auf den Breitenkreisen, gleichmäßig verteilt. */
const nodes: Array<{ x: number; y: number }> = [];
for (const ring of latRings) {
  if (ring.rx < 12) continue; // die Polkappen bleiben leer, sonst klumpt es
  const count = ring.rx > 55 ? 12 : 8;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    nodes.push({
      x: r2(CX + ring.rx * Math.cos(t)),
      y: r2(ring.cy + ring.ry * Math.sin(t)),
    });
  }
}
nodes.push({ x: CX, y: CY - R }, { x: CX, y: CY + R }); // Pole

/** Ringe, die den Ball umkreisen — gegenläufig, das gibt Tiefe. */
const ORBITS = [
  { rx: 93, ry: 27, cls: 'orb-orbit--a', dot: 2.4 },
  { rx: 82, ry: 20, cls: 'orb-orbit--b', dot: 1.9 },
];

export function JarvisOrb({ size = 264 }: { size?: number }) {
  return (
    <div className="orb" style={{ width: size, height: size }}>
      <span className="orb-glow" />

      <svg className="orb-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        {/* Wellen laufen nach aussen — ganz hinten, damit sie nichts verdecken. */}
        {[0, 1300, 2600].map(delay => (
          <circle
            key={`wave-${delay}`}
            className="orb-wave"
            cx={CX}
            cy={CY}
            r={R}
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}

        {/* Die Orbitalringe liegen hinter dem Ball. */}
        <g className="orb-orbits">
          {ORBITS.map(o => (
            <g key={o.cls} className={`orb-orbit ${o.cls}`}>
              <ellipse className="orb-orbit-path" cx={CX} cy={CY} rx={o.rx} ry={o.ry} />
              <circle className="orb-particle" cx={CX + o.rx} cy={CY} r={o.dot} />
            </g>
          ))}
        </g>

        {/* Masse: ein weicher Kern und ein Glanzpunkt links oben. */}
        <circle className="orb-mass" cx={CX} cy={CY} r={58} />
        <circle className="orb-shine" cx={CX - 20} cy={CY - 22} r={26} />

        <g className="orb-lines">
          {/* Rand zuerst: er gibt dem Auge die Form, bevor das Gitter kommt. */}
          <circle className="orb-ring orb-ring--halo" cx={CX} cy={CY} r={R} pathLength={1} />
          <circle className="orb-ring orb-ring--rim" cx={CX} cy={CY} r={R} pathLength={1} />

          {latRings.map((ring, i) => (
            <ellipse
              key={`lat-${i}`}
              className="orb-ring"
              cx={CX}
              cy={ring.cy}
              rx={ring.rx}
              ry={ring.ry}
              pathLength={1}
              style={{ animationDelay: `${60 + i * 34}ms` }}
            />
          ))}

          {Array.from({ length: MERIDIAN_COUNT }, (_, i) => (
            <ellipse
              key={`mer-${i}`}
              className="orb-ring orb-mer"
              cx={CX}
              cy={CY}
              rx={R}
              ry={R}
              pathLength={1}
              style={{
                // Aufbau versetzt, Drehung phasenversetzt — zusammen ergibt das
                // die durchlaufende Bewegung.
                animationDelay: `${120 + i * 30}ms, ${(-SPIN_MS / MERIDIAN_COUNT) * i}ms`,
              }}
            />
          ))}

          {nodes.map((n, i) => (
            <circle
              key={`node-${i}`}
              className="orb-node"
              cx={n.x}
              cy={n.y}
              r={2.1}
              style={{
                animationDelay: `${300 + (i % 11) * 26}ms, ${(i % 7) * 380}ms`,
              }}
            />
          ))}

          {/* Ein Lichtpuls läuft am Rand entlang — der Herzschlag des Balls. */}
          <circle className="orb-pulse" cx={CX} cy={CY} r={R} pathLength={1} />
        </g>
      </svg>
    </div>
  );
}
