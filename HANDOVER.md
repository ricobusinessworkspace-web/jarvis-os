---
last_updated: 2026-09-10
last_agent: Claude Opus 5 — Abgeleitete Ziele, Shell aufgeräumt
status: In Progress
---

> **SSOT-Regel:** Dieses Dokument ist die Wahrheit über den *Stand* — was fertig
> ist, was kaputt war, was offen ist. Es wird nach jeder Prompt fortgeschrieben
> (nur Deltas, schlank halten). Schritt-für-Schritt-Anleitungen für einzelne
> Integrationen gehören **nicht** hierher, sondern nach `docs/`.

## Projekt-Snapshot

**Was ist das Projekt?**
Persönliches Operating System für Rico. Kern ist ein Command Center, das den
6-Monats-Plan gegen echte Daten hält — nach dem Prinzip *Ursachen vor Wirkungen*:
die tägliche Handlung (Calls, Training, Post) ist die Stellschraube, Umsatz und
Pipeline sind nur Folgen.

**Aktueller Stand:**
- **Semantic Layer** (`core_*`-Tabellen): fertig, im Einsatz. Metriken, Quellen,
  Soll-Werte und Ziele liegen in der Datenbank, nicht im Code.
- **Dashboard „Heute"**: fertig. Calls, Körper-Schnelleingabe, Ursachen, Routine,
  Aufgaben, Monatsverlauf. Rico trackt seit dem 08.09. damit.
- **Reiter Verlauf / Vertrieb / Health**: fertig. Verlauf erlaubt Nachtragen und
  Korrigieren beliebiger Tage.
- **Routinen bearbeitbar**: fertig — umbenennen, verschieben, löschen, ergänzen
  und **Pflichtschritte markieren**. Die Pflichtschritte bilden die Basis der
  Routine-Metrik. **Offen: Rico hat noch keine markiert**, beide Routinen stehen
  deshalb korrekt auf „Ziel fehlt — kein Pflichtschritt markiert".
- **Abgeleitete Ziele**: fertig. Eine Intention ist jetzt *entweder* eine feste
  Zahl *oder* eine Ableitung (`routine_completeness`, `health_target`,
  `weight_trajectory`). Schlaf hat ein festes Ziel bekommen (Basis 6 h, Soll 8 h).
  **Offen: Kalorien- und Gewichtsziel muss Rico einmal aus Cronometer schicken**
  (`docs/apple-shortcuts.md` Schritt 5), bis dahin „Ziel fehlt".
- **Korrektur von Hand**: fertig. Kalorien sind auf „Heute" und im Verlauf
  eintragbar; der Handwert schlägt jeden Sync, ist als „von Hand" markiert und
  per Knopf zurücksetzbar.
- **Shell aufgeräumt**: Content-Kanban, tote Suchleiste, Glocke ohne
  Ereignisquelle und KI-Export-Button sind raus. ⌘K öffnet stattdessen eine
  echte Befehlspalette. Der Zustand-Store ist damit vollständig entfallen —
  das Dashboard-Layout macht jetzt **keine** Datenbankabfrage mehr.
- **Apple-Anbindung** (Erinnerungen + Health-Kalorien): Endpunkt live und gegen
  Production verifiziert. `INGEST_SECRET` ist in Vercel Production gesetzt.
  Kurzbefehl „Jarvis: Reminders" steht auf Ricos iPhone und **liefert bereits**
  (Find Reminders → Repeat → Dictionary → POST). **Offen:**
  (a) `parseReminders` im Working Tree ist **noch nicht deployed** — bis dahin
  zeigt die Aufgaben-Karte eine einzige Erinnerung mit JSON-Text als Titel;
  (b) Kurzbefehl „Jarvis: Kalorien" (Schritt 4) und die Automationen (Schritt 6).
  Testdaten: 1.840 kcal auf dem 2026-09-10, werden beim ersten echten Sync
  überschrieben.
- **G-Projekt (Punktesystem)**: bewusst nicht angebunden, `g_*`-Tabellen sind leer.
- **Performance**: von 3,4 s auf ~1,1 s Seitenaufruf. Hauptursache liegt aber
  außerhalb des Codes, siehe `DATENBANK_BRIEFING.md`.

## Was funktioniert (behalte das)

- **`NULL ≠ 0`.** Fehlender Eintrag heißt „nicht gemessen", nie null. Jede Metrik
  trägt einen Zustand (`soll` · `basis` · `unter` · `erfasst` · `zielfehlt` ·
  `ungemessen` · `offday`), nicht nur eine Zahl. Ohne diese Trennung ist ein
  vergessener Log-Tag nicht von einem schlechten Tag zu unterscheiden.
- **`erfasst` ≠ `zielfehlt`.** `erfasst` heißt „gemessen, bewusst ohne Ziel".
  `zielfehlt` heißt „Wert da, Maß fehlt" — ein Ziel *ist* konfiguriert, ließ sich
  aber nicht auflösen (Cronometer-Ziel nie angekommen, kein Pflichtschritt
  markiert). Beides gleich zu zeigen würde einen kaputten Anschluss wie eine
  Design-Entscheidung aussehen lassen. Die UI nennt bei `zielfehlt` immer den
  Grund (`DayMetric.targetHint`).
- **Ziele dürfen abgeleitet sein.** `core_intentions` trägt entweder
  `base_value` (fest, aus Plan/CRM/Einstellungen) oder `derived_kind` (aus einer
  Verbindung, on-read gerechnet). Fällt eine Ableitung aus, wird **nichts
  geraten** — dieselbe Regel wie bei Werten, nur für die Zielseite.
- **Routinen zählen nicht, sie prüfen.** „4 von 6" sagt nichts darüber, ob die
  *richtigen* vier erledigt sind. Basis = alle Pflichtschritte, Soll = alle
  Schritte; beides wandert mit, wenn Rico die Routine umbaut.
- **Beschriftungen kommen aus den Daten.** `targetSub()` bildet „Basis 30 · Soll
  60" aus der Matrix. Vorher stand der Text zweimal fest in den Seiten und wäre
  beim nächsten Zielwechsel im CRM still falsch geworden.
- **Quellen-Schicht `core_metric_sources`.** Pro Metrik eine nach `priority`
  geordnete Quellenliste, erster Treffer gewinnt. Ein neues System anzubinden ist
  eine Zeile in der Tabelle, kein neuer Code-Pfad.
- **Keine erfundenen Zahlen.** Kein Platzhalter-Ziel, kein 0 % für ein Ziel, das
  nicht existiert. Das Umsatzziel steht bewusst auf `pending`.
- **Ziele kommen aus der Quelle, die sie besitzt.** Das Call-Ziel liest Jarvis aus
  `user_profiles.daily_call_goal` im CRM (60), die Basis 30 stammt aus dem Plan.
- **`useOptimistic`** für alle Klick- und Eingabe-Rückmeldungen.
- **Metrik-Zustände sind monochrom** (Apple-minimal). Erfüllungsgrad ist eine
  Helligkeitsrampe auf `foreground` (`soll` = weiß → `basis` = 40 % → `erfasst` =
  16 % → `offday` = 3 %), `ungemessen` nur ein dünner Rahmen. Einzige Farbe im
  System: `error`-Rot für `unter` — ein verpasster Tag ist das Einzige, das
  auffallen soll. `zielfehlt` bekommt bewusst **keine** eigene Farbe, sondern
  Füllung plus gestrichelten Rand: sonst hieße ein kaputter Anschluss dasselbe
  wie ein schlechter Tag. Zentral in `src/lib/metricState.ts`; `today`-Zelle
  behält den blauen Akzent-Ring als reine Ortsmarke. Morgen/Abend unterscheiden
  sich seither durchs Symbol (Sonne/Mond), nicht durch Farbe.
- **`npm run core:check`** rechnet alles gegen echte Daten nach — bestes Werkzeug
  bei jedem Datenzweifel.

## Gelöste Probleme (nicht wiederholen)

- **Problem:** Der Kurzbefehl baute sichtbar korrekte Objekte, in der Aufgaben-Karte
  stand aber **eine** Erinnerung mit `{"dueAt":"","title":"…","list":"WICHTIG",…}`
  als Titel.
  **Lösung:** `parseReminders` normalisiert die Nutzlast jetzt über `expandRaw()` +
  `extractJsonObjects()` ([route.ts](src/app/api/ingest/apple/route.ts)).
  **Warum wichtig:** Apples JSON-Body-Maske liefert je nach Feldtyp **drei**
  verschiedene Formen für dieselbe Konfiguration — `[{…}]` (Array-Feld),
  `[[{…}]]` (Listen-Variable in Array-Feld) und `"{…}\n{…}"` (Listen-Variable in
  Text-Feld, Objekte zu Text serialisiert). Welche man bekommt, sieht man dem
  Kurzbefehl nicht an. Deshalb wird der Text per Klammerzählung zerlegt, nicht per
  `JSON.parse` aufs Ganze (mehrere Objekte hintereinander) und nicht per
  Zeilen-Split (Shortcuts druckt mehrzeilig eingerückt); Anführungszeichen werden
  übersprungen, damit eine Klammer im Titel nicht mitzählt. Reine Titelzeilen
  bleiben gültig. Sieben Fälle durchgerechnet, inklusive `Fix {foo} bug`.
  Merksatz: **an der Kurzbefehl-Oberfläche nicht gegen Apples Serialisierung
  kämpfen — den Endpunkt nachsichtig machen.**

- **Problem:** Apple-Ingest antwortete hartnäckig `401 "Protected deployment"`, egal
  welches Secret. Stunden im Vercel-Dashboard nach dem SSO-Schalter gesucht.
  **Lösung:** Die URL in der Doku war falsch. Produktion ist
  `jarvis-os-indol.vercel.app`, nicht `jarvis-os-wardogs.vercel.app` — letztere zeigt
  auf ein altes, SSO-geschütztes Deployment. Mit der richtigen URL sofort
  `{"ok":true,"health":1}`, ganz ohne Bypass-Token und ohne Änderung an der
  Deployment Protection.
  **Warum wichtig:** Zwei verschiedene 401 unterscheiden lernen. `{"error":"Unauthorized"}`
  mit Header `x-matched-path` = **die App hat geantwortet**, nur das Secret stimmt nicht.
  `{"error":{"message":"Protected deployment"}}` oder ein `302` auf `vercel.com/sso-api`
  = die Anfrage kam nie an, also stimmt die **Adresse** nicht. Bei jedem neuen
  Endpunkt zuerst `vercel projects ls` und die echte Production-URL prüfen.
  **Noch offen:** dieselbe falsche URL steht in `docs/ios-widget.md` (Zeile 71/73)
  und — kritischer — in `src/app/api/auth/google/route.ts:28` und
  `callback/route.ts:29` als OAuth-Redirect. Dort **nicht blind ändern**: die URL
  muss mit dem übereinstimmen, was in der Google Cloud Console registriert ist.

- **Problem:** Jeder Klick hing sekundenlang.
  **Lösung:** `revalidatePath('/', 'layout')` durch `revalidateTracking()` ersetzt.
  **Warum wichtig:** `'layout'` verwirft das Dashboard-Layout, dessen Datenfunktion
  dann bei jedem Häkchen erneut lief — rund 20 Abfragen pro Klick.

- **Problem:** Haken wurde gesetzt und sprang sofort wieder zurück.
  **Lösung:** `useOptimistic` statt eigenem State.
  **Warum wichtig:** Eigener State, der nach der Server-Action gelöscht wird, fällt
  auf die noch alten Props zurück. Gespeichert war immer korrekt, nur die Anzeige log.

- **Problem:** Zwei Prisma-Clients (`core/db.ts` und `lib/prisma.ts`).
  **Lösung:** `core/db.ts` reicht `lib/prisma.ts` durch.
  **Warum wichtig:** Zwei Clients = zwei Pools, die sich die eine erlaubte
  Verbindung wegnahmen.

- **Problem:** `Promise.all` für Datenbankabfragen.
  **Lösung:** Sequenziell oder `$transaction([...])`.
  **Warum wichtig:** Gemessen — 6 Abfragen parallel 1020 ms, sequenziell 943 ms,
  gebündelt 495 ms. Bei `connection_limit=1` ist parallel am langsamsten.

- **Problem:** Sehr lange Ladezeit beim Start.
  **Lösung:** `EcosystemLoader` entfernt.
  **Warum wichtig:** Ein schwarzer Vollbild-Layer (zIndex 99999), der erst nach
  vollständiger Hydration verschwand. Der Inhalt war längst da und wurde verdeckt.

- **Problem:** Sales-Widgets meldeten dauerhaft 0 Calls.
  **Lösung:** Quelle von `crm_events` auf `crm_calls` umgestellt.
  **Warum wichtig:** `crm_events` ist leer und war jahrelang die falsche Tabelle.

- **Problem:** Schlaf wurde als „0 Stunden" statt „nicht ausgefüllt" gewertet.
  **Lösung:** Quelle filtert 0 heraus (`zeroIsNull`).
  **Warum wichtig:** `jarvis_personal_logs` legt Tageszeilen mit Default 0 an.

- **Problem:** Datenbank-Passwort lag im Klartext in fünf Skripten, Repository ist
  öffentlich.
  **Lösung:** Skripte entfernt. **Rotation steht noch aus** — siehe Action Items.
  **Warum wichtig:** Löschen entfernt nichts aus der Git-Historie.

- **Problem:** Routine umbenennen hätte die Metrik still von Quelle und Ziel
  getrennt.
  **Lösung:** `renameRoutine` zieht `core_metric_sources.config.tracker` und
  `core_intentions.derived_config.tracker` mit um.
  **Warum wichtig:** Beide verweisen über den **Namen** auf die Routine. Ohne das
  Mitziehen wäre die Metrik nach einem Umbenennen leer gewesen — ohne Fehler,
  ohne Hinweis.

- **Problem:** Nach `prisma generate` warf jede Seite
  „Cannot read properties of undefined (reading 'findMany')".
  **Lösung:** Dev-Server neu starten.
  **Warum wichtig:** Der laufende Next-Prozess hält den alten generierten Client.
  Neue Modelle existieren erst nach einem Neustart, nicht durch Fast Refresh.

- **Problem:** Seiten kamen im Browser leer an, obwohl der Server 200 und
  vollständiges HTML lieferte.
  **Lösung:** Service Worker abmelden und Caches leeren.
  **Warum wichtig:** Ein Service Worker des **Lightning-CRM** (Cache
  `lightning-crm-cache-v3`) war noch auf `localhost:3000` registriert und fing
  Jarvis' Anfragen ab. Beide Projekte teilen sich im Dev denselben Port und damit
  denselben Origin. Bei „Seite leer, Server aber ok" zuerst dort nachsehen.

## Offene Entscheidungen

- **Session-Mode statt Transaction-Mode für die Datenbank?** Tauscht Tempo gegen
  Skalierbarkeit. Erst nach dem Vercel-Regionswechsel bewerten — siehe
  `DATENBANK_BRIEFING.md` §6.
- **G-Projekt:** anbinden gegen `tracker_user_stats` (Live-Daten) oder auf die
  neuen `g_*`-Tabellen warten? Rico entscheidet, wenn die Migration steht.
- **Elektron-Shell:** `package.json` verweist auf `electron/main.js`, das einen
  statischen Export lädt, den es nicht gibt. Behalten oder entfernen?
- **Einstellungs-Oberfläche für Intentionen** fehlt noch. `AnalyticsService
  .getIntentions()` liefert die Daten, es gibt aber keine Seite, auf der Rico das
  Schlafziel (6/8) oder die Toleranzen (`tolerancePct` 10 %, `toleranceKg` 1,5)
  ohne Seed ändern kann. Nächster naheliegender Schritt.
- **Gewicht ohne Startpunkt:** Schickt der Kurzbefehl nur `weightTarget` ohne
  `weightStart`/`weightStartDate`, misst Jarvis ab Tag eins gegen das Endgewicht,
  statt ein Zwischenziel zu interpolieren. Bewusst so — soll das lieber
  „Ziel fehlt" sein, bis der Startpunkt da ist?

## Für nächsten Agent — Claude-Code-Anbindung

Claude Code wird später **direkt** in Jarvis OS integriert (Rico, 2026-09-09).
Der KI-Export-Button ist deshalb am 2026-09-10 entfernt worden. Keine Arbeit mehr
in einen Export-Flow stecken; die Fläche in der Shell bleibt für die echte
Anbindung frei.

## Tech Stack & Key Dependencies

- **Next.js 16.2** (App Router) — weicht von Trainingsdaten ab, Docs liegen unter
  `node_modules/next/dist/docs/`. Siehe `AGENTS.md`.
- **React 19** — `useOptimistic` für optimistische Updates
- **Prisma 5.22** + **PostgreSQL 17.6** auf Supabase (Region London)
- **Tailwind v4** — CSS-first `@theme` in `globals.css`, Dark-only
- **cmdk** — Befehlspalette (⌘K), `src/components/layout/CommandPalette.tsx`
- ~~Zustand~~ — **entfernt**. Der Store hatte zuletzt nur noch Content-Kanban und
  die tote Suchleiste bedient; mit beiden ist er weg (samt `StoreHydrator` und
  `DashboardService`). Einstellungen werden serverseitig direkt gelesen.
- **Vercel** — Deployment vom `main`-Branch
- Konfiguration: `DATABASE_URL` mit `pgbouncer=true&connection_limit=1`,
  `DIRECT_URL` für Migrationen, `INGEST_SECRET` für die Apple-Kurzbefehle

## Vision & Langziel

Ein Cockpit, das ehrlich zeigt, ob die täglichen Ursachen erfüllt wurden — auch
und gerade wenn die Antwort unangenehm ist. Alles Weitere (Vertrieb, Health,
Finanzen) hängt daran, nie umgekehrt. Externe Systeme (CRM, Apple, G-Projekt)
liefern Daten, definieren aber nie die Wahrheit im Dashboard — die steht im
Semantic Layer.

**Ricos Arbeitsweise, die das System spiegeln soll** (früher `RICOS_WORKSPACE_GUIDE.md`):

- **Konsistenz vor Perfektion.** Jeden Tag auftauchen und tun, was ansteht. Die
  Tagesklammer sind Morgen- und Abendroutine.
- **Priorisierung nach Hebel:** umsatzgenerierend (Energievertrieb) und harte
  Deadlines zuerst. Keine künstlichen Überforderungsregeln.
- **Fernziel Proaktivität:** Jarvis soll die Tagesphase verstehen und von selbst
  handeln — z.B. bei der Abendroutine den Kalender für die Tagesplanung öffnen.

## Für nächsten Agent

1. **Zuerst `AGENTS.md`** — Next.js 16 verhält sich anders als du denkst.
2. **Nie `prisma db push`.** Die Datenbank enthält Tabellen fremder Apps
   (`crm_*`, `g_*`, `lead_*`, `user_profiles`), die nicht in `schema.prisma`
   stehen. Migrationen laufen über `npm run core:migrate` (idempotent).
   **Danach `npx prisma generate` *und* den Dev-Server neu starten** — sonst
   kennt der laufende Prozess neue Modelle nicht.
2b. **Keine erfundenen Werte in die Datenbank schreiben, auch nicht zum Testen.**
   Dev läuft gegen dieselbe Supabase-Instanz wie Production. Ein Testziel von
   „2100 kcal" sieht für Rico aus wie sein echtes. Testdaten immer sofort wieder
   entfernen.
3. **`crm_*` und `g_*`/`tracker_*` nur lesen.** Fremde Anwendungen. Alle Zugriffe
   sind gekapselt: fällt das CRM aus, stehen Metriken auf „nicht gemessen".
4. **Bei Performance-Fragen zuerst `DATENBANK_BRIEFING.md`** — enthält Messungen
   samt Methode. Nicht nochmal von vorn messen.
5. **`/routines` nicht kaputtmachen** — Ziel des iPhone-Widgets (`docs/ios-widget.md`).
6. Befehle: `npm run core:check` (Daten prüfen), `core:migrate`, `core:seed`,
   `npm run build` (prüft auch Typen), `npm run test:e2e` (Playwright-Rauchtest —
   die einzige Testsuite; `npm run test` läuft leer, es gibt keine Unit-Tests).

## Dokumente

| Datei | Zweck | Lesen wann |
|---|---|---|
| `HANDOVER.md` | dieser — Stand, gelöste Probleme, offene Fragen | vor jeder Prompt |
| `README.md` | Einstieg für Menschen, Befehlsübersicht | einmal |
| `AGENTS.md` | Next.js-16-Warnung + Arbeitsablauf | Session-Start (via `CLAUDE.md`) |
| `DATENBANK_BRIEFING.md` | Performance-Analyse mit Messungen, Übergabe an DB-Agent | bei Performance-Fragen; danach archivierbar |
| `docs/apple-shortcuts.md` | iOS-Kurzbefehle für Erinnerungen, Health **und Zielwerte**; Sync-Zeitpunkte; nachträglich korrigieren | beim Einrichten der Apple-Anbindung |
| `docs/ios-widget.md` | Scriptable-Widget, Technik | beim Anfassen des Widgets / `/routines` |
| `docs/bank-sync.md` | Bank-Sync über n8n | beim Anfassen des Bank-Imports |

`~/dev/coding-workflow-standards.md` (außerhalb des Repos) gilt projektübergreifend.
