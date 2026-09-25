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
 * Jede Linie mit Strichmuster trägt `pathLength={1}` — „ein Umlauf" ist damit
 * genau 1 — und **kein** `vector-effect: non-scaling-stroke`. Die beiden
 * vertragen sich nicht: der Browser zeichnet das Muster dann in Bildschirm-
 * pixeln, rechnet `pathLength` aber in Koordinaten. Beim 300-px-Orb ist der
 * Rand auf dem Schirm 1,5-mal so lang wie in Koordinaten, das Muster deckte
 * nur zwei Drittel — sichtbar als Lücke oben rechts. Gleich dicke Striche bei
 * jeder Größe kommen stattdessen aus `--orb-u` (Koordinaten je Bildschirm-
 * pixel), mit dem das CSS die Strichbreiten multipliziert.
 *
 * **Eine Größe für alle Auftritte** (`ORB_SIZE`). Unterschiedliche Größen je
 * Auftritt lasen sich als „mal ist er kleiner".
 *
 * **Eingezeichnet wird nur mit `intro`** (Startsequenz). Beim Reiter-Wechsel
 * steht der Ball oft nur eine halbe Sekunde — ein Aufbau, der länger dauert,
 * zeigt dann nie den fertigen Ball, sondern immer einen mit Lücke. Ohne
 * `intro` ist das Gitter vom ersten Bild an geschlossen und blendet nur ein.
 *
 * Bewusst **ohne `<defs>`/Verläufe mit `id`**: Startsequenz und Ladezustand
 * können gleichzeitig im Dokument stehen, doppelte IDs wären die Folge. Die
 * Masse im Inneren kommt deshalb aus zwei weichgezeichneten Kreisen.
 */

import type { CSSProperties } from 'react';

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

/** Kantenlänge des viewBox — Bezug für `--orb-u`. */
const VIEWBOX = 200;
/** Anzeigegröße in px — für jeden Auftritt dieselbe. */
const ORB_SIZE = 300;

const ORB_STYLE = {
  width: ORB_SIZE,
  height: ORB_SIZE,
  '--orb-u': r2(VIEWBOX / ORB_SIZE),
} as CSSProperties;

/** Verzögerungen als Variablen: das CSS entscheidet je Auftritt, welche
 *  Animationen laufen, und setzt die passenden Verzögerungen dazu. */
const delays = (vars: Record<string, number>) =>
  Object.fromEntries(Object.entries(vars).map(([k, ms]) => [k, `${ms}ms`])) as CSSProperties;

export function JarvisOrb({ intro = false }: { intro?: boolean }) {
  return (
    <div className={intro ? 'orb orb--intro' : 'orb'} style={ORB_STYLE}>
      <span className="orb-glow" />

      <svg className="orb-svg" viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} xmlns="http://www.w3.org/2000/svg">
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
              style={delays({ '--draw-delay': 60 + i * 34 })}
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
              // Aufbau versetzt, Drehung phasenversetzt — zusammen ergibt das
              // die durchlaufende Bewegung.
              style={delays({
                '--draw-delay': 120 + i * 30,
                '--spin-delay': (-SPIN_MS / MERIDIAN_COUNT) * i,
              })}
            />
          ))}

          <g className="orb-nodes">
            {nodes.map((n, i) => (
              <circle
                key={`node-${i}`}
                className="orb-node"
                cx={n.x}
                cy={n.y}
                r={2.1}
                style={delays({ '--twinkle-delay': (i % 7) * 380 })}
              />
            ))}
          </g>

          {/* Ein Lichtpuls läuft am Rand entlang — der Herzschlag des Balls. */}
          <circle className="orb-pulse" cx={CX} cy={CY} r={R} pathLength={1} />
        </g>
      </svg>
    </div>
  );
}
