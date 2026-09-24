/**
 * Der Drahtgitter-Ball aus dem App-Icon — als Bauteil, weil ihn zwei Stellen
 * brauchen: die Startsequenz über der ganzen Seite und die Reiter-Wechsel im
 * Inhaltsbereich.
 *
 * **Kein JavaScript.** Alles läuft über CSS, damit der Ball mit dem ersten
 * Frame malt und niemals auf Hydration wartet.
 *
 * Die Drehung ist gerechnet, nicht vorgetäuscht: Ein Längenkreis erscheint in
 * der Aufsicht als Ellipse, deren halbe Breite `R · cos(φ)` beträgt. Dreht sich
 * die Kugel, läuft φ durch — die Ellipse wird schmal, zur Linie, wieder breit.
 * Deshalb animiert das CSS die Eigenschaft `rx` der Längenkreise statt das Bild
 * zu kippen: ein gedrehtes flaches SVG würde gestaucht aussehen, das hier sieht
 * aus wie ein Globus.
 *
 * Die Knoten sitzen nur auf den Breitenkreisen. Das ist Absicht — ein Punkt auf
 * einem Breitenkreis bleibt bei jeder Drehung ein gültiger Punkt der Kugel,
 * einer auf einem Schnittpunkt mit einem Längenkreis nicht. Sonst müsste man
 * sie mitwandern lassen, und das Gitter bräche beim ersten Rundungsfehler auf.
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

export function JarvisOrb({ size = 264 }: { size?: number }) {
  return (
    <div className="orb" style={{ width: size, height: size }}>
      {/* Der Schein liegt hinter dem Gitter und atmet eigenständig. */}
      <span className="orb-glow" />
      {/* Ein Lichtfleck kreist — er verrät die Drehrichtung. */}
      <span className="orb-sweep" />

      <svg className="orb-svg" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <g className="orb-lines">
          {/* Rand zuerst: er gibt dem Auge die Form, bevor das Gitter kommt. */}
          <circle className="orb-ring orb-ring--halo" cx={CX} cy={CY} r={R} />
          <circle className="orb-ring orb-ring--rim" cx={CX} cy={CY} r={R} />

          {latRings.map((ring, i) => (
            <ellipse
              key={`lat-${i}`}
              className="orb-ring orb-lat"
              cx={CX}
              cy={ring.cy}
              rx={ring.rx}
              ry={ring.ry}
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
        </g>
      </svg>
    </div>
  );
}
