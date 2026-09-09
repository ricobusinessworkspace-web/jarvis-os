# Apple-Anbindung — Setup der Kurzbefehle

Apple Erinnerungen und Apple Health haben **keine Cloud-API**. Vercel kommt dort nie
direkt heran. Beides muss deshalb vom iPhone aus geschoben werden: zwei
Kurzbefehl-Automationen sammeln die Daten und schicken sie an Jarvis.

Dieselbe Schiene nutzt schon das Scriptable-Widget (siehe `IOS_WIDGET.md`).

**Endpunkt:** `POST https://jarvis-os-wardogs.vercel.app/api/ingest/apple`

---

## Schritt 1 — Secret setzen

Der Endpunkt nimmt **nichts** an, solange kein Secret konfiguriert ist. Das ist Absicht:
ein offener Ingest-Endpunkt wäre ein Schreibzugriff auf deine Datenbank für jeden, der
die URL kennt.

1. Ein langes Zufalls-Secret erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

2. In **Vercel → Projekt → Settings → Environment Variables** anlegen:
   - Name: `INGEST_SECRET`
   - Value: der erzeugte String
   - Environments: Production (und Preview, falls du dort testen willst)
3. Einmal neu deployen, damit die Variable greift.
4. Denselben Wert lokal in `.env` eintragen, wenn du gegen `localhost` testen willst.

> Das Secret gehört **nicht** in dieses Dokument oder in einen Commit.

---

## Schritt 2 — Endpunkt testen, bevor du Kurzbefehle baust

Erst prüfen, ob Token und Server stimmen. Das erspart dir, einen Kurzbefehl zu
debuggen, der gar nicht das Problem ist.

```bash
curl -s "https://jarvis-os-wardogs.vercel.app/api/ingest/apple" \
  -H "Authorization: Bearer DEIN_SECRET" \
  -H "x-vercel-protection-bypass: DEIN_BYPASS_TOKEN"
```

Erwartete Antwort: `{"ok":true,"sources":{}}` — noch nichts geliefert, aber erreichbar.

- `401` → Secret stimmt nicht oder ist in Vercel nicht gesetzt.
- HTML statt JSON → der Vercel-SSO-Schutz greift. Dann brauchst du den
  `x-vercel-protection-bypass`-Header, denselben wie das Scriptable-Widget
  (Vercel → Settings → Deployment Protection → Protection Bypass for Automation).

Ein Schreibtest:

```bash
curl -s -X POST "https://jarvis-os-wardogs.vercel.app/api/ingest/apple" \
  -H "Authorization: Bearer DEIN_SECRET" \
  -H "x-vercel-protection-bypass: DEIN_BYPASS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"calories": 1840}'
```

Erwartet: `{"ok":true,"health":1}` — und im Dashboard stehen 1.840 kcal.

---

## Schritt 3 — Kurzbefehl „Jarvis: Erinnerungen"

Kurzbefehle-App → **+** → Aktionen in dieser Reihenfolge:

**1. „Erinnerungen finden"**
- Filter: `Ist erledigt` — `ist` — `Nein`
- Optional zusätzlich: `Fälligkeitsdatum` — `ist vor` — `Ende des heutigen Tages`
  (dann kommen nur heute Fällige und Überfällige)
- Sortieren nach: Fälligkeitsdatum
- *Kein Limit setzen*

**2. „Variable festlegen"** → Name: `Liste` → Wert: leer lassen
*(erzeugt eine leere Liste, an die die Schleife anhängt)*

**3. „Wiederholen mit jedem Objekt"** über das Ergebnis von Schritt 1

Innerhalb der Schleife:

**3a. „Wörterbuch"** mit diesen Feldern — Werte jeweils über die Variable
`Wiederholungselement` einfügen und dort die passende Eigenschaft wählen:

| Schlüssel | Typ | Wert |
|---|---|---|
| `title` | Text | Wiederholungselement → *Name* |
| `list` | Text | Wiederholungselement → *Liste* |
| `dueAt` | Text | Wiederholungselement → *Fällig am* |
| `notes` | Text | Wiederholungselement → *Notizen* |

**3b. „Zu Variable hinzufügen"** → Variable: `Liste`

> Erinnerungen bieten in Kurzbefehlen keine stabile ID an. Das ist in Ordnung —
> der Endpunkt bildet sich dann selbst einen Schlüssel aus Titel und Fälligkeit.
> `list` und `notes` sind optional; nur `title` wird gebraucht.

**4. Nach der Schleife: „Inhalte von URL abrufen"**
- URL: `https://jarvis-os-wardogs.vercel.app/api/ingest/apple`
- Methode: **POST**
- Header:
  - `Authorization` = `Bearer DEIN_SECRET`
  - `x-vercel-protection-bypass` = `DEIN_BYPASS_TOKEN` *(nur falls nötig, siehe Schritt 2)*
- Anfragetext: **JSON**
  - Feld `reminders`, Typ **Array**, Wert: Variable `Liste`

Einmal von Hand ausführen. Antwort sollte `{"ok":true,"reminders":N}` sein.

---

## Schritt 4 — Kurzbefehl „Jarvis: Kalorien"

**1. „Health-Sample suchen"** (bzw. „Gesundheitsdaten abrufen")
- Typ: **Nahrungsenergie**
- Zeitraum: heute

**2. „Statistik berechnen"**
- Operation: **Summe**
- Eingabe: Ergebnis aus Schritt 1

**3. „Inhalte von URL abrufen"**
- URL und Header wie oben
- Anfragetext: **JSON**
  - Feld `calories`, Typ **Zahl**, Wert: Ergebnis aus Schritt 2

Antwort: `{"ok":true,"health":1}`.

> Cronometer schreibt beim Loggen nach Apple Health. Jarvis liest also Health, nicht
> Cronometer — du kannst die App jederzeit wechseln, ohne hier etwas zu ändern.

---

## Schritt 5 — Automatisch laufen lassen

Kurzbefehle-App → **Automation** → **+** → **Tageszeit**

- Zwei Automationen anlegen, je eine pro Kurzbefehl
- Wiederholen: **Täglich**, oder stündlich über mehrere Zeitpunkte
- **„Vor dem Ausführen fragen" ausschalten** — sonst kommt bei jedem Lauf eine Rückfrage

Sinnvolle Zeiten: Erinnerungen mehrmals täglich (morgens, mittags, abends),
Kalorien einmal spät am Abend, wenn der Tag durchgeloggt ist.

---

## Was Jarvis mit den Daten macht

| Quelle | Landet in | Zeigt sich als |
|---|---|---|
| Erinnerungen | `ingest_reminders` (wird bei jedem Lauf komplett ersetzt) | Aufgaben-Karte, linke Spalte |
| Nahrungsenergie | `ingest_health_daily` (pro Tag überschrieben) | Kalorien-Karte, Health-Reiter |

**Apple bleibt die Wahrheit.** Jarvis hält nur eine Kopie zum Anzeigen — abhaken und
bearbeiten passiert weiter in Erinnerungen bzw. Cronometer. Deshalb ersetzt jeder Lauf
die Erinnerungen vollständig, statt zusammenzuführen: gelöschte Erinnerungen
verschwinden so von selbst.

**Wenn eine Automation ausfällt**, zeigt Jarvis „nicht verbunden" bzw. „nicht gemessen" —
niemals 0. Ein ausgefallener Sync sieht damit anders aus als ein Tag, an dem du nichts
gegessen oder nichts zu tun hattest.

---

## Fehlersuche

| Symptom | Ursache |
|---|---|
| `401 Unauthorized` | `INGEST_SECRET` fehlt in Vercel oder weicht vom Kurzbefehl ab |
| HTML statt JSON | Vercel-SSO-Schutz — `x-vercel-protection-bypass`-Header ergänzen |
| `400 Nichts erkannt` | Anfragetext ist nicht JSON, oder das Feld heißt anders als `reminders` / `health` / `calories` |
| `{"ok":true,"reminders":0}` | Der Filter in „Erinnerungen finden" trifft nichts — Filter im Kurzbefehl prüfen |
| Karte bleibt leer, obwohl `ok:true` | Alle gelieferten Erinnerungen waren erledigt oder liegen in der Zukunft |

Der Endpunkt ist absichtlich nachsichtig: Zahlen dürfen als Text kommen (`"1.840 kcal"`
wird verstanden), `completed` akzeptiert `true` / `1` / `"ja"`, und statt einer
Objektliste tut es zur Not auch eine reine Titel-Liste als Text.
