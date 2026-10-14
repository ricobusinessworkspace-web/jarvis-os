# iPhone-Widgets (Scriptable)

> Referenzdokument, kein Handover. Der Stand des Projekts steht in `HANDOVER.md`.

Seit 14.10.2026 **zwei** Widgets, beide über die App **Scriptable** (kostenlos,
kein eigener App-Build). Die alten drei (Calls alt, Routine, Ringe) sind
abgebaut — Endpunkte `/api/widgets/calls`, `/routines`, `/motivation` gibt es
nicht mehr.

| Widget | Zeigt | Skript | Tippt nach |
|---|---|---|---|
| **Jarvis Heute** | Der Tag als Kacheln (Calls, Training, Post, Morgen, Abend, Regeln); groß zusätzlich die Woche Mo–So | `scriptable/jarvis-heute.js` | `/` |
| **Jarvis Calls** | Calls heute gegen Basis, Woche gegen Wochenziel, Tage übrig, pro Tag nötig; mittel mit Split | `scriptable/jarvis-calls.js` | `/vertrieb` |

Beide lesen **einen** Endpunkt: `GET /api/widgets/heute` (Daten aus
`heuteUndWoche()` im `WochenService` — dieselbe Matrix wie das Dashboard).

**Produktion ist `https://jarvis-os-indol.vercel.app`.** Nicht
`jarvis-os-wardogs.vercel.app` — die Adresse zeigt auf ein altes,
SSO-geschütztes Deployment. Bei Zweifeln `vercel projects ls`.

---

## Größen

| | Jarvis Heute | Jarvis Calls |
|---|---|---|
| klein | „4/6", sechs Blöcke (je Commitment), Satz, Calls | Calls heute groß, Schiene, Woche |
| mittel | sechs Kacheln mit Namen und Wert | links heute, rechts Woche + Split |
| groß | Kacheln + Woche im Blocksystem (Zeile je Commitment, Spalte je Tag) | — |
| Sperrbildschirm rechteckig | sechs Mini-Blöcke, „4 von 6 erledigt", Calls | Calls, Schiene, Woche |
| Sperrbildschirm rund | „4/6" | Calls heute |

## Gestaltung

Dasselbe Blocksystem wie im Dashboard: **Weiß = Soll, Grau = Basis, Rot =
darunter, Rahmen = offen / nicht gemessen, gedämpft = frei bzw. kommt noch.**
Hell- und Dunkelmodus über `Color.dynamic`; auf dem Sperrbildschirm färbt iOS
selbst ein.

**Ein Tag, der läuft, ist nie rot.** Heute steht als „offen", bis er erfüllt ist
— ein roter Block um 08:00 würde „verfehlt" behaupten. Der **Wert** wird nie
geschönt: vergangene Tage mit 0 Calls stehen als 0 (rot), ohne Eintrag als
„nicht gemessen" (Rahmen).

**Keine Logik im Skript.** Zustände, Wochenziele (Tagesziel × Arbeitstage) und
alle Sätze (`texte.heute`, `texte.woche`, `texte.wocheRest`, `texte.callsZiel`)
kommen fertig aus der Antwort. Sonst stünde ein Ziel ein zweites Mal im Code —
auf dem Telefon, beim nächsten Zielwechsel still falsch.

Ohne Netz zeigt das Widget den letzten Stand mit `Stand 14:03 · offline` —
nie eine alte Zahl ohne Hinweis.

## Wie aktuell

iOS entscheidet, wie oft es nachlädt (grob alle 15 Minuten). Der Endpunkt
wünscht sich tagsüber 10 Minuten, nachts 60 (`refreshAfterSeconds`). Sofort
frisch: antippen — die Seite lädt live.

## Einrichten

> **Am 14.10. erledigt:** `Jarvis Heute.js` und `Jarvis Calls.js` liegen mit
> eingetragenem Token in Ricos Scriptable-iCloud-Ordner; die alten Skripte
> `Jarvis Routinen.js` und `Jarvis Ringe.js` sind dort gelöscht.
> **Rico muss nur noch:** alte Widgets vom Homescreen nehmen (sie zeigen sonst
> „nicht erreichbar") und die neuen platzieren — Homescreen lange drücken →
> **+** → Scriptable → Größe → Widget antippen → *Script* = `Jarvis Heute` bzw.
> `Jarvis Calls`. Ein bereits platziertes Widget mit Script `Jarvis Calls`
> funktioniert ohne Zutun weiter (gleicher Name, neuer Inhalt).

**Secret.** `WIDGET_SECRET_TOKEN` steht in Vercel (Production + Preview) und in
`.env.local`. Ohne Variable antwortet der Endpunkt mit `503` — einen fest
eingebauten Standardwert gibt es nicht, das Repository ist öffentlich.

**Prüfen:**

```bash
curl -s -H "Authorization: Bearer $WIDGET_SECRET_TOKEN" https://jarvis-os-indol.vercel.app/api/widgets/heute
```

Erwartet `"ok":true`. Zwei Sorten `401` unterscheiden: `{"error":"Unauthorized"}`
= App antwortet, Token falsch. `Protected deployment` oder Umleitung auf
`vercel.com/sso-api` = falsche Adresse.

**Skript aufs iPhone.** Scriptable legt Skripte in
`~/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/` ab; was dort
auf dem Mac landet, erscheint auf dem iPhone von selbst. Ganz oben muss
Scriptables Kopf stehen:

```javascript
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-gray; icon-glyph: calendar-check;
```

Kopf und echter `TOKEN` kommen erst beim Kopieren nach iCloud dazu — im Repo
steht der Platzhalter. **Kein Secret im öffentlichen Repository.**

## Antwort des Endpunkts (gekürzt)

```json
{
  "ok": true,
  "datum": "2026-10-14",
  "heute": {
    "erledigt": 1, "gesamt": 6,
    "kacheln": [
      { "key": "sales.calls_count", "name": "Calls", "wert": 0, "basis": 30, "soll": 50, "zustand": "offen" },
      { "key": "training.sessions", "name": "Training", "wert": null, "zustand": "offen" },
      { "key": "regeln", "name": "Regeln", "wert": 3, "soll": 3, "zustand": "soll" }
    ]
  },
  "woche": {
    "von": "2026-10-12", "bis": "2026-10-18", "tageUebrig": 4,
    "zeilen": [ { "key": "sales.calls_count", "name": "Calls", "zellen": ["unter", "unter", "offen", "kommt", "kommt", "kommt", "frei"], "ist": 0, "ziel": 180 } ],
    "calls": { "ist": 0, "basis": 180, "soll": 300, "proTag": 45, "split": [ … ] },
    "rueckfaelle": 0
  },
  "texte": { "heute": "1 von 6 erledigt", "calls": "0 / 30", "woche": "0 / 180", "wocheRest": "4 Tage übrig · noch 45 pro Tag", "callsZiel": "Basis 30 · Soll 50" },
  "refreshAfterSeconds": 600
}
```

`wert: null` heißt **nicht gemessen**, nicht 0. `zustand` ist einer von
`soll · basis · unter · leer · offen · frei · kommt`.
