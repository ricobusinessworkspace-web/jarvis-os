# Jarvis-Orb — Handover für Lightning CRM

Zweck: Lightning CRM soll **dieselbe Start- und Ladeanimation** bekommen wie
Jarvis OS — gleiches Bild, gleiches Verhalten, gleicher Eindruck. **Jarvis ist die
Referenz.** Was hier steht, ist am 25.09.2026 in Jarvis gebaut, im Browser
nachgemessen und läuft stabil (Commits `b271165` und früher).

> Der Stack unterscheidet sich: Jarvis = Next.js + React, **CRM = Vite + reines
> JavaScript** (globale Skripte, `switchTab()`, kein React). Das Bild und die
> Regeln werden 1:1 übernommen, der Einbau ist ein anderer — siehe „Portierung".

## 1. Der Vertrag (was der Nutzer erlebt)

Das ist die eigentliche Anforderung. Jeder Punkt wurde in Jarvis erst durch einen
Fehler gefunden — bei der Portierung nicht aufweichen.

1. **Immer da.** Beim Laden/Neuladen steht ab dem ersten Bild die Startsequenz,
   bei jedem Reiter-Wechsel, der wartet, der Ladezustand.
2. **Immer dieselbe Größe.** Ein Ball, **300 px**, überall. (Zwei Größen lasen sich
   als „mal kleiner".)
3. **Immer komplett.** Der Randkreis ist geschlossen, nie mit Lücke.
4. **Bleibt, bis der Inhalt wirklich da ist** — nicht nach Stoppuhr, nicht nach
   einem Zwischenereignis. Dahinter darf nie ein leerer oder halb gefüllter
   Bildschirm sichtbar sein.
5. **Nie im Weg.** Die Startsequenz blockiert keine Klicks und hängt nie fest.

## 2. Zwei Auftritte, ein Bauteil

| | Startsequenz (`.boot`) | Ladezustand (`.nav-orb` / `.route`) |
|---|---|---|
| Wann | Laden / Neuladen der App | Reiter-Wechsel, der wartet |
| Fläche | ganze Seite, deckend, `z-index: 80` | nur Inhaltsbereich (Seitenleiste + Kopfzeile bleiben) |
| Aufbau | wird **eingezeichnet** (`.orb--intro`), kommt aus der Tiefe (860 ms) | steht **sofort komplett**, blendet nur 200 ms ein |
| Dazu | Schriftzug „Jarvis OS" | Schriftzug „lädt" |
| Ende | Ereignis + Mindestdauer 1 s | Ereignis + Mindestdauer 480 ms |
| Abgang | zieht kurz an, wird heller, löst sich auf (620 ms) | verschwindet sofort |

## 3. Dateien in Jarvis (Quelle der Wahrheit)

| Datei | Inhalt |
|---|---|
| `src/components/layout/JarvisOrb.tsx` | **die ganze Geometrie** (Konstanten oben in der Datei) und das SVG |
| `src/app/globals.css`, ab `Jarvis-Orb — der Drahtgitter-Ball` (Z. 280) bis Dateiende | **alle Animationen, Farben, Zeiten**, beide Auftritte, `prefers-reduced-motion` |
| `src/components/layout/BootSplash.tsx` | Startsequenz (Orb + Schriftzug) |
| `src/app/layout.tsx` | Inline-Skript, das `data-booted` auf `<html>` setzt (Ende der Startsequenz) |
| `src/components/layout/NavOrb.tsx` | Ladezustand beim Klick auf einen Reiter (Start am Klick, Ende am Inhalt) |
| `src/components/layout/RouteLoading.tsx`, `src/app/(dashboard)/loading.tsx` | Ladezustand für alles ohne Klick |

## 4. Wie der Ball gebaut ist

- **SVG, `viewBox` 200 × 200**, Kugelradius 70, Mitte (100, 100). Anzeige 300 px.
- **Aufbau von hinten nach vorn:** 3 Wellen (laufen nach außen, 1,3 s versetzt) →
  2 Orbitalringe mit Partikel (gegenläufig, 11 s / 15 s) → Masse (zwei
  weichgezeichnete Kreise, Kern + Glanzpunkt) → Gitter → Lichtpuls am Rand.
- **Gitter:** 7 Breitenkreise (0°, ±25°, ±50°, ±70°, leichte Aufsicht `ry = rx·0,28`),
  6 Längenkreise, Knoten **nur auf den Breitenkreisen** (dort bleiben sie bei jeder
  Drehung gültig), Pole zusätzlich.
- **Die Drehung ist gerechnet, nicht vorgetäuscht:** ein Längenkreis ist in der
  Aufsicht eine Ellipse mit `rx = R·cos φ`. Das CSS animiert `rx` (70 → 0 → 70 px,
  7,2 s, sechs Kreise phasenversetzt). Ein gedrehtes flaches SVG würde stauchen.
- **Kein JavaScript im Ball.** Alles CSS; Verzögerungen stehen als Variablen am
  Element (`--draw-delay`, `--spin-delay`, `--twinkle-delay`).
- **Keine `<defs>`/Verläufe mit `id`** — Startsequenz und Ladezustand können
  gleichzeitig im Dokument stehen, doppelte IDs wären die Folge.
- **Farben:** Gitter `#b96bff`, Rand `#d9a4ff`, Halo `#ff6ad5`, Schein
  `rgba(168,85,247,…)`, Wellen `#c77dff`, Orbits `#a78bfa`, Partikel `#f0d9ff`,
  Masse `rgba(124,58,237,.34)`, Glanz `rgba(216,180,254,.26)`; Hintergrund Schwarz.
- **`prefers-reduced-motion`:** Ball steht still und komplett, Startsequenz geht
  nach 200 ms. Block am Ende von `globals.css` mitnehmen.

## 5. Die Regeln, die Fehler gekostet haben

1. **`vector-effect: non-scaling-stroke` und Strichmuster (`stroke-dasharray`)
   nie kombinieren — auch nicht mit `pathLength`.** Der Browser zeichnet das
   Muster dann in Bildschirm-Pixeln, `pathLength` rechnet aber in Koordinaten:
   beim 300-px-Ball fehlte ein Drittel des Rands (Lücke oben rechts, weil ein
   `<circle>` bei 3 Uhr beginnt). Lösung: kein `non-scaling-stroke` auf Linien mit
   Muster; gleich dicke Striche über `--orb-u = 200 / Größe`, die Strichbreite wird
   mit `calc(Xpx * var(--orb-u))` gesetzt. Das Einzeichnen endet auf
   `stroke-dasharray: 1 0` (Strich ohne Lücke) — der Ring ist am Ende sicher
   geschlossen.
2. **Eingezeichnet wird nur in der Startsequenz.** Ein Aufbau, der länger dauert
   als der Ball steht, zeigt nie den fertigen Ball — und das Einzeichnen endet
   oben rechts. Ein Aufbau darf nie länger dauern als der kürzeste Auftritt.
3. **Eine Größe.** Keine `size`-Prop.
4. **Ende an einem echten Ereignis, nie nach Stoppuhr.** Dazu eine Rückfalltür
   (Obergrenze), damit der Ball nie hängt — aber **die Rückfalltür darf nicht
   kürzer sein als die echte Ladezeit.** Jarvis hatte 4 s; das Dashboard lädt
   2–4,9 s, die Tür war damit der Normalfall und der Ball verschwand mitten im
   Laden. **Erst die echte Ladezeit messen, dann die Obergrenze wählen.**
5. **Mindestdauer = Länge des Aufbaus** (Startsequenz 1000 ms). Kürzer, und er geht
   weg, bevor er fertig ist.
6. **Der Schleier darf nichts blockieren und nichts kaputt machen:**
   `pointer-events: none`, **kein Framework/State im Schleier** (ein Fehler im
   Bundle darf ihn nicht stehen lassen), im DOM **vor** dem Inhalt (dann ist er in
   jedem ersten Bild dabei), Lage über `z-index`.
7. **Ladezustand: nur *sichtbare* Platzhalter zählen.** React streamt Inhalte in
   versteckten Behältern (`<div hidden>`) und lässt dort den alten Platzhalter
   liegen. Prüfung per `el.getClientRects().length > 0`, nicht per bloßer Existenz.
8. **Der Pfadwechsel ist nicht das Ende.** Next schaltet den Pfad nach ~200 ms um,
   der Inhalt kam erst nach 1–2,4 s. Ende = Pfad neu **und** kein sichtbarer
   Ladezustand mehr.
9. **Nach jeder Änderung im Browser nachmessen,** nicht nur Code lesen. Der erste
   Fix der Lücke sah richtig aus und änderte im Browser nichts.

## 6. Die Zahlen (alle an einem Ort halten)

| Was | Wert | Wo |
|---|---|---|
| Ballgröße | 300 px | `ORB_SIZE` in `JarvisOrb.tsx` |
| Aufbau Startsequenz | 860 ms | `.orb--intro .orb-svg` |
| Einblenden Ladezustand | 200 ms | `.orb-svg` |
| Mindestdauer Startsequenz `MIN` | 1000 ms | Skript in `layout.tsx` |
| Rückfalltür 1 `SETTLE` | 1500 ms nach „Dokument durch" | dito |
| Rückfalltür 2 `MAX` | 15 000 ms | dito |
| Mindestdauer Ladezustand `MIN_MS` | 480 ms | `NavOrb.tsx` |
| Notbremse Ladezustand `MAX_MS` | 8000 ms | `NavOrb.tsx` |
| Abgang Startsequenz | 620 ms | `html[data-booted] .boot` |

Das Inline-Skript (Ende der Startsequenz), sinngemäß:

```js
(function(){var MIN=1000,SETTLE=1500,MAX=15000,t0=Date.now(),d=0;
function go(){if(d)return;d=1;document.documentElement.dataset.booted="1";}
function ready(){setTimeout(go,Math.max(0,MIN-(Date.now()-t0)));}
setTimeout(go,MAX);
if(document.readyState==="complete"){ready();return;}
addEventListener("load",ready,{once:true});
addEventListener("DOMContentLoaded",function(){setTimeout(ready,SETTLE);},{once:true});})();
```

Das CSS reagiert auf `html[data-booted]` (Abgang). Das Skript läuft beim Parsen,
registriert nur Rückrufe und blockiert nichts.

## 7. Portierung auf Lightning CRM

Stand im CRM (`~/dev/Lightning CRM`): Vite 8, **kein React**, `index.html` mit
globalen Skripten (`core/*.js?v=…`), Reiter über `switchTab('…')`
(Aufgaben, Kaltakquise, Pipeline, Kunden, Karte, Radar Scout, Command Center),
bisher ein **Spinner** als Splash: `#startup-splash` in `index.html`, Stile in
`styles.css` (`.splash-hidden`), `--z-splash: 2000` in `theme.css`.

**Empfohlener Weg:**

1. **CSS:** den Orb-Block aus `globals.css` (ab Z. 280) 1:1 in eine eigene Datei
   (z. B. `orb.css`) kopieren. Nur die Variable für den Hintergrund
   (`--color-bg-base`) auf das CRM-Gegenstück zeigen lassen und `z-index` auf
   `var(--z-splash)`. Sonst nichts ändern — Zahlen und Namen gleich lassen, damit
   spätere Änderungen in Jarvis 1:1 übertragbar bleiben.
2. **Markup:** die SVG-Erzeugung aus `JarvisOrb.tsx` in eine reine JS-Funktion
   `orbMarkup({ intro })` übertragen (gleiche Konstanten, gleiche Schleifen →
   identisches SVG). Aus dem React-Bauteil wird ein String, sonst bleibt alles
   gleich. Wichtig: `pathLength="1"` auf allen Linien mit Strichmuster,
   `style="--orb-u:0.67"` (200/300) am `.orb`.
3. **Startsequenz:** `#startup-splash` durch `.boot` (Orb + Schriftzug) ersetzen.
   **Das Ende ist im CRM nicht `load`**, sondern „Anmeldung geprüft und erste
   Daten da" — **die Stelle finden, an der heute `splash-hidden` gesetzt wird
   (`grep -rn "startup-splash\|splash-hidden"`), und dort `data-booted` setzen
   statt die Klasse.** Dann gelten dieselben Regeln: Mindestdauer 1000 ms,
   Obergrenze **erst nach Messung der echten CRM-Ladezeit** (Login + Daten),
   `pointer-events: none`, kein Zustand im Schleier. Login-Modal beachten: der
   Ball darf die Anmeldung nicht verdecken (Schleier bei Login weg, nicht erst
   nach Eingabe).
4. **Ladezustand beim Reiter-Wechsel:** in `switchTab()` einhängen. Hier gibt es
   einen Unterschied: wechselt ein Reiter **sofort** (Daten schon im Speicher),
   darf **kein** Ball erscheinen — 480 ms Mindestdauer würden die App ausbremsen.
   Der Ball erscheint nur, wenn der Reiter wirklich wartet (Karte, Radar Scout,
   erstes Laden). Regel bleibt: Start am echten Warten, Ende am echten Fertig
   (Promise des Reiters), Mindestdauer 480 ms einmal sichtbar, Notbremse 8 s.
5. **Cache:** das CRM hängt `?v=4.x` an Skripte und Stile und hat einen
   Service-Worker-Cache. **Beim Ändern `?v=` hochzählen** und beim Testen den
   Cache leeren — sonst sieht man die alte Version und hält den Fix für wirkungslos.
   (Der CRM-Service-Worker hat schon einmal Jarvis' Anfragen auf `localhost:3000`
   abgefangen: Beide Projekte nie auf demselben Port testen.)
6. **Schriftzug:** „Jarvis OS" → „Lightning CRM" (nur der Text; Stil gleich).

## 8. Abnahme (alles im Browser messen, nicht schätzen)

- [ ] Randkreis geschlossen bei 300 px (Rand-`stroke-dasharray` am Ende `1 0`,
      `vector-effect: none` auf Linien mit Muster)
- [ ] Ballgröße in **allen** Auftritten 300 px
- [ ] Startsequenz verschwindet **frühestens** mit dem Inhalt — bei langsamer und
      schneller Verbindung testen (Drosselung in den DevTools)
- [ ] Reiter-Wechsel: **kein einziges Bild** ohne Ball *oder* Inhalt dazwischen
- [ ] Schneller Reiter ohne Warten: kein Ball, kein Flackern
- [ ] Login-Bildschirm nicht verdeckt, Klicks gehen durch
- [ ] Obergrenze > gemessene echte Ladezeit
- [ ] `prefers-reduced-motion` getestet
- [ ] Konsole ohne Fehler; Cache geleert / `?v=` erhöht

## 9. Offene Entscheidungen für Rico

- **Gleicher Ball, gleiche Farbe?** Das Handover geht davon aus (violett auf
  Schwarz). Soll das CRM einen eigenen Akzent bekommen (Blitz statt Globus)?
- **Wer pflegt die Referenz?** Änderungen am Ball immer in Jarvis machen und im
  CRM nachziehen — oder später in ein gemeinsames Paket auslagern.
