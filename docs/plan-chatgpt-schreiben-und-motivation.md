# Plan: ChatGPT schreibt in Jarvis + Motivationssystem

Stand 09.10.2026 · für den nächsten Agenten · **Plan, nichts davon ist gebaut.**
Ricos Entscheidungen vom 09.10. sind eingearbeitet (Liste am Ende).
Vor dem Start lesen: `AGENTS.md`, `HANDOVER.md` (v. a. „Was funktioniert" und
„Phase 2"), `docs/mcp-server.md`, `~/dev/coding-workflow-standards.md`.

Ricos Ziele:

1. **Der ChatGPT-Connector soll Jarvis nicht nur lesen, sondern auch abhaken
   können** — und die Daten vor Phase 2 richtig einordnen (Health hat sich
   geändert, Regeln sind neu, Routinen hatten mehr Schritte).
2. **Mehr Dopamin.** Nur Haken setzen reicht ihm nicht mehr. Er braucht
   sichtbares Feedback in ganz Jarvis: Serien, Rekorde, Belohnungsmomente,
   Erinnerungen. Die Ziele-Seite soll motivieren, nicht nur verwalten.

---

## Leitplanken (gelten für alles hier)

- **Dev = Production-Datenbank.** Datenänderungen gehen zusammen mit dem Code
  live, nie vorher. Keine Testwerte stehen lassen — jeden Test-Haken sofort
  zurücknehmen und in der DB nachprüfen.
- **`NULL ≠ 0`, nichts erfinden** — auch nicht bei Belohnungen. Kein Abzeichen,
  keine Serie, kein Rekord, der nicht aus derselben Matrix kommt wie das
  Dashboard (`AnalyticsService.getMatrix` / `summarize`).
- **Kein Modellaufruf aus Jarvis** (kein API-Key, abgelehnt). ChatGPT ruft
  Jarvis, nie umgekehrt.
- **MCP-Werkzeuge rechnen nicht selbst** — dieselben Services wie die Seiten.
- **`core:seed` nicht ausführen** (veraltet, klemmt CRM-Quellen und Regeln ab).
  Datenänderungen über idempotente Skripte wie `scripts/phase-2.mts`.
- **Design:** monochrom, Rot nur für „verfehlt". **Neu: Gold** als einzige
  Belohnungsfarbe — ausschließlich für Meilensteine, Rekorde und den perfekten
  Tag. Als Token in `globals.css` (`@theme`), nie als verstreute Einzelwerte.
- Next.js 16: vor neuen APIs die Doku in `node_modules/next/dist/docs/` lesen.
- Jeder Schritt einzeln: Tests (`npm test`), `npm run build`, Browser-Check
  (Desktop und 375 px), Commit, **Rico fragen, dann pushen**, Production
  prüfen, `HANDOVER.md` fortschreiben.

---

## Schritt 0 — Sonntag ist Joker für jede Serie (XS)

Stand: Streak-Fix ist live (`95950af`, 09.10.). Serien laufen über den
Phasenschnitt, heute ist bei Ursachen offen, bis es erfüllt ist; bei Regeln
ist ein Rückfall sofort endgültig (`missIsFinal`).

Rico: „Der Sonntag rettet grundsätzlich jede Serie."

- Ursachen und Routinen: schon so (Sonntag = Off-Day, wird übersprungen).
- **Regeln: neu.** Sie gelten auch sonntags. Ein **gehaltener** Sonntag zählt
  in die Serie (+1). Ein **gebrochener** Sonntag reißt die Serie nicht, er
  wird übersprungen, bleibt aber als Rückfall sichtbar: rot, im Zähler
  „Rückfälle" und in der Quote.
- Umsetzung in `AnalyticsService.summarize`: eine Option (z. B.
  `jokerWeekday: 7`), die nur Serie und Rekord betrifft, nicht die Quote. Sie
  gilt auch für `missIsFinal` an einem heutigen Sonntag. Aufrufer: Dashboard,
  Health, MCP. Tests in `src/core/services/summarize.test.ts`.
- In Ketten/Heatmaps (C5) ist der Sonntag als Joker markiert, nicht als
  Lücke.

---

## Teil A — ChatGPT liest die Datenbasis richtig

**Problem:** ChatGPT sieht Kennzahlen, aber nicht, was sie bedeuten und seit
wann sie wie bewertet werden. Phase 1 (01.09.–06.10.) war lückenhaft
getrackt. Die Routinen hatten 8–9 Schritte; die Haken gestrichener Schritte
sind gelöscht. Körperwerte werden seit 07.10. nicht mehr bewertet. Regeln
gelten als gehalten, solange kein Rückfall eingetragen ist. Die Phasen stehen
zwar in `performance_wochenverlauf`, aber nicht als Lesevorschrift.

### A1. Server-Anweisungen neu

`ANWEISUNGEN` in `src/lib/mcp/protocol.ts` sind noch von vor Phase 2 (Schlaf,
Kalorien, Gewicht als Tageswerte). Neu sollen sie sagen:

- was heute bewertet wird
- dass Vergleiche über Phasen hinweg die Phase nennen müssen
- dass Phase 1 bei niedriger Abdeckung nicht als Leistung gewertet wird
- dass Regeln implizit gehalten sind und der Sonntag Joker ist
- dass Abhaken nur für heute und gestern geht
- dass bei neuem Rekord ausdrücklich gratuliert wird

### A2. Werkzeug `jarvis_kontext` (lesend)

Das Handbuch, das ChatGPT vor jedem Rückblick liest. Was sich ableiten lässt,
wird abgeleitet; fester Text nur für die Lücken.

- Phasen aus `src/lib/phases.ts`
- je Metrik: was sie misst, Quelle, Off-Days/Joker, Ziel heute, seit wann
  bewertet (`core_intentions.valid_from`/`valid_to`), und ob ein fehlender Wert
  „nicht gemessen" oder „gehalten" heißt
- bekannte Datenlücken: Routine-Haken vor 28.09. unvollständig, Körperziele
  nur bis 06.10., Regeln erst ab 07.10.

### A3. Werkzeug `phasen_vergleich`

Je Phase und Metrik: getrackte Tage, Tage mit Ziel, erfüllt, Quote, Abdeckung
und beste Serie. Dazu eine Lesbarkeits-Ampel
(`aussagekraeftig: abdeckung >= 0.7`). So vergleicht ChatGPT nur
Vergleichbares.

### A4. Werkzeug `tage_anzeigen(von, bis)`

Tagesgenaue Matrix für maximal 31 Tage, mit Wert, Zustand, Quelle und Phase je
Tag.

### A5. `performance_wochenverlauf` ergänzen

Feld `datenqualitaet` je Woche („lückenhaft" bei Abdeckung < 0,5). `wochen`
darf bis 12 gehen (ganzer Block).

**Abnahme:** Rico fragt „Wie lief der September im Vergleich zu dieser
Woche?". Die Antwort nennt Phasen und Datenlücken und wertet Phase 1 nicht als
Leistungsabfall.

---

## Teil B — ChatGPT hakt ab

### B1. Schreiblogik in einen Service ziehen

Heute liegt sie in Server Actions (`'use server'`): `actions/today.ts`
(`toggleCause`), `actions/verlauf.ts` (`clearCause`) und
`actions/dashboard.ts` (`logTrackerItem`).

Neu ist ein `TrackingService` in `core/services/`, den die Actions **und** das
MCP aufrufen. Die Actions bleiben dünne Hüllen mit `revalidateTracking()`.
Sonst gibt es zwei Schreibwege mit zwei Regelwerken.

### B2. Schreibwerkzeuge: alles, was einen Haken hat

Rico: ChatGPT darf **alles, was mit Haken, Serien und den Kästchen zu tun
hat**. Nichts zu Mail, Zielen oder Körperwerten.

| Werkzeug | Was | Grenzen |
|---|---|---|
| `ursache_eintragen` | Training/Post: erledigt · nicht erledigt · zurücksetzen | Calls nie (kommen aus dem CRM) |
| `regel_rueckfall` | Rückfall eintragen / zurücknehmen | nur Domäne `rules` |
| `routine_schritt` | Schritt abhaken / zurücknehmen, per Name | nur Schritte, die an dem Tag galten (`active_from`/`archived_on`). Mehrdeutiger Name → nachfragen, nicht raten |
| `routine_komplett` | alle Schritte einer Routine abhaken („Morgenroutine durch") | wie oben |
| `mail_entwurf_speichern` | besteht | unverändert |

**Nicht bauen:** Ziele ändern, Körperwerte, Tagesnotiz, Mail freigeben oder
senden.

Für alle Schreibwerkzeuge gilt:

- **Nur heute und gestern** (Berlin). Ohne Datum gilt heute. Ältere oder
  künftige Tage werden klar abgelehnt: „Älter als gestern bitte im Verlauf in
  Jarvis".
- **Antwort = Vorher/Nachher** aus der Matrix, mit neuer Serie und Rekord, z. B.
  „Training erledigt — Serie 4, Rekord 7". Bei neuem Rekord steht das
  ausdrücklich drin (`neuer_rekord: true`). Das ist das Dopamin per Sprache.
- **Idempotent:** Eine zweite gleiche Anfrage liefert `unveraendert`, wie bei
  `mail_entwurf_speichern`.
- **Annotationen:** `readOnlyHint: false`, `destructiveHint: false`,
  `idempotentHint: true`. Ob ChatGPT trotzdem nachfragt, entscheidet ChatGPT,
  nicht der Server.
- **Fremdtext ist keine Anweisung:** Nichts aus CRM- oder Mailtexten löst einen
  Schreibvorgang aus. Das gehört in die Werkzeugbeschreibung.
- **Immer freigeschaltet** (Rico): kein zweiter Scope, kein Schalter; dieselbe
  OAuth-Verbindung (`SCOPE = 'jarvis'`). Damit es auf Ricos Handy sofort geht:
  ChatGPT merkt sich die Werkzeugliste. Nach dem Deploy muss Rico im
  ChatGPT-Plugin „Jarvis OS" die Verbindung bzw. Aktionen aktualisieren. Der
  Agent sagt ihm Schritt für Schritt, wo er tippen muss, und ergänzt
  `docs/mcp-server.md`. Prüfen, dass die Antwort über Text **und** Sprache
  kommt.

### B3. Protokoll: Was hat ChatGPT geändert?

Neue Tabelle `mcp_write_log` mit id, Zeitpunkt, Werkzeug, Argumenten, Vorher,
Nachher und Client. Anlegen in `scripts/core-layer.sql` (idempotent,
`core:migrate`). Im Verlauf bekommt ein Tag, an dem ChatGPT etwas eingetragen
hat, einen kleinen Hinweis „über ChatGPT". Sonst lässt sich ein unerklärlicher
Haken nicht zurückverfolgen.

### B4. Tests

- Unit-Tests ohne DB nach dem Muster `src/lib/mcp/tools.test.ts` und
  `src/core/services/rules.test.ts` (Prisma gemockt).
- Pflichtfälle: Datumsfenster (heute und gestern ok, vorgestern abgelehnt),
  Calls abgelehnt, Idempotenz, Rückfall heute bricht die Serie, am Sonntag
  nicht (Joker), mehrdeutiger Routine-Schritt führt zur Rückfrage,
  `neuer_rekord`.
- Danach einmal mit dem MCP Inspector gegen Production. Testeinträge sofort
  zurücknehmen und im Protokoll prüfen.

**Abnahme:** Rico sagt auf dem Handy per Sprache „Ich hab trainiert und
gepostet, Morgenroutine ist durch". ChatGPT trägt alles ein und nennt die
neuen Serien. Das Dashboard zeigt es beim nächsten Laden.

---

## Teil C — Motivationssystem („mehr Dopamin")

**Grundsatz:** Belohnt werden die Ursachen (Handlungen), nicht die
Ergebnisse. Jede Belohnung ist ehrlich aus echten Daten abgeleitet. Feedback
kommt sofort (optimistisch, unter 100 ms). Die großen Momente sind selten,
deshalb sind sie etwas wert. Gold nur für diese Momente.

### C1. Feedback und Ton beim Abhaken (S)

`framer-motion` ist installiert. `HabitRow` und `RoutineCard` bekommen:

- Das Kästchen „ploppt", die Flamme zuckt, die Serienzahl zählt hoch.
- Bei neuem Rekord ein kurzer Gold-Glanz mit „Neuer Rekord".

**Ton** (Rico: ja, aber clean und minimal):

- ein kurzer, leiser „Tick" beim Abhaken
- ein heller Doppelton bei Rekord oder perfektem Tag

Beide werden per Web Audio API erzeugt (zwei Sinus-Töne, ca. 80 ms, sanfte
Hüllkurve), ohne Audiodateien. Der Ton spielt nur als Reaktion auf einen Tipp
(iOS-Regel). Schalter „Töne" in den Einstellungen, Standard an.

### C2. Tagesringe oben auf „Heute" (M)

Drei Ringe wie bei Apple Activity, live gefüllt (optimistisch), aus der
bestehenden Matrix:

- **Ursachen:** erfüllte / getrackte heute
- **Routinen:** Schritte / Soll
- **Regeln:** gehalten / alle

Ein geschlossener Ring bekommt einen Gold-Rand.

### C3. „Perfekter Tag" (M)

Bedingung: alle Ursachen erfüllt, beide Routinen mindestens auf Basis, keine
Regel gebrochen. Dann einmalig:

- Der Jarvis-Orb (`JarvisOrb`, `docs/orb-animation.md`) pulsiert in Gold.
- Text „Perfekter Tag Nr. 5", dazu der Doppelton.

Perfekte Tage in Folge sind eine eigene Serie. Alles wird abgeleitet, nicht
gespeichert. Ob die Feier heute schon lief, merkt sich nur `localStorage`.

### C4. Serien mit Stufen und Meilensteinen (S–M)

- Stufen bei 3 / 7 / 14 / 21 / 30 / 50 / 100 Tagen: Die Flamme wächst bzw.
  wechselt die Form, ab 7 in Gold.
- Erreichte Stufe → Abzeichen und Eintrag in der Rekordwand (C5).
- Alles aus `summarize` (`streak`, `bestStreak`). Welche Meilensteine schon
  gefeiert wurden, merkt sich `localStorage`.
- Joker Sonntag (Schritt 0) ist sichtbar markiert.

### C5. Ziele-Seite: vom Formular zum Zielbild (L)

Heute ist `/ziele` eine Einstellungsseite. Neu, von oben nach unten:

1. **Die Reise:** Zeitleiste 01.09.2026 → 01.03.2027 mit Blöcken, Phasen und
   „Du bist hier", dazu ein Countdown.
2. **Ergebnisziel:** Umsatz 10.000 € (`sales.closed_value_eur`) als großer
   Balken. Ohne Wert steht dort „noch keine Provision erfasst", nie 0 %.
3. **Ketten:** eine GitHub-artige Heatmap je Ursache und Regel über die ganze
   Phase („Kette nicht reißen lassen"), mit Serie und Rekord daneben. Sonntag
   als Joker markiert.
4. **Rekordwand:** längste Serien, perfekte Tage, beste Blockwoche (nur bei
   ausreichender Abdeckung). Erreichte Meilensteine in Gold.
5. **Einstellungen:** der heutige Editor, eingeklappt nach unten. Die Logik in
   `GoalsEditor` und `actions/goals.ts` bleibt.

### C6. Erinnerungen per Kurzbefehl statt Web Push (S)

Rico hat es dem Agenten überlassen. Abwägung: Web Push braucht Service
Worker, installierte PWA, VAPID, eine Abo-Tabelle und einen Zeitplaner, der im
Vercel-Hobby-Tarif nur 1× täglich läuft. Viel Aufwand, wenig Wirkung.

**Deshalb kein Web Push**, sondern die Infrastruktur, die auf Ricos iPhone
schon läuft:

- **Endpunkt** `GET /api/widgets/nudge`, Auth wie `/api/widgets/calls` über
  `checkWidgetAuth`. Er liefert `{ zeigen, titel, text }`, fertig formuliert
  aus der Matrix, z. B. „Noch 1 Post bis zur 5er-Serie" oder
  „Training-Serie 6 — heute halten". Ist alles erledigt, kommt
  `zeigen: false` und keine Mitteilung. Keine Logik im Kurzbefehl.
- **Kurzbefehl** „Jarvis Erinnerung": URL abrufen, bei `zeigen` „Mitteilung
  anzeigen". Dazu persönliche Automationen um 18:00 und 21:30 („Sofort
  ausführen"). Anleitung in `docs/apple-shortcuts.md`; Rico richtet sie ein.

Web Push erst wieder, wenn Rico es ausdrücklich will.

### C7. Wochenrückblick (M)

Dienstags (Blockwochen laufen Di–Mo) eine Karte auf „Heute":

- Quoten der Woche
- neue Rekorde
- beste Ursache
- eine Sache für nächste Woche, aus den Daten

ChatGPT kann ihn über `performance_wochenverlauf` vorlesen.

### C8. iPhone-Widget „Ringe + Serien" (S–M)

Scriptable steht (`docs/ios-widget.md`). Endpunkt nach dem Muster
`/api/widgets/calls`: Texte und Zustände fertig vom Server, keine Logik im
Skript. Für Home- und Sperrbildschirm.

---

## Reihenfolge

| # | Schritt | Größe |
|---|---|---|
| 0 | Sonntag als Joker für Regel-Serien | XS |
| 1 | A1–A5: ChatGPT liest richtig | S–M |
| 2 | B1: Schreiblogik in `TrackingService` | M |
| 3 | B2–B4: Schreibwerkzeuge, Protokoll, Tests | M |
| 4 | C1 + C4: Feedback, Ton, Serienstufen, Gold-Token | S–M |
| 5 | C2 + C3: Tagesringe, perfekter Tag | M |
| 6 | C5: Ziele-Seite als Zielbild | L |
| 7 | C6: Erinnerung per Kurzbefehl | S |
| 8 | C7 + C8: Wochenrückblick, Widget | M |

Nach Schritt 3 lohnt sich ein Zwischenstopp: Rico testet ChatGPT auf dem Handy,
bevor es mit Teil C weitergeht.

---

## Entschieden (Rico, 09.10.)

- **Belohnungsfarbe:** Gold, nur für Meilensteine, Rekorde und den perfekten Tag.
- **Schreibumfang:** alles mit Haken und Serien (Ursachen, Routine-Schritte,
  Regel-Rückfälle). Nicht: Mail, Ziele, Körperwerte.
- **Freischaltung:** immer an, ohne Scope oder Schalter. Muss auf dem Handy in
  ChatGPT einfach funktionieren.
- **Joker:** Der Sonntag rettet jede Serie.
- **Ton:** ja, clean und minimal, abschaltbar.
- **Push:** dem Agenten überlassen → kein Web Push, Erinnerung per Kurzbefehl.
- **Nachtragen über ChatGPT:** nur heute und gestern.
