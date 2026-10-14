# Wochenzyklus — gemeinsame Spec (Jarvis OS + Lightning CRM)

> Diese Datei liegt identisch in beiden Repos unter `docs/wochenzyklus-spec.md`.
> Die Agents lesen jeweils nur ihr eigenes Repo. Änderungen an der Spec müssen
> in beiden Kopien gemacht werden.

## Prinzip

Die Einheit der Steuerung ist die **laufende Woche**, nicht der Monat.
Mo 00:00 – So 23:59. Sonntag 23:59 ist ein harter Schnitt: danach keine
Nachträge mehr für diese Woche.

> **Jarvis, ab 14.10.2026 strenger (Rico):** Bearbeitbar ist nur **der
> laufende Tag** — um 0 Uhr ist er zu, Offenes bleibt „nicht gemessen".
> Mentaler Reset: jeden Morgen frisch, ohne die letzten Tage zu korrigieren.
> Gilt in Jarvis für Dashboard und ChatGPT (`TrackingService.nurHeute`).
> **Die CRM-Kopie dieser Spec muss das noch nachziehen.**

## Warum

Historische Fehlwochen als rote Flächen anzuzeigen erzeugt Vermeidung statt
Handlung. Die aktuelle Woche ist rettbar, die vergangene nicht. Die UI
priorisiert konsequent das Rettbare.

## Anzeige-Hierarchie (verbindlich)

1. **Primär** — laufende Woche: Fortschritt gegen Wochenziel als Zahl plus
   verbleibende Arbeitstage.
   Beispiel: `32 / 180 Anrufe · 4 Tage übrig`
2. **Sekundär** — Serien: aktuelle Serie und beste Serie (Tage in Folge mit
   erfülltem Tagesminimum).
3. **Tertiär, klein** — Historie ausschließlich aggregiert (Sparkline oder
   Punktreihe, ein Punkt pro Woche). **Nie** als Kalender-Heatmap mit roten
   Tagesflächen.

## Nicht verhandelbar

- Serien müssen brechen können. Brüche bleiben sichtbar.
- Ein Tag mit 0 Anrufen wird als `0` angezeigt, nicht als leer.
- Keine Beschönigung, kein Verstecken von Null-Tagen.
- Vergangenheit sichtbar, aber nie dominant.

## Zielwerte (Stand Okt 2026, Mo–Sa = 6 Arbeitstage)

| | pro Tag | pro Woche |
|---|---|---|
| Baseline | 30 | 180 |
| Performance | 50 | 300 |

**Split Performance:** 20 Cold Großkunden · 20 Cold Tarif · 10 warme Nachfass-Anrufe
**Split Baseline:** 10 · 10 · 10
**Tagesminimum erfüllt** = Baseline erreicht

Zielwerte sind Konfiguration, keine Konstanten im Code.

## Kennzahlen pro Woche

- Anrufe gesamt + Split nach den drei Kategorien
- Termine
- Abschlüsse
- Abschlussquote (Abschlüsse / Anrufe)

Jede Zahl wird gegen ihr Wochenziel angezeigt.
