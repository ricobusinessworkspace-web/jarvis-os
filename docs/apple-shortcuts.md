# Apple-Anbindung — Setup der Kurzbefehle

Apple Erinnerungen und Apple Health haben **keine Cloud-API**. Vercel kommt dort nie
direkt heran. Beides muss deshalb vom iPhone aus geschoben werden: zwei
Kurzbefehl-Automationen sammeln die Daten und schicken sie an Jarvis.

Dieselbe Schiene nutzt schon das Scriptable-Widget (siehe `ios-widget.md`).

**Endpunkt:** `POST https://jarvis-os-indol.vercel.app/api/ingest/apple`

> Die Produktions-URL ist `jarvis-os-indol.vercel.app` — die generierte Adresse des
> Projekts `wardogs/jarvis-os`. Die früher hier dokumentierte
> `jarvis-os-wardogs.vercel.app` ist **falsch**: sie zeigt auf ein altes, per Vercel-SSO
> geschütztes Deployment und antwortet mit `401 Protected deployment`, egal welches
> Secret man schickt. Aktuelle URL notfalls mit `vercel projects ls` nachsehen.

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
curl -s -X POST "https://jarvis-os-indol.vercel.app/api/ingest/apple" \
  -H "Authorization: Bearer DEIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"calories": 1840}'
```

`DEIN_SECRET` durch den echten Wert ersetzen — ohne spitze Klammern.

Erwartet: `{"ok":true,"health":1}` — und im Dashboard stehen 1.840 kcal.

**Kein Bypass-Token nötig.** Die Produktions-URL steht nicht unter Vercel-SSO; die
Absicherung macht allein `INGEST_SECRET`. Antworten unterscheiden:

- `{"error":"Unauthorized"}` (JSON, Header `x-matched-path: /api/ingest/apple`)
  → die App hat geantwortet, nur das Secret passt nicht.
- `{"error":{"message":"Protected deployment"}}` oder ein `302` auf `vercel.com/sso-api`
  → du bist auf der **falschen URL**. Die Anfrage erreicht die App gar nicht.

---

## Schritt 3 — Kurzbefehl „Jarvis: Reminders"

> Aktionsnamen unten in **Englisch** — so heißen sie auf Ricos Gerät. Die
> Reihenfolge ist am 2026-09-10 auf dem iPhone durchgebaut und verifiziert.

Shortcuts-App → **+** → oben den Namen antippen → **Rename** → `Jarvis: Reminders`

**1. `Find Reminders`**
- **Add Filter** → das erste Feld der Zeile antippen (steht per Default auf `List`)
  → in der Eigenschaftsliste **`Is Not Completed`** wählen
- **Sort by:** `Deadline`, **Order:** `Oldest First`
- **Limit:** **aus** — sonst kommen nur die ersten 5

> `Is Completed` und `Is Not Completed` sind **zwei getrennte Einträge** in der
> Eigenschaftsliste, kein Ja/Nein-Schalter. `Is Completed` allein filtert genau
> falschherum. Und wer versehentlich zweimal auf `Add Filter` tippt, hat eine
> unfertige `List is [Choose]`-Zeile stehen — die per **⊖** wieder entfernen,
> sonst greift sie zusammen mit `All of the following are true`.

**2. `Repeat with Each`** — Input ist automatisch `Reminders`

**3. `Dictionary`** — per Drag **zwischen** `Repeat with Each` und `End Repeat`
schieben. Die Reihenfolge ist die eine harte Bedingung: Shortcuts sammelt pro
Durchlauf die Ausgabe der **letzten** Aktion in `Repeat Results`. Steht das
Dictionary nicht als letztes vor `End Repeat`, ist die Sammlung leer.

Fünf Mal **Add new item**, Typ jeweils **Text**:

| Key | Value |
|---|---|
| `title` | `Repeat Item` → *Name* |
| `list` | `Repeat Item` → *List* |
| `dueAt` | `Repeat Item` → *Deadline* |
| `notes` | `Repeat Item` → *Notes* |
| `completed` | `Repeat Item` → *Is Completed* (optional, siehe unten) |

**So setzt man eine Property richtig:** ins Value-Feld tippen → Feld **leer**
lassen → in der Variablenleiste über der Tastatur `Repeat Item` wählen → die
eingefügte Variable **nochmal antippen** → Property wählen.

> **Häufigster Fehler.** Tippt man `Name` einfach als Text, sieht das Dictionary
> identisch aus, aber jede Erinnerung bekommt wörtlich `"title": "Name"`.
> Unterscheidungsmerkmal: eine Variable ist ein **blaues Token mit Hintergrund**,
> Text ist flaches Weiß. Im Zweifel den Kurzbefehl laufen lassen und auf die
> Ausgabe schauen — dort steht entweder der echte Titel oder das Wort `Name`.

> `completed` ist eine Absicherung für den Fall, dass der Filter oben doch
> falschherum steht: die Abfrage im Dashboard filtert auf `completed = FALSE`,
> und ein fehlendes Feld gilt als „offen". Ohne beides würden erledigte
> Erinnerungen als offen erscheinen. Mit korrektem Filter ist es entbehrlich.

**4. `Get Contents of URL`** — **unterhalb** von `End Repeat`
- **URL:** `https://jarvis-os-indol.vercel.app/api/ingest/apple`
- **Show More** aufklappen
- **Method:** `POST`
- **Headers** → Add new header: `Authorization` = `Bearer DEIN_SECRET`
- **Request Body:** `JSON` → Add new field → Key `reminders`, Typ **Array**
  → **0 items** antippen → **Add new item** → Typ **Text** → Wert: Variable
  **`Repeat Results`**

Play drücken. Erwartet: `{"ok":true,"reminders":N}` mit N = Anzahl deiner offenen
Erinnerungen. Beim ersten Lauf fragt iOS nach Zugriff auf Erinnerungen.

> **Warum Typ `Text` und nicht `Array` für das Element:** die Auswahl betrifft nur
> das *eine* Element; die Liste bringt die Variable schon mit. Shortcuts
> serialisiert sie dabei je nach Version zu JSON-Text — der Endpunkt erkennt das
> und zerlegt es wieder (siehe *Bekannte Stolperfallen*). Ein zusätzliches Array
> drumherum verschachtelt nur eine Ebene mehr.

---

## Schritt 4 — Kurzbefehl „Jarvis: Kalorien"

Deutlich einfacher als Schritt 3: ein einzelner Zahlenwert, keine Schleife, kein
Dictionary. Genau die Liste-durch-JSON-Maske war dort das ganze Problem.

Shortcuts-App → **+** → **Rename** → `Jarvis: Kalorien`

**1. `Wait`** — **5 Seconds**, als *allererste* Aktion (Begründung unten)

**2. `Find Health Samples`**
- **Type:** `Dietary Energy`
- **Add Filter** → `Start Date` → `is today`
- **Limit:** aus

**3. `Calculate Statistics`**
- **Operation:** `Sum`
- Input steht automatisch auf `Health Samples`

**4. `Get Contents of URL`**
- URL, Method und Header wie in Schritt 3
- **Request Body:** `JSON` → Add new field → Key `calories`, Typ **Number**,
  Wert: Variable **`Statistics`** (blaues Token)

Play. Beim ersten Lauf fragt iOS nach Health-Zugriff. Antwort: `{"ok":true,"health":1}`.

> **Warum das `Wait`:** die Automation feuert, wenn Cronometer *geschlossen* wird —
> Cronometer braucht aber einen Moment, um nach Apple Health zu schreiben. Ohne
> Wartezeit liest der Kurzbefehl unter Umständen den Stand von vorher.
>
> Schlimm ist das nie: `ingest_health_daily` hält **eine Zeile pro Tag**, jeder Lauf
> überschreibt sie komplett. Ein zu früher Lauf ist also nie *falsch*, nur
> kurzzeitig zu niedrig, und wird vom nächsten Lauf geradegezogen. Deshalb braucht
> die Wartezeit nicht exakt zu sein — nur der **letzte Lauf des Tages** muss
> stimmen, und dafür ist die 23:00-Automation da.

> Cronometer schreibt beim Loggen nach Apple Health. Jarvis liest also Health, nicht
> Cronometer — du kannst die App jederzeit wechseln, ohne hier etwas zu ändern.

---

## Schritt 5 — Kurzbefehl „Jarvis: Ziele" (einmal einrichten, selten ändern)

Ohne diesen Schritt stehen Kalorien und Gewicht im Dashboard auf **„Ziel fehlt"** —
der Wert wird angezeigt, aber gegen nichts gemessen. Das ist Absicht: Jarvis denkt
sich kein Kalorienziel aus.

Ziele ändern sich selten, deshalb reicht hier ein Kurzbefehl, den du von Hand
startest, wenn du in Cronometer etwas umstellst.

**1. „Inhalte von URL abrufen"** — URL und Header wie oben, Anfragetext **JSON**:

| Feld | Typ | Wert | Bedeutung |
|---|---|---|---|
| `calorieTarget` | Zahl | dein Kalorienziel, z. B. `2100` | Soll. Basis ist automatisch 10 % darüber. |
| `weightTarget` | Zahl | Zielgewicht, z. B. `75` | |
| `weightTargetDate` | Text | `2027-03-01` | bis wann |
| `weightStart` | Zahl | Startgewicht, z. B. `82` | |
| `weightStartDate` | Text | `2026-09-01` | ab wann |

Antwort: `{"ok":true,"targets":2}`.

> **Warum Start *und* Ziel?** Mit beiden rechnet Jarvis dein Zwischenziel für
> *heute* aus, statt dich ein halbes Jahr lang gegen das Endgewicht zu messen.
> Am 10.09. sind das bei 82 → 75 kg genau 81,7 kg Soll und 83,2 kg Basis.
> Lässt du Start und Zieldatum weg, gilt schlicht das Endgewicht.

Einzelne Felder reichen — nur `calorieTarget` zu schicken ist völlig in Ordnung.

---

## Schritt 6 — Automatisch laufen lassen

Ohne diesen Schritt läuft **nichts** von allein. Ein Kurzbefehl ohne Automation
synchronisiert nur, wenn man Play drückt.

Es gibt in iOS **keinen** Auslöser „Erinnerung wurde erstellt" — die verfügbaren
Trigger sind Zeit, Ort, Alarm, Nachricht/Mail, Geräteeinstellungen und *App
geöffnet/geschlossen*. Der App-Trigger ist deshalb der beste verfügbare Ersatz.

Shortcuts-App → **Automation** → **+**

| Trigger | Kurzbefehl | Zweck |
|---|---|---|
| **App** → Reminders → `Is Closed` | Jarvis: Reminders | Der Hebel. Erinnerung angelegt oder abgehakt, App zu → Sync. |
| **App** → Cronometer → `Is Closed` | Jarvis: Kalorien | Sofortanzeige direkt nach dem Loggen. |
| **Time of Day** → 08:00 täglich | Jarvis: Reminders | Netz für per Siri Angelegtes. |
| **Time of Day** → 23:00 täglich | Jarvis: Kalorien | **Der verbindliche Lauf** — dann ist alles in Health. |

Bei jeder Automation: **Run Immediately** wählen (nicht *Run After Confirmation*)
und **Notify When Run** ausschalten.

`Is Opened` kann man mitnehmen, bringt aber wenig — beim Öffnen ist noch nichts
passiert, was Jarvis nicht schon wüsste.

**Was der App-Trigger nicht abdeckt:** per Siri angelegte Erinnerungen öffnen die
App nie. Dafür sind die Tageszeit-Läufe da. Tageszeit-Automationen sind zudem
nicht sekundengenau — iOS verschiebt sie um einige Minuten.

**Von Hand auslösen**, wenn es schnell gehen muss: den Kurzbefehl auf **Auf
Rückseite tippen** legen (Einstellungen → Bedienungshilfen → Tippen → Auf
Rückseite tippen → Doppeltippen). Alternativ auf den Sperrbildschirm oder ins
Kontrollzentrum.

---

## Etwas nachträglich korrigieren

Zwei Wege, je nachdem wo der Fehler sitzt:

- **In Cronometer / Health korrigieren.** Beide lassen alte Einträge bearbeiten.
  Beim nächsten Sync überschreibt Jarvis seine Kopie des Tages — die Korrektur
  kommt also von selbst an. Das ist der saubere Weg, weil Apple die Wahrheit bleibt.
- **Direkt in Jarvis eintragen.** Im Reiter *Verlauf* den Tag wählen und die
  Kalorien ins Feld schreiben. Dieser Wert **schlägt danach jeden Sync**, damit
  ihn der nächste Lauf nicht stillschweigend überschreibt. Der Tag ist dann als
  „von Hand" markiert; ein Klick auf *zurücksetzen* gibt ihn wieder an Health ab.

---

## Was Jarvis mit den Daten macht

| Quelle | Landet in | Zeigt sich als |
|---|---|---|
| Erinnerungen | `ingest_reminders` (wird bei jedem Lauf komplett ersetzt) | Aufgaben-Karte, linke Spalte |
| Nahrungsenergie | `ingest_health_daily` (pro Tag überschrieben) | Kalorien-Karte, Health-Reiter |
| Kalorien-/Gewichtsziel | `ingest_health_targets` (je Metrik eine Zeile) | Soll und Basis unter dem Wert |

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
| `{"error":"Unauthorized"}` | `INGEST_SECRET` fehlt in Vercel oder weicht vom Kurzbefehl ab |
| `Protected deployment` / `302` auf `vercel.com/sso-api` | Falsche URL — `jarvis-os-indol.vercel.app` benutzen, nicht `jarvis-os-wardogs` |
| `400 Nichts erkannt` | Anfragetext ist nicht JSON, oder das Feld heißt anders als `reminders` / `health` / `calories` / `targets` |
| Kalorien oder Gewicht zeigen „Ziel fehlt" | Schritt 5 fehlt — das Ziel ist nie angekommen. Jarvis erfindet bewusst keins. |
| `{"ok":true,"reminders":0}` | Der Filter in „Erinnerungen finden" trifft nichts — Filter im Kurzbefehl prüfen |
| Karte bleibt leer, obwohl `ok:true` | Alle gelieferten Erinnerungen waren erledigt oder liegen in der Zukunft |

Der Endpunkt ist absichtlich nachsichtig: Zahlen dürfen als Text kommen (`"1.840 kcal"`
wird verstanden), `completed` akzeptiert `true` / `1` / `"ja"`, und statt einer
Objektliste tut es zur Not auch eine reine Titel-Liste als Text.

---

## Bekannte Stolperfallen

Alle vier sind beim Erst-Setup am 2026-09-10 tatsächlich aufgetreten und haben
zusammen den Großteil der Zeit gekostet.

**1. Falsche Produktions-URL.** Kostet am meisten Zeit, weil die Fehlermeldung in
die Irre führt: `401 Protected deployment` sieht nach einem Secret-Problem aus, ist
aber ein Adressproblem. Merksatz: `{"error":"Unauthorized"}` = *die App hat
geantwortet*, `Protected deployment` / `302` = *die Anfrage kam nie an*.

**2. Getippter Text statt Variable im Dictionary.** Sieht identisch aus, liefert
`{"title":"Name","list":"List"}` für jede Erinnerung. Erkennungsmerkmal: blaues
Token mit Hintergrund = Variable, flaches Weiß = Text.

**3. Shortcuts serialisiert die Objektliste zu JSON-Text.** Legt man `Repeat
Results` in ein JSON-Feld, macht Apples Maske je nach Version daraus `[{…}]`,
`[[{…}]]` **oder** `"{…}\n{…}"`. Im letzten Fall stand vorher genau *eine*
Erinnerung in der Karte, deren Titel der rohe JSON-Text war. Gelöst in
`parseReminders` (`expandRaw` + `extractJsonObjects`): der Text wird per
Klammerzählung zerlegt — nicht per `JSON.parse` aufs Ganze (mehrere Objekte
hintereinander) und nicht per Zeilen-Split (Shortcuts druckt mehrzeilig
eingerückt). Alle drei Formen funktionieren jetzt.
**Lehre: nicht gegen Apples Serialisierung kämpfen, den Endpunkt nachsichtig machen.**

**4. `Limit` steht nach dem Anlegen gern auf 5.** Fällt nicht auf, solange man
weniger als fünf offene Erinnerungen hat.
