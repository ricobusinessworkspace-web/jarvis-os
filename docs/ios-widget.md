# iPhone-Widgets (Scriptable)

> Referenzdokument, kein Handover. Der Stand des Projekts steht in `HANDOVER.md`.

Zwei Widgets, beide über die App **Scriptable** (App Store, kostenlos). Scriptable
führt JavaScript aus und baut daraus echte iOS-Widgets — kein eigener App-Build,
keine Xcode-Kette, kein Apple-Developer-Account.

| Widget | Zeigt | Skript | Endpunkt |
|---|---|---|---|
| **Calls heute** | Tages-Calls gegen Basis und Soll | `scriptable/jarvis-calls.js` | `GET /api/widgets/calls` |
| **Routine** | Morgen- bzw. Abendroutine | `scriptable/jarvis-routines.js` | `GET /api/widgets/routines` |

**Produktion ist `https://jarvis-os-indol.vercel.app`.** Nicht
`jarvis-os-wardogs.vercel.app` — die Adresse zeigt auf ein altes, SSO-geschütztes
Deployment und beantwortet keine Widget-Anfragen. Bei Zweifeln `vercel projects ls`.

---

# 1. Calls heute

## Was es zeigt

Aufgebaut wie das Apple-Wetter-Widget, Zeile für Zeile dieselbe Ordnung:

| Wetter | Calls |
|---|---|
| `18°` | `47` — Calls heute |
| `Mostly Cloudy` | `Basis erreicht` — der Zustand im Klartext |
| — | die Schiene: Balken von 0 bis Soll, Kerbe an der Basis |
| `H:24° L:11°` | `Basis 30 · Soll 100` |

Die **Schiene** ist das Kernstück: eine Spur von 0 bis zum Tagesziel, gefüllt bis
zum aktuellen Stand. Die Basis sitzt darin als echte Lücke im Balken, nicht als
aufgemalter Strich — eine Lücke stimmt auf jedem Hintergrund, ein Strich müsste
die Hintergrundfarbe kennen, und auf dem Sperrbildschirm ist das das Wallpaper.
Solange der Füllstand die Basis noch nicht erreicht hat, markiert sie ein feiner
Strich auf der leeren Spur.

Unterstützte Größen: **klein** und **mittel** auf dem Homescreen (mittel zeigt
rechts zusätzlich die Tagesaufteilung Cold Groß / Cold Tarif / Nachgreifen),
**rechteckig** auf dem Sperrbildschirm. Ein Tipp öffnet `/vertrieb`.

Farben folgen dem Dashboard: monochrome Helligkeitsrampe, einzige Farbe ist Rot
für „unter Basis". Hell- und Dunkelmodus über `Color.dynamic`, auf dem
Sperrbildschirm färbt iOS ohnehin selbst ein.

## Die Feierabend-Regel

Im Semantic Layer ist ein Tag mit 3 von 30 Calls `unter` — verfehlt. Auf dem
Dashboard stimmt das den ganzen Tag, dort steht die Zahl in einer Tabelle neben
der Uhrzeit. Ein Widget steht dagegen ab Mitternacht auf dem Homescreen: ein
roter Balken um 08:00 Uhr behauptet „Tag verfehlt", obwohl der Tag noch läuft.

Der Endpunkt gibt deshalb zwei Felder zurück:

- `state` — der echte Zustand aus dem Semantic Layer, unverändert
- `verdict` — derselbe Zustand fürs Widget, mit `laeuft` statt `unter`, solange
  es vor `FEIERABEND_HOUR` (18:00 Berliner Zeit) ist

Der **Wert** wird dabei nie geschönt, nur das Urteil zurückgehalten. Andere
Stunde gewünscht: `FEIERABEND_HOUR` in `src/app/api/widgets/calls/route.ts`.

## Wie aktuell die Zahl ist

**Woher die Calls kommen, ist egal.** Mac-App, iPhone-PWA und das Lightning CRM
hängen an derselben Supabase-Datenbank; das Widget liest denselben Semantic Layer
wie der Vertriebs-Reiter. Ein Anruf, der irgendwo protokolliert wird, ist im
selben Moment in der Antwort — es gibt keinen zweiten Datenstand, der nachziehen
müsste.

**Wie oft iOS nachfragt, entscheidet iOS.** Das Skript setzt `refreshAfterDate`,
aber das ist ein Wunsch, kein Befehl: das System deckelt Widget-Aktualisierungen
auf grob 40–70 pro Tag und Widget, in der Praxis sind das ~15 Minuten. Der
Endpunkt hält den Takt deshalb dort kurz, wo sich die Zahl bewegt
(`refreshAfterSeconds`): 5 Minuten zwischen 07:00 und 20:00, sonst 30, am Off-Day
60. Echte Push-Aktualisierung bräuchte ein natives WidgetKit-Target mit APNs —
ein eigener App-Build mit Developer-Account, nicht mit Scriptable machbar.

**Sofort frisch: antippen.** Der Tipp öffnet `/vertrieb`, und die Seite lädt live.

Ohne Netz zeigt das Widget die zuletzt geholte Zahl und schreibt `Stand 14:03 ·
offline` an die Stelle der Grenzen — nie eine alte Zahl ohne diesen Hinweis.

## Einrichten

> **Am 15.09. bereits erledigt:** `WIDGET_SECRET_TOKEN` steht in Vercel
> (Production + Preview) und in `.env.local`; beide Skripte liegen mit
> eingetragenem Token in Ricos Scriptable-iCloud-Ordner. Die folgenden Schritte
> stehen hier für den Fall, dass das Secret gewechselt oder ein neues Gerät
> eingerichtet wird.

**1. Secret in Vercel setzen.** Einen Zufallswert erzeugen:

```bash
openssl rand -hex 24
```

Vercel → Projekt `jarvis-os` → Settings → Environment Variables →
`WIDGET_SECRET_TOKEN` = der erzeugte Wert, für alle Umgebungen. Danach einmal neu
deployen, sonst kennt die laufende Instanz die Variable nicht.

> Ohne gesetzte Variable antwortet der Endpunkt bewusst mit `503` statt mit
> Daten. Einen fest eingebauten Standardwert gibt es nicht — das Repository ist
> öffentlich.

**2. Lokal dasselbe.** In `.env.local` dieselbe Zeile, wenn das Widget gegen den
Dev-Server getestet werden soll.

**3. Prüfen, ob der Endpunkt antwortet:**

```bash
curl -s -H "Authorization: Bearer $WIDGET_SECRET_TOKEN" https://jarvis-os-indol.vercel.app/api/widgets/calls
```

Erwartet wird JSON mit `"ok":true`. Zu den beiden Sorten `401` siehe unten.

**4. Skript aufs iPhone bringen.** Zwei Wege:

*Über iCloud (schneller, kein Tippen am Telefon).* Scriptable legt seine Skripte
in `~/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/`. Eine
Datei, die dort auf dem Mac landet, erscheint in der iPhone-App von selbst.
Wichtig: Scriptables eigener Kopf muss **als erstes** in der Datei stehen, sonst
bekommt das Skript kein Symbol und keine Zuordnung:

```javascript
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: phone-alt;
```

Der Kopf steht **nicht** in den Repo-Fassungen unter `scriptable/` — dort wäre er
nur Beiwerk. Er kommt beim Kopieren nach iCloud davor, zusammen mit dem echten
`TOKEN`. Deshalb liegen die Dateien im Repo mit Platzhalter: **kein Secret im
öffentlichen Repository.**

*Von Hand.* Scriptable öffnen → **+** → Inhalt von `scriptable/jarvis-calls.js`
einfügen → oben rechts umbenennen in `Jarvis Calls` → im Kopf `TOKEN` durch das
Secret ersetzen. `HOST` steht bereits richtig.

**5. Widget aufs Homescreen.** Lange auf den Homescreen tippen → **+** →
Scriptable → Größe wählen → platzieren → auf das Widget tippen →
Script = `Jarvis Calls`, **When Interacting = Run Script**.

Für den Sperrbildschirm dasselbe über Sperrbildschirm → Anpassen → Widget unter
der Uhr → Scriptable → die rechteckige Variante.

## Antwort des Endpunkts

```
GET /api/widgets/calls
Authorization: Bearer <WIDGET_SECRET_TOKEN>
```

Alternativ `?token=…`, weil Scriptable sich in manchen Zusammenhängen mit
Kopfzeilen schwertut. Die Kopfzeile ist vorzuziehen: Query-Parameter landen in
Server-Logs.

```json
{
  "ok": true,
  "date": "2026-09-15",
  "generatedAt": "2026-09-15T20:53:19.402Z",
  "offDay": false,
  "dayOver": true,
  "calls": {
    "key": "sales.calls_count",
    "label": "Calls",
    "value": 47, "base": 30, "stretch": 100,
    "state": "basis", "verdict": "basis", "verdictLabel": "Basis erreicht",
    "bounds": "Basis 30 · Soll 100", "display": "47",
    "source": "crm_metrics", "targetHint": null,
    "progress": 0.47, "basePoint": 0.3
  },
  "teile": [ … dieselbe Form für die drei Tagesanteile … ],
  "refreshAfterSeconds": 300
}
```

Wichtig für Änderungen: **alle Anzeigetexte kommen fertig aus der Antwort.**
`verdictLabel` und `bounds` werden aus `src/lib/metricState.ts` gebildet, also aus
derselben Quelle wie die Beschriftungen im Dashboard. Im Skript steht deshalb
kein einziger Zielwert und keine deutsche Formulierung — sonst stünde das Ziel
ein zweites Mal im Code und wäre beim nächsten Zielwechsel im CRM still falsch.

`value: null` heißt **nicht gemessen**, nicht null. Das Widget zeigt dann `–` und
eine leere Spur, nie eine 0. Ebenso `progress: null`, wenn kein Soll auflösbar
ist — eine Schiene ohne Maß wäre eine erfundene Zahl.

---

# 2. Routine

Zeigt vor 15:00 Uhr die Morgen-, danach die Abendroutine — vier Schritte, darunter
„+ n weitere". Ein Tipp öffnet `/routines`. Skript: `scriptable/jarvis-routines.js`,
Endpunkt `GET /api/widgets/routines`, Datenquelle `RoutineService.getTodayRoutines()`.

Einrichtung wie beim Calls-Widget: Skript in Scriptable anlegen, `TOKEN` eintragen,
Widget platzieren. Beide Endpunkte nutzen **dasselbe** `WIDGET_SECRET_TOKEN`.

> **Geändert am 15.09.:** Dieses Widget hatte einen fest eingebauten Token
> (`jarvis-scriptable-secret-123`) im Query-String und zeigte auf
> `jarvis-os-wardogs.vercel.app` — also auf das alte, SSO-geschützte Deployment,
> erreichbar nur über einen Bypass-Token. Beides ist raus: `Authorization`-Kopfzeile
> mit `WIDGET_SECRET_TOKEN`, richtige Produktions-URL, kein Bypass mehr nötig.
> Wer noch eine alte Fassung des Skripts auf dem Telefon hat, bekommt `401`.

# 3. Wenn etwas nicht geht

**Zwei Sorten `401` unterscheiden** — das kostet sonst Stunden:

| Antwort | Bedeutung | Zu tun |
|---|---|---|
| `{"error":"Unauthorized"}`, Kopfzeile `x-matched-path` | Die App hat geantwortet, das Secret stimmt nicht | Token im Skript gegen `WIDGET_SECRET_TOKEN` in Vercel prüfen |
| `{"error":{"message":"Protected deployment"}}` oder `302` auf `vercel.com/sso-api` | Die Anfrage kam nie an, die **Adresse** stimmt nicht | Produktions-URL prüfen (`vercel projects ls`) |

**`503 "WIDGET_SECRET_TOKEN ist nicht gesetzt"`** — Variable in Vercel fehlt oder
es wurde nach dem Setzen nicht neu deployt.

**Widget zeigt `nicht gemessen`** — der Endpunkt antwortet, aber der Semantic
Layer hat für heute keinen Wert. `npm run core:check` rechnet nach, woran es
liegt. Das ist kein Widget-Fehler.

**Widget aktualisiert gefühlt nie** — iOS deckelt Aktualisierungen pro Widget.
Weniger Scriptable-Widgets gleichzeitig hilft, weil sie sich das Kontingent
teilen. Antippen holt immer frisch.

**Zum nativen Widget wechseln (WidgetKit, Swift):** Endpunkt bleibt wie er ist,
`Authorization`-Kopfzeile in `URLSession` setzen, `verdict`/`progress`/`basePoint`
direkt verwenden. Für Abhaken direkt im Widget braucht es App Intents (iOS 17)
plus einen `POST`-Endpunkt — für Calls gibt es nichts abzuhaken, die kommen aus
dem CRM.
