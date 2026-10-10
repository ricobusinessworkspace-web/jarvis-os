---
last_updated: 2026-10-09
last_agent: Claude Opus 5.5 — Plan Schritte 0–3 (Sonntags-Joker, ChatGPT liest/hakt ab); parallel: NaN-Fix RulesCard
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
- **Routinen bearbeitbar**: fertig — umbenennen, verschieben, löschen, ergänzen.
- **Routine-Basis = höchstens 3 ausgelassen** (28.09., Ricos Vorgabe, **live** in `779c65b`, gilt rückwirkend — Zustände werden beim Lesen gerechnet): Basis =
  alle Schritte bis auf `maxSkip`, gleich welche; Soll = alle. Bei 8 Schritten
  also Basis ab 5, Soll bei 8. `maxSkip: 3` steht in
  `core_intentions.derived_config` (beide Routinen, bereits in der geteilten
  Datenbank — die alte Fassung ignoriert das Feld) und im Seed. Fehlt es,
  steht die Routine auf `zielfehlt` mit Hinweis. **Ersetzt die
  Pflichtschritte**: Rico hatte inzwischen alle 8 je Routine als Pflicht
  markiert — damit hätte Auslassen nie gegriffen. Pflicht-Knopf und
  `setRoutineItemRequired` sind raus; die Spalte `jarvis_tracker_items.required`
  bleibt ungenutzt stehen (keine Migration nötig). Gegen echte Daten
  nachgerechnet (14.–28.09.).
- **Abgeleitete Ziele**: fertig. Eine Intention ist jetzt *entweder* eine feste
  Zahl *oder* eine Ableitung (`routine_completeness`, `health_target`,
  `weight_trajectory`). Schlaf hat ein festes Ziel bekommen (Basis 6 h, Soll 8 h).
  Kalorien- und Gewichtsziel sind am 2026-09-10 gesetzt: **2.880 kcal** (Basis
  3.168) und **80 → 75 kg bis 2027-03-01**. Rico trainiert hart, 2.880 ist
  deshalb bewusst kein niedriger Wert — bei geschätzt ~3.100 Erhaltungsbedarf
  entspricht es den ~220 kcal Tagesdefizit, die das Gewichtsziel rechnerisch
  braucht. **Ob die Annahme stimmt, entscheidet die Gewichtskurve:** bleibt sie
  in 4–6 Wochen flach, war 2.880 doch Erhaltung und muss runter.
- **Korrektur von Hand**: fertig. Kalorien sind auf „Heute" und im Verlauf
  eintragbar; der Handwert schlägt jeden Sync, ist als „von Hand" markiert und
  per Knopf zurücksetzbar.
- **Shell aufgeräumt**: Content-Kanban, tote Suchleiste, Glocke ohne
  Ereignisquelle und KI-Export-Button sind raus. ⌘K öffnet stattdessen eine
  echte Befehlspalette. Der Zustand-Store ist damit vollständig entfallen —
  das Dashboard-Layout macht jetzt **keine** Datenbankabfrage mehr.
- **Apple-Anbindung** (Erinnerungen + Health-Kalorien): **fertig und im Betrieb**
  seit 2026-09-10. Beide Kurzbefehle stehen auf Ricos iPhone, vier Automationen
  laufen (Reminders/Cronometer je `Is Closed`, plus 08:00 und 23:00). Sync gegen
  Production verifiziert. Aufbau und alle Fallstricke: `docs/apple-shortcuts.md`.
- **CRM-Lesevertrag angebunden** (12.09.): Vertriebskennzahlen und -ziele kommen
  aus dem CRM, nicht mehr aus `core_intentions`. Quelle ist die Sicht
  `crm_daily_metrics` statt der Rohtabelle `crm_calls`, das Tagesziel steht
  damit auf **30/100** statt 30/60. Die Teilziele 40/40/20 sind neu sichtbar.
  Vertrag: `~/dev/Lightning CRM/docs/lesevertrag-jarvis.md`.
- **Vertriebs-Reiter neu** (12.09.): Aufteilung des Tages (Cold Groß · Cold
  Tarif · Nachgreifen), Trichter aus Stufenwechseln, Bestandszahlen aus
  `crm_stock_metrics`, Umsatzkarte gegen die 10.000 € bis 01.03.2027
  (`sales.closed_value_eur`, kumulativ ab Planbeginn). **Offen: 55 von 55
  Abschlüssen haben keinen Wert** — die Karte sagt das und zeigt bewusst keine
  0 €; sobald der erste Wert im CRM steht, rechnet sie von selbst.
- **Was Jarvis am CRM festhält** (für den CRM-Agenten wichtig): gelesen werden
  `crm_daily_metrics`, `crm_stock_metrics` und `crm_metric_targets`. Eine
  Umbenennung eines `metric_key` bricht Jarvis **still**. Zusätzlich hängt die
  implizite Null der `sales.stage_*`-Kennzahlen am Datum **2026-09-12**
  (`config.zeroFrom`) — dem Tag, seit dem Stufenwechsel strukturiert ankommen.
- **iPhone-Widget „Calls heute"** (15.09.): **fertig und ausgerollt.**
  `GET /api/widgets/calls` + `scriptable/jarvis-calls.js`. Aufbau wie das
  Apple-Wetter-Widget: Zahl, Zustand im Klartext, Schiene von 0 bis Soll mit
  Kerbe an der Basis, darunter „Basis 30 · Soll 100". Klein und mittel auf dem
  Homescreen, rechteckig auf dem Sperrbildschirm; ein Tipp öffnet `/vertrieb`.
  `WIDGET_SECRET_TOKEN` steht in Vercel (Production + Preview) und in
  `.env.local`. Beide Skripte liegen mit eingetragenem Token in
  `~/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/` und
  erscheinen über iCloud von selbst in der iPhone-App. **Offen: Rico muss die
  Widgets nur noch platzieren.** Einrichtung: `docs/ios-widget.md`.
- **Widget-Zugang vereinheitlicht** (15.09.): beide Widget-Endpunkte hängen an
  `checkWidgetAuth()` (`src/lib/widgetAuth.ts`) — ein Secret, kein Standardwert
  im Code, `Authorization`-Kopfzeile mit `?token=` als Rückfalltür. Der alte
  fest eingebaute Token von `/api/widgets/routines` ist damit weg, ebenso die
  falsche Produktions-URL im Routine-Skript.
- **Anschreiben, Stufe 1** (21.09.): **fertig, lokal geprüft.** Seite `/mail`.
  Die Warteschlange ist **abgeleitet**: offene CRM-Aufgaben am Lead, deren Text
  mit „Mail" beginnt (`MAIL_MARKER` in `MailService`). Im CRM war dafür **nichts
  zu bauen** — Rico benutzt diese Schreibweise bereits, drei Vorgänge standen
  beim ersten Aufruf sofort drin. Jarvis hält nur, was das CRM nicht kennt: den
  Entwurf (`mail_drafts`) und die Vorlagen (`mail_templates`).
  Kontextfelder pro Entwurf: Gesprächsdatum, gesprochen mit, Thema, Empfänger.
  Zustände `offen → entwurf → freigegeben → gesendet`, keiner wird übersprungen.
  Freigeben ist gesperrt ohne Betreff, Text und Empfängeradresse.
  **Offen: alle drei Vorgänge haben „keine Adresse im CRM"** — die Karte sagt
  das in Rot, statt eine leere Mail zuzulassen.
- **Jarvis-Orb** (24.09., finalisiert 25.09. in `b271165`, **live und in
  Production nachgemessen**: Startsequenz geht auf allen Reitern erst mit dem
  Inhalt weg, auch bei 4,9 s; Reiter-Wechsel ohne leeren Moment, Ball immer
  300 px. **Safari/iPhone nicht geprüft** — nur Chrome): Der Drahtgitter-Ball aus dem App-Icon als ein Bauteil
  (`JarvisOrb`), **eine Größe (300 px) für alle Auftritte**:
  **Startsequenz** (`BootSplash` im Root-Layout, `intro`: wird eingezeichnet)
  beim Laden und Neuladen, und **Ladezustand im Inhaltsbereich** beim
  Reiter-Wechsel — ohne `intro`, also vom ersten Bild an geschlossen. Der
  Ladezustand ist **ein** Bauteil, `RouteLoading`: in `loading.tsx` *und* als
  `fallback` jeder Suspense-Grenze der Reiter (die grauen Platzhalterkästen
  sind raus). `NavOrb` (Klick) und `RouteLoading` stehen pixelgenau an
  derselben Stelle, der Übergang ist unsichtbar.
  Beide enden an einem **echten Ereignis**, nicht nach Stoppuhr: die
  Startsequenz, wenn das Dokument fertig ist (`load` → `data-booted`, gesetzt
  von einem Inline-Skript im Layout, mindestens 1 s = voller Aufbau des
  Balls; Rückfalltüren 1,5 s nach `DOMContentLoaded` und 15 s absolut); der
  Ladezustand, wenn kein **sichtbares** `[data-route-loading]` mehr im
  Dokument steht. **Am 25.09. in Production nachgemessen:** das Dashboard
  streamt 2–4,2 s — die alte feste Obergrenze von 4 s lag mitten darin; beim
  Reiter-Wechsel kam der Inhalt nach 1–2,4 s, der Ball ging nach 0,5 s.
  Die Drehung ist gerechnet: CSS animiert `rx` der Längenkreise
  (`R · cos φ`) statt das Bild zu kippen — ein gedrehtes flaches SVG würde
  stauchen statt zu rotieren. Knoten sitzen nur auf Breitenkreisen, weil die
  bei jeder Drehung gültig bleiben. Strichbreiten × `--orb-u` (200 / Größe),
  sonst ist derselbe Strich beim kleinen Orb halb so dick und verschwindet im
  Schein; `non-scaling-stroke` nur auf Linien ohne Strichmuster (Wellen,
  Orbitalringe).
  Dazu (25.09.): Masse im Inneren, zwei gegenläufige Orbitalringe mit
  Partikeln, drei nach außen laufende Wellen, ein Lichtpuls am Rand und ein
  Abgang, der kurz anzieht und heller wird statt flach auszublenden.
  **Kein JavaScript im Orb selbst.** Verzögerungen stehen als CSS-Variablen
  (`--draw-delay`, `--spin-delay`, `--twinkle-delay`) am Element; welche
  Animation läuft, entscheidet das CSS je Auftritt (`.orb--intro`).
  *Ersetzt das frühere Skelett-`loading.tsx`* (graue Platzhalterkästen, aus dem
  Electron→Next-Umzug); es liegt in der Historie unter `54f08a4`.
- **Reiter „Ziele"** (`/ziele`, 28.09.): **fertig, live in `8acf453`.** Bearbeitbar
  ist nur, was Jarvis gehört (`EDITABLE` in `GoalService`): Schlaf, Training,
  Post (Basis/Soll), Routinen (`maxSkip`), Toleranzen um Kalorien/Gewicht,
  Umsatzziel. Nur angezeigt mit Herkunft: CRM-Vertriebsziele, Kalorien- und
  Gewichtsziel aus Apple Health (Ricos Entscheidung: die bleiben, wo sie sind).
  Aktionen in `src/actions/goals.ts` lehnen alles andere ab. Das Umsatzziel
  stand fest im Code (`UMSATZ_ZIEL`), jetzt in `core_goals` (Zeile „Umsatzziel
  Vertrieb", `metric_key = sales.closed_value_eur`, 10.000 € bis 2027-03-01 —
  in der geteilten Datenbank bereits gesetzt, war vorher `pending`). Ohne Ziel
  zeigt die Umsatzkarte „kein Ziel", nie 0 %. Das alte, ungenutzte
  `updateIntention` aus `actions/today.ts` ist raus.
- **MCP-Server für ChatGPT/Claude** (06.10.): **gebaut, geprüft und live** —
  Commit `97257b6` von `feat/jarvis-mcp` nach `main` übernommen und auf Vercel
  Production unter `https://jarvis-os-indol.vercel.app/api/mcp` veröffentlicht.
  `POST /api/mcp`, eigene
  OAuth-Anmeldung (`/api/oauth/*`, `/.well-known/*`). Fünf Lesewerkzeuge
  (`heute_ueberblick`, `aufgaben_anzeigen`, `routinen_anzeigen`,
  `ziele_anzeigen`, `mail_warteschlange_anzeigen`) und ein Schreibwerkzeug
  (`mail_entwurf_speichern` — nur Betreff/Text, nie freigeben/senden).
  Geprüft: 48 Unit-Tests, Build, OAuth-Ablauf über HTTP, alle Lesewerkzeuge
  per offiziellem MCP Inspector gegen echte Daten. Nach dem Deploy erneut
  geprüft: MCP ohne Token `401`, beide OAuth-Metadaten mit der indol-Adresse,
  Dashboard-Seiten `/`, `/mail`, `/ziele`, `/vertrieb` jeweils `200`.
  **ChatGPT-Plugin laut Rico erstellt;** Rico meldete einen erfolgreichen Textaufruf.
  Sprachaufruf und Installation/OAuth sind von Codex nicht unabhängig geprüft.
  Claude-Verbindung zu Jarvis ist optional.
  **Erweiterung 06.10.:** `performance_wochenverlauf` liest vier (wählbar 1–8)
  abgeschlossene Di–Mo-Blockwochen plus die laufende Woche aus dem bestehenden
  AnalyticsService; keine Datenbankänderung. Lokal: 49 Tests, TypeScript und Build
  grün. Commit `cb012f1` ist auf `main` und Vercel Production **Ready**.
  Danach geprüft: `/api/mcp` ohne Token `401`, beide OAuth-Metadaten `200`
  mit indol-Adresse, Dashboard `/`, `/mail`, `/ziele`, `/vertrieb` je `200`.
  Authentifizierter Aufruf des neuen Werkzeugs und Text-/Sprachtest in ChatGPT
  bleiben offen; Rico muss die Plugin-Verbindung dafür aktualisieren.
  Einrichtung, Variablen, Testfragen: `docs/mcp-server.md`.
- **Phase 2 — Regeln statt Körperwerte** (07.10., live): Rico hat die
  Wochen davor als wenig aussagekräftig eingestuft und wollte einen Schnitt,
  ohne dass die Daten kaputtgehen. Umgesetzt als **Schnitt in der Bewertung,
  nicht in den Daten**:
  - `src/lib/phases.ts`: Phase 1 „Aufbau" 01.09.–06.10., Phase 2 ab 07.10.,
    je mit Klartext, was bewertet wurde. Dashboard und Health rechnen
    **Quoten** ab Phasenstart (`evaluationStart`); **Serien und Rekord laufen
    über den Schnitt** (`summarize(…, { streakFrom })`, Matrix ab Blockstart
    geladen). Zuerst waren auch die Serien gekappt — Training stand am 07.10.
    auf 0 statt 3. Der Verlauf zeigt alles. Vitest schließt `.claude/**` aus
    (Worktrees paralleler Sessions brachten sonst fremde Tests mit).
  - **Drei Regeln** „No Jerking", „Keine Drogen", „Kein Scrolling"
    (`rule.nofap`, `rule.substances`, `rule.scrolling`, Domäne `rules`,
    Tracker „Regeln" Typ `rules`): Ziel 1, `active_weekdays` 1–7 — **gelten
    auch sonntags**. **Umgekehrt zu den Ursachen** (Rico, 07.10.): gehalten,
    solange kein Rückfall eingetragen ist — Quelle mit `assumeDoneFrom`
    (ab Phasenstart bis heute, nie Zukunft). Antippen = gebrochen (rotes ✕,
    gespeichert als `not_done`), nochmal = Rückfall gelöscht. Es gibt dort
    kein „nicht gemessen". Nachtragen im Verlauf (ab 07.10.).
    Welche Regeln es gibt, steht in der DB — Seiten filtern nach Domäne.
  - **Ursachen und Regeln teilen eine Zeile** (`HabitRow`): Kästchen, Name,
    Unterzeile (Status · Rekord), rechts immer die Serie, auch bei 0. Keine
    Zahlen „0 / 1" mehr — Calls stehen links in eigener Karte. Ursachen zeigen
    „offen" **in der Anzeige** rot von morgens an; gespeichert bleibt
    „nicht gemessen" (Matrix/Verlauf trennen weiter vergessen und verfehlt).
  - **Schlaf/Kalorien/Gewicht**: Ziel per `valid_to = 2026-10-06` beendet,
    nichts gelöscht. Phase-1-Tage behalten ihre Bewertung, ab Phase 2 „erfasst"
    ohne Ziel. Apple-Sync läuft weiter. Körperkarte vom Dashboard entfernt,
    Health zeigt Training/Routinen/Regeln, Ziele-Seite blendet die Körperziele aus.
  - **MCP**: `heute_ueberblick` und `ziele_anzeigen` nennen die Phase und die
    Regeln; `performance_wochenverlauf` liefert `phasen` + je Woche die
    Phase(n) und `ziel_galt_an_tagen`; Zielquote ist `null`, wenn kein Ziel galt.
  - **Finanzen kaltgestellt** (Ricos Wunsch): aus Sidebar und ⌘K genommen,
    `/finance` bleibt erreichbar.
  - Daten per `core:migrate` + `scripts/phase-2.mts` (idempotent), Code in
    `0e9a1c3` + `d2d45b8` (Haken/Regeln umgedreht) — **live in Production** und nachgeprüft: alle Reiter `200`,
    Regel-Karte auf `/`, MCP ohne Token `401`. 57 Tests, Build grün. Offen:
    ChatGPT-Abfrage des Wochenverlaufs mit Phasen von Rico selbst testen.
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
  aber nicht auflösen (Cronometer-Ziel nie angekommen, keine
  Auslass-Grenze `maxSkip` an der Routine). Beides gleich zu zeigen würde einen kaputten Anschluss wie eine
  Design-Entscheidung aussehen lassen. Die UI nennt bei `zielfehlt` immer den
  Grund (`DayMetric.targetHint`).
- **Ziele dürfen abgeleitet sein.** `core_intentions` trägt entweder
  `base_value` (fest, aus Plan/CRM/Einstellungen) oder `derived_kind` (aus einer
  Verbindung, on-read gerechnet). Fällt eine Ableitung aus, wird **nichts
  geraten** — dieselbe Regel wie bei Werten, nur für die Zielseite.
- **Routinen: Basis = höchstens `maxSkip` ausgelassen, Soll = alle.** Seit
  28.09. zählt die Anzahl, nicht *welche* Schritte (vorher: Pflichtschritte —
  auf Ricos Wunsch ersetzt). Beide Zahlen wandern mit, wenn Rico die Routine
  umbaut; die Grenze steht in der Datenbank, nicht im Code. Die Karte rechnet
  sie nicht nach, sie bekommt `base` aus der Metrik.
- **Eigene Ziele sind historisiert, genau wie die CRM-Ziele.** Eine Änderung
  schließt die laufende `core_intentions`-Zeile am Vortag (`valid_to`) und legt
  ab heute eine neue an; mehrfach am selben Tag überschreibt die heutige.
  `getMatrix` wählt das Ziel **je Tag** (`intentionFor`). Vor der ältesten
  Fassung gilt die älteste — so verhielt es sich schon vorher. Nachgewiesen:
  alter und neuer Code liefern auf 884 Zellen (17 Metriken, 15.08.–05.10.)
  dieselbe Matrix. Wer `core_intentions` direkt per Skript ändert, soll das
  ebenso tun (oder `revise` in `actions/goals.ts` nutzen), sonst werden
  vergangene Tage rückwirkend neu bewertet. Ausnahme: die Schrittzahl einer
  Routine ist nicht historisiert.
- **Das CRM besitzt die Vertriebsziele, Jarvis spiegelt sie.** `crm_metric_targets`
  ist historisiert: es gilt die Zeile mit dem größten `valid_from`, das nicht
  nach dem Stichtag liegt. Sonst würde eine Zielerhöhung die Vergangenheit
  rückwirkend schlechter aussehen lassen. Gelesen über `derived_kind: 'crm_target'`.
- **Implizite Null braucht ein Anfangsdatum** (`config.zeroFrom` an der Quelle).
  Für Anrufe gilt sie ab Blockbeginn — das CRM protokolliert jeden gewählten
  Anruf. Für Stufenwechsel erst ab dem 12.09., seit sie strukturiert festgehalten
  werden. Ohne das zeigte der Trichter für jeden Tag davor eine lückenlose
  Null-Reihe: „kein Angebot rausgeschickt" statt „wurde nicht erfasst".
- **Aggregate nennen ihre Abdeckung.** Der Trichter schreibt dazu, an wie vielen
  Tagen des Blocks überhaupt gemessen wurde. Eine 0 über 12 Tage, von denen einer
  gemessen ist, liest sich sonst wie ein Ergebnis.
- **Ein Widget darf nicht urteilen, solange der Tag läuft.** Im Semantic Layer
  ist 3 von 30 Calls `unter` — auf dem Dashboard stimmt das, dort steht die Zahl
  neben der Uhrzeit in einer Tabelle. Ein Widget steht ab Mitternacht auf dem
  Homescreen; ein roter Balken um 08:00 Uhr behauptet „Tag verfehlt", obwohl der
  Tag noch läuft. `/api/widgets/calls` gibt deshalb **zwei** Felder zurück:
  `state` (unverändert aus der Matrix) und `verdict`, das vor 18:00 Uhr
  (`FEIERABEND_HOUR`) `laeuft` statt `unter` sagt. Der **Wert** wird nie
  geschönt, nur das Urteil zurückgehalten.
- **Widget-Skripte rechnen und formulieren nicht.** `/api/widgets/calls` liefert
  `verdictLabel`, `bounds` und `display` fertig aus `metricState.ts` — derselben
  Quelle wie die Dashboard-Beschriftungen. Im Scriptable-Skript steht deshalb
  kein Zielwert und kein deutscher Satz. Sonst stünde das Ziel ein zweites Mal
  im Code, diesmal auf Ricos Telefon, und wäre beim nächsten Zielwechsel im CRM
  still falsch — mit dem Unterschied, dass es dort niemand nachrechnet.
- **Beschriftungen kommen aus den Daten.** `targetSub()` bildet „Basis 30 · Soll
  60" aus der Matrix. Vorher stand der Text zweimal fest in den Seiten und wäre
  beim nächsten Zielwechsel im CRM still falsch geworden.
- **Quellen-Schicht `core_metric_sources`.** Pro Metrik eine nach `priority`
  geordnete Quellenliste, erster Treffer gewinnt. Ein neues System anzubinden ist
  eine Zeile in der Tabelle, kein neuer Code-Pfad.
- **Keine erfundenen Zahlen.** Kein Platzhalter-Ziel, kein 0 % für ein Ziel, das
  nicht existiert. Das Umsatzziel steht bewusst auf `pending`.
- **Ein Overlay über der App braucht eine Rückfalltür.** Die Startsequenz
  hängt am Ereignis `load`, damit sie so lange läuft wie das Laden dauert — aber
  das Inline-Skript nimmt sie auf jeden Fall weg: 1,5 s nachdem das Dokument
  durch ist (`DOMContentLoaded`, falls ein Bild/eine Schrift `load` aufhält),
  spätestens nach 15 s (falls der Server im Strom hängt). Der Schleier hat
  `pointer-events: none`, ist also nie im Weg. **Die Rückfalltür darf nicht
  kürzer sein als die echte Ladezeit** — sonst ist sie keine Tür, sondern der
  Normalfall (siehe Gelöste Probleme). Der alte
  `EcosystemLoader` verschwand per `useEffect` (also erst nach vollständiger
  Hydration) und hatte **keine** solche Sicherung — deshalb konnte er die App
  verdecken. Kein React im Schleier: ein Fehler im Bundle darf ihn nicht stehen
  lassen. Wer hier wieder einen Zustand einbaut, baut den alten Fehler nach.
- **Den Teil vor dem ersten Frame kann keine Animation abdecken.** Beim
  Neuladen wartet der Browser auf die Server-Antwort und zeigt dabei noch die
  alte Seite; erst danach kann in Jarvis überhaupt etwas malen. Die Startsequenz
  deckt ab dem ersten Frame ab, nicht davor. Beim *Reiter-Wechsel* greift
  dagegen `loading.tsx` — dort ist genau diese Wartezeit sichtbar.
- **Die Mail-Warteschlange wird abgeleitet, nicht gespiegelt.** Was ansteht,
  steht im CRM als Aufgabe. Jarvis führt keine zweite Liste, die auseinander-
  laufen könnte; ein im CRM abgehakter Punkt verschwindet in Jarvis von selbst.
  Dieselbe Regel wie bei den Zielen: die Quelle, die es besitzt, behält es.
- **Ein fehlender Platzhalter wird sichtbar, nicht leer.** `{{ansprechpartner}}`
  ohne Wert wird zu `[Ansprechpartner fehlt]` im Text, nicht zu `""`. Sonst
  entstünde „Guten Tag ," und niemand merkt es vor dem Absenden — dieselbe
  Trennung wie `NULL ≠ 0`, nur in Prosa. Gemessen wird am **gespeicherten
  Text**, nicht an der Vorlage: nach dem Anwenden stehen dort keine `{{…}}`
  mehr, sondern die Marker.
- **Aus dem Vornamen wird kein Herr/Frau geraten.** Ohne Ansprechpartner die
  neutrale Anrede. Eine falsche Anrede trifft den Kunden, nicht das Dashboard.
- **Ziele kommen aus der Quelle, die sie besitzt.** Die Vertriebsziele liest
  Jarvis seit dem 12.09. aus `crm_metric_targets` im CRM — dort werden sie
  bearbeitet, dort gehören sie hin. `user_profiles.daily_call_goal` (60) wird
  **nicht mehr gelesen** und ist damit verwaist.
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
- **MCP-Werkzeuge rechnen nicht selbst.** Jedes ruft dieselbe Service-Funktion
  wie die Dashboard-Seite und formt nur die Antwort um. Neue Werkzeuge genauso
  — sonst gibt es zwei Wahrheiten, eine davon auf Ricos Telefon.
- **Ein Ausfall ist kein leeres Ergebnis.** `getCrmTasksMitStatus` und
  `getQueueMitStatus` sagen `ok` / `kein_profil` / `nicht_erreichbar`. Das
  Dashboard darf eine leere Spalte zeigen; ein Sprachassistent, der „keine
  Aufgaben" sagt, während das CRM ausgefallen ist, lügt. Die alten Funktionen
  (`getCrmTasks`, `getQueue`) bleiben als dünne Hülle für die Seiten.
- **Schreiben von außen nur mit Stand.** `mail_entwurf_speichern` glaubt dem
  Modell nichts, was der Server nachsehen kann (Aufgabe, Lead, Adresse kommen
  aus dem CRM) und überschreibt einen vorhandenen Entwurf nur mit dessen
  `updatedAt` als Bedingung **in der Datenbank** (`updateMany`). Wiederholung
  = `unveraendert`, kein zweiter Schreibvorgang.

- **Ein Systemwechsel ist ein Schnitt in der Bewertung, nie in den Daten.**
  Ziele enden per `valid_to`, neue beginnen per `valid_from`, Phasen
  (`src/lib/phases.ts`) erklären den Schnitt in Worten — für Dashboard und
  ChatGPT. Wer Wochen über einen Phasenwechsel vergleicht, ohne die Phase zu
  nennen, liest einen Systemwechsel als Leistungsänderung.
- **Off-Day je Ziel, nicht global.** `stateFor` fragt
  `core_intentions.active_weekdays` (vorher ungenutzt); ohne Ziel gilt der
  Plan-Sonntag. `summarize` zählt Off-Days aus der Matrix, nicht aus dem
  Kalender — deshalb zählen Regeln sonntags mit, alles andere nicht.
- **Implizite Werte brauchen ein Anfangsdatum und enden heute.** `impliesZero`
  (Calls), `zeroFrom` (Stufen) und jetzt `assumeDoneFrom` (Regeln) — und alle
  drei nehmen nichts an, wenn die Sammelabfrage leer zurückkommt (Ausfall).
- **Quote nur über Tage mit Ziel** (`targeted`). Ohne Ziel ist die Quote
  `null`, nie 0 %.
- **Motivationssystem (Schritte 4–8)**: Arbeitsplan mit Häkchen in
  `docs/umsetzung-motivation.md` (Häkchen + „Fortschritt"). **Schritt 4 live**
  (10.10.): Gold-Token, Stufen 3/7/14/21/30/50/100, animierte Zeilen, Ton,
  Feier aus Server-Zahlen (`MotivationService.ausblick`, `summarize` kennt
  `streakStart`). Regel: der Browser zählt nie selbst, er wählt nur zwischen
  den vorab gerechneten Fällen. **Schritt 5 live**: Tagesringe + perfekter
  Tag (`TodayProvider` als gemeinsamer optimistischer Zustand; Feier per Portal,
  weil `backdrop-filter` an einem Vorfahren `position: fixed` einfängt).
  **Schritt 6 live**: `/ziele` als Zielbild (Reise, Ergebnis, Ketten,
  Rekordwand; Editor eingeklappt). Der Stichtag der Reise ist der des
  Umsatzziels (`core_goals`) — ohne ihn keine Restzeit.
- **ChatGPT hakt ab** (09.10., Schritt 3, **live** in `f861141`; Production
  geprüft: alle Reiter 200, MCP ohne Token 401, 14 Werkzeuge, Schreibtest
  Post an/zurück über Production, Protokollzeilen danach gelöscht).
  `ursache_eintragen`, `regel_rueckfall`, `routine_schritt`,
  `routine_komplett` in `src/lib/mcp/abhaken.ts` — nur heute/gestern, über
  `TrackingService`, Antwort vorher/nachher mit Serie/Rekord aus `summarize`
  (Matrix ab Blockstart, wie das Dashboard). `neuer_rekord` nur bei echter
  Handlung und ab 2 Tagen — ein zurückgenommener Rückfall stellt den alten
  Rekord nur wieder her (im Echttest fiel genau das auf). Namen per
  Wortanfang, mehrdeutig → Rückfrage. Calls/Körperwerte werden mit Grund
  abgelehnt. Tabelle `mcp_write_log` (über `core:migrate`, **bereits in der
  geteilten DB angelegt** — rein additiv, alter Code ignoriert sie); Client
  kommt aus dem OAuth-Zeichen (`clientKennung`). Verlauf zeigt „über ChatGPT"
  (bzw. „über Assistent" bei anderen Clients). Gegen echte Daten lokal geprüft,
  alle Testhaken und Protokollzeilen danach gelöscht. **Offen:** Rico muss in
  ChatGPT (Browser, chatgpt.com/plugins → Jarvis OS → Refresh) aktualisieren
  und testen; ob ein privates Plus-Konto Schreibaktionen darf, ist laut
  OpenAI-Quellen widersprüchlich (`docs/mcp-server.md` §6).
- **Ein Schreibweg für Haken: `TrackingService`** (09.10., Schritt 2).
  `setzeUrsache` / `loescheUrsache` (Ursachen und Regeln, Haken aus
  `core_metric_sources`), `setzeSchritt` (Routine, nur im Gültigkeitsfenster
  `active_from`/`archived_on`), `schritteAm(datum)`. Jede Funktion meldet
  `{ vorher, nachher, geaendert }` und schreibt nicht, wenn schon steht, was
  soll (idempotent). Metriken, deren **vorrangige** Quelle kein Haken ist
  (Calls → CRM), werden abgelehnt. `toggleCause`, `clearCause` und
  `logTrackerItem` sind nur noch Hüllen mit `revalidateTracking()`;
  `RoutineService.logTrackerItem` ist entfallen. Im Browser gegen echte Daten
  geprüft (Post an/zurück, Routine-Schritt an/aus), Testzeile danach gelöscht,
  Tag wieder ohne Haken.
- **ChatGPT liest, was die Zahlen bedeuten** (09.10., Schritt 1 des Plans).
  `DatenbasisService` leitet je Metrik ab, was ein leerer Tag heißt
  (`gehalten` aus `assumeDoneFrom`, `null` aus `zeroFrom`/`impliesZero`, sonst
  `nicht_gemessen`), alle Zielfassungen und die Lücken (Ziel endete, kam später,
  Erfassung erst ab). Fester Text nur für die gelöschten Routine-Haken vor
  28.09. Datenqualität einer Woche/Phase misst nur Metriken mit
  `nicht_gemessen` — Calls und Regeln sind nie leer und würden schönrechnen.
  Neue MCP-Werkzeuge `jarvis_kontext`, `phasen_vergleich`, `tage_anzeigen`
  (`src/lib/mcp/datenbasis.ts`; geteilte Bausteine in `src/lib/mcp/hilfen.ts`).
- **Kein Ziel vor der ersten Fassung, wenn die Metrik später eingeführt wurde.**
  `getMatrix` nahm vor der ältesten Zielfassung immer die älteste an — für die
  Regeln (erste Fassung 07.10.) hieß das: Phase 1 stand mit Ziel 1 und Wert
  `null` da, der Wochenverlauf meldete Quote 0 statt `null`. Jetzt gilt die
  Rückwärts-Regel nur noch für Fassungen, die spätestens am Planbeginn
  (`BLOCK_START`) starten.
- **Sonntag ist Joker für jede Serie** (Rico, 09.10.). `summarize` überspringt
  einen verfehlten Sonntag für Serie und Rekord (`jokerWeekday`, Standard
  `JOKER_WEEKDAY` = 7 aus `blocks.ts`, `null` schaltet ab) — auch einen
  endgültigen Rückfall an einem heutigen Sonntag. Ein gehaltener Sonntag zählt
  +1. Quote und Rückfall-Zähler sehen den Rückfall voll. Für Ursachen/Routinen
  ändert sich nichts (Sonntag ist dort Off-Day). Standard statt Aufrufer-Option,
  damit kein Aufrufer (Dashboard, Health, Vertrieb, MCP) ihn vergisst.
- **Heute ist offen, bis es erfüllt ist** — zählt nicht in die Quote, bricht
  keine Serie, auch wenn ein Haken wieder entfernt wurde (`not_done` heute).
  Nur der echte heutige Tag (`getBerlinDateStr`), nicht das letzte Datum einer
  vergangenen Woche. **Ausnahme Regeln** (`missIsFinal`): ein Rückfall steht
  sofort fest. Vorher brach ein heute an- und wieder abgewählter Haken die
  Trainingsserie (07.10.: 0 statt 3).
- **Routine-Schritte haben ein Gültigkeitsfenster** (`active_from`,
  `archived_on`). Entfernen archiviert ab heute (Schritte ohne je einen Haken
  werden echt gelöscht), Hinzufügen zählt ab heute. Die Schrittzahl und die
  gezählten Haken kommen je Tag aus demselben Fenster.

## Gelöste Probleme (nicht wiederholen)

- **Problem:** Konsolenfehler „Received NaN for the `children` attribute",
  scheinbar auf allen Reitern (auch `/mail`), im HTML kein NaN.
  **Ursache (07.10.):** Nicht die Shell, sondern `RulesCard` — „Rückfälle"
  war `rows.reduce((n, r) => n + r.broken, 0)` in einem `<span>` ohne
  weitere Kinder. Beim Hot Reload (Commit `d2d45b8` hat `broken` eingeführt)
  bekam die neue Karte noch Zeilen der alten Seite ohne das Feld:
  `0 + undefined = NaN`. Belegt in `.next/dev/logs/next-development.log`:
  einmalig, direkt nach „Compiled", Stack `commitUpdate` (Update, kein
  Erst-Render). Dass es „auf allen Reitern" stand: das Dev-Overlay behält
  den Fehler beim Wechsel per Client-Navigation.
  **Lösung (live seit 09.10., `15d2ad7`):** Summe wird `null`, sobald einer Zeile die Zahl fehlt → „–".
  Serie in `HabitRow` zeigt „–" statt NaN (Tooltip entfällt dann), die Mittelwerte in Ursachen und
  Regeln überspringen fehlende Werte (`Number.isFinite` statt `!== null`).
  Test `RulesCard.test.tsx` spielt den Hot Reload nach.
  **Warum wichtig:** Production war nie betroffen (`page.tsx` setzt `broken`
  immer). Bei Dev-Fehlern ohne Komponentennamen zuerst die Dev-Log-Datei
  lesen — sie hat Zeitpunkt und Stack, die Browser-Konsole oft nicht mehr.

- **Problem:** Routine von 8 auf 6 Schritte gekürzt (nach dem 28.09.) — die
  Haken der gestrichenen Schritte waren weg, und alle vergangenen Tage wurden
  gegen die neue Schrittzahl bewertet.
  **Lösung (07.10.):** Archivieren statt Löschen + Schrittzahl je Tag (siehe
  „Was funktioniert"). Verlorenes ist nicht wiederherstellbar (Supabase
  `free`, kein Backup); die Bewertung der Phase-1-Tage gegen 6 Schritte ist
  in sich stimmig, weil auch nur die Haken der 6 verbliebenen gezählt werden.
  **Warum wichtig:** `TrackerLog → TrackerItem` ist `onDelete: Cascade`. Jedes
  `trackerItem.delete` mit Historie vernichtet Daten — nie wieder einbauen.

- **Problem:** Am Rand des Orbs fehlte oben rechts ein Stück Kreis — er sah
  unfertig aus, aber nur beim großen Auftritt (Startsequenz, 300 px).
  **Erster Versuch (24./25.09., wirkungslos):** `pathLength={1}` auf alle
  Linien. In Chrome nachgemessen: die Lücke blieb, jetzt ein Drittel.
  **Lösung (25.09.):** `vector-effect: non-scaling-stroke` **raus** aus allen
  Linien mit Strichmuster (Gitter, Rand, Puls). Gleich dicke Striche bei jeder
  Größe kommen stattdessen aus `--orb-u` = 200 / Größe, das `JarvisOrb` setzt
  und das CSS mit den Strichbreiten multipliziert. Zusätzlich endet das
  Einzeichnen auf `stroke-dasharray: 1 0` (Strich ohne Lücke), der Ring ist
  am Ende also geschlossen, egal wie ein Browser die Länge misst.
  **Warum wichtig:** Mit `non-scaling-stroke` zeichnet der Browser das Muster
  in **Bildschirm**pixeln, `pathLength` skaliert es aber auf die Länge in
  **Koordinaten** (440). Auf dem Schirm ist der Rand beim 300-px-Orb 660 px
  lang, das Muster deckte zwei Drittel; weil ein `<circle>` bei 3 Uhr beginnt
  und im Uhrzeigersinn läuft, fehlt das Ende — oben rechts. Beim 168-px-Orb
  ist der Schirm-Umfang *kürzer* als 440, deshalb fiel es dort nie auf.
  Merksatz: **`non-scaling-stroke` und Strichmuster gar nicht kombinieren —
  auch nicht mit `pathLength`.** Und: einen Grafikfehler erst als behoben
  eintragen, wenn er im Browser gegengeprüft ist.

- **Problem:** Die Startsequenz verschwand manchmal mitten im Laden, und an
  ihrer Stelle stand der kleine Ball aus `loading.tsx` — „mal kürzer, mal
  kleiner".
  **Lösung:** Feste Obergrenze 4 s ersetzt durch Rückfalltüren, die am
  Ladezustand hängen (1,5 s nach `DOMContentLoaded`, absolut 15 s).
  Mindestdauer 700 ms → 1000 ms, so lang wie der Aufbau des Balls. Der
  Schleier steht jetzt **vor** dem Inhalt im DOM, damit er in jedem ersten
  Bild dabei ist.
  **Warum wichtig:** Gemessen in Production: `/` streamt 2,1–4,2 s, weil der
  Inhalt erst nach den Datenbankabfragen kommt. Bei 4 s wurde der Schleier
  weggenommen, der Inhaltsbereich zeigte noch den Ladezustand. Und bei
  schnellem Laden (< 860 ms) ging der Ball, bevor er fertig hochskaliert war —
  daher „mal kleiner".

- **Problem:** Der Ball war „mal kleiner" und beim Reiter-Wechsel „nicht
  komplett".
  **Erster Versuch (24./25.09., reichte nicht):** Aufbau im Inhaltsbereich auf
  260 ms ab 93 % verkürzt — die Größe blieb aber 168 px statt 300 px, und das
  Einzeichnen (560 ms + Versatz) lief weiter.
  **Lösung (25.09.):** Eine Größe für alle (`ORB_SIZE`, keine `size`-Prop
  mehr). Eingezeichnet und hochskaliert wird nur in der Startsequenz
  (`intro`), die mindestens so lange steht wie der Aufbau. Im Inhaltsbereich
  ist das Gitter sofort geschlossen und blendet nur 200 ms ein.
  **Warum wichtig:** Der Ball beim Reiter-Wechsel stand gemessen ~0,5 s. Das
  Einzeichnen läuft im Uhrzeigersinn ab 3 Uhr, das letzte Stück ist also oben
  rechts — ein Ball, der vor Ende des Aufbaus verschwindet, zeigt **immer**
  eine Lücke oben rechts, ganz ohne Grafikfehler. Ein Aufbau darf nie länger
  dauern als der kürzeste Auftritt, den er haben kann.

- **Problem:** Der Ladezustand erschien mal, blitzte mal nur auf und fehlte
  einmal ganz (zurück aufs Dashboard).
  **Lösung:** `NavOrb` — eine eigene Schicht, die am **Klick** startet und
  endet, wenn der Pfad gewechselt hat **und** kein sichtbarer Ladezustand
  (`[data-route-loading]`) mehr im Dokument steht; mindestens 480 ms,
  Notbremse bei 8 s.
  **Korrektur 25.09.:** Der Pfadwechsel allein war das falsche Ende. Die
  Reiter haben eine eigene Suspense-Grenze, Next schaltet den Pfad deshalb
  nach ~200 ms um, sobald die Hülle steht — der Inhalt kam erst nach
  1–2,4 s, dazwischen standen graue Kästen. Außerdem zählen nur **sichtbare**
  Ladezustände: React lässt beim Streamen versteckte Behälter
  (`<div hidden id="S:0">`) mit dem alten Platzhalter liegen; ohne
  `getClientRects()`-Prüfung blieb der Ball über fertigem Inhalt stehen.
  **Warum wichtig:** `loading.tsx` allein kann das prinzipbedingt nicht
  leisten. Die Next-Doku sagt: ist die Zielseite vorgeladen, wird der
  Wartezustand **übersprungen**, und Vor/Zurück nutzt bewusst den
  Verlaufsspeicher (`staleTimes` ändert daran nichts). Ob der Ball erscheint,
  hing also davon ab, was Next gerade im Speicher hatte. Klick und Pfadwechsel
  treten dagegen immer ein. `loading.tsx` bleibt daneben für alles ohne Klick
  (Befehlspalette, Vor/Zurück, direkter Aufruf); weil `NavOrb` deckend ist,
  sieht man nie zwei Bälle.

- **Problem:** Oben rechts ruckelte es bei jedem Neuladen — erst eine Lücke,
  dann sprang das Datum herein und schob den ⌘K-Knopf zur Seite.
  **Lösung:** Die Uhrzeit wird im Dashboard-Layout **serverseitig** gebildet
  (`berlinClock()`) und als `initialClock` durchgereicht; die TopBar nimmt sie
  als Startwert und aktualisiert erst danach im Effekt.
  **Warum wichtig:** Sie hing vorher hinter `now && …` und erschien erst nach
  der Hydration — aus Angst vor einem Unterschied zwischen Server- und
  Browserzeit. Der Unterschied verschwindet aber, wenn **beide Seiten mit
  `timeZone: 'Europe/Berlin'` formatieren**; dann stimmen die Zeichenketten
  überein und React hat nichts zu meckern. Springt die Minute dazwischen um,
  rendert der Browser trotzdem zuerst den gelieferten Wert und korrigiert im
  Effekt. Merksatz: **eine Zeitanzeige hinter einem Hydration-Wächter zu
  verstecken tauscht eine Warnung gegen einen sichtbaren Sprung** — die Zeitzone
  festzunageln löst beides.

- **Problem:** Das veröffentlichte Dashboard zeigte „ohne Zielwert" bei Calls,
  obwohl lokal alles stimmte.
  **Lösung:** Code veröffentlichen — die Hälften waren auseinandergelaufen.
  **Warum wichtig:** **Dev und Production teilen sich dieselbe Datenbank.** Eine
  Änderung an `core_*` ist in dem Moment live, in dem das Skript durchläuft —
  der Code dazu erst nach dem Deploy. Dazwischen liest Production neue Daten mit
  altem Code. Hier: `core_intentions.base_value` stand auf `null` mit
  `derived_kind = 'crm_target'`, das die veröffentlichte Fassung nicht kannte.
  **Regel: Schema- und Seed-Änderungen an `core_*` gehören zusammen mit dem Code
  veröffentlicht, nie vorher.** Wer nur lokal testen will, ändert keine Zeile in
  der geteilten Datenbank.

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
  In `docs/ios-widget.md` ist sie am 15.09. korrigiert. **Noch offen:** dieselbe
  falsche URL steht in `src/app/api/auth/google/route.ts:28` und
  `callback/route.ts:29` als OAuth-Redirect. Dort **nicht blind ändern**: die URL
  muss mit dem übereinstimmen, was in der Google Cloud Console registriert ist.
  **Korrektur vom 21.09.:** das betrifft nur noch Kalender/Tasks. Ricos Postfach
  läuft über SMTP/IMAP, nicht über Google — die Mail-Anbindung hängt **nicht**
  daran.

- **Problem:** Das Routine-Widget auf dem iPhone zeigte auf
  `jarvis-os-wardogs.vercel.app` und kam nur über einen Vercel-Bypass-Token
  durch — also an alten Code, während das Dashboard längst woanders lief.
  **Lösung:** Skript auf die echte Produktions-URL umgestellt, Bypass entfernt,
  Zugang auf `WIDGET_SECRET_TOKEN` gehoben. Neue Fassung über iCloud aufs Gerät.
  **Warum wichtig:** Ein Bypass-Token verdeckt genau den Fehler, den er umgeht.
  Solange er im Skript stand, *sah* das Widget funktionierend aus, las aber ein
  totes Deployment. Wo ein Bypass nötig scheint, zuerst die Adresse prüfen.

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

- **`core:seed` ist veraltet — nicht ausführen.** Er ersetzt *alle* Quellen
  durch seine Liste, kennt aber die CRM-Quellen (`crm_metrics`, seit 12.09.)
  und die Regeln nicht. Ein Lauf klemmt Calls, Trichter und Regeln ab.
  Entweder Seed auf den heutigen Stand bringen oder auf „nur ergänzen" umbauen.

- **Session-Mode statt Transaction-Mode für die Datenbank?** Tauscht Tempo gegen
  Skalierbarkeit. Erst nach dem Vercel-Regionswechsel bewerten — siehe
  `DATENBANK_BRIEFING.md` §6.
- **G-Projekt:** anbinden gegen `tracker_user_stats` (Live-Daten) oder auf die
  neuen `g_*`-Tabellen warten? Rico entscheidet, wenn die Migration steht.
- **Elektron-Shell:** `package.json` verweist auf `electron/main.js`, das einen
  statischen Export lädt, den es nicht gibt. Behalten oder entfernen?
- **`CrmService.getPipeline()` und `crm_stock_metrics` überschneiden sich.** Die
  Sicht kennt `pipeline_count` (nur `offer`), die eigene Abfrage die volle
  Stufenverteilung. Beide bleiben vorerst: die Balken braucht die Sicht nicht zu
  liefern. Zusammenlegen, wenn das CRM die Verteilung mit anbietet.
- **`.env.example` liegt außerhalb von Git.** `.gitignore` schließt mit `.env*`
  auch die Vorlage aus, die eigentlich mitgehen soll. Wer dort eine Variable
  ergänzt, ergänzt sie nur lokal — beim nächsten Klon fehlt sie. Entweder
  `!.env.example` in die `.gitignore` und die Datei einchecken (sie enthält nur
  leere Platzhalter), oder die Datei löschen und die Variablenliste allein hier
  führen. Bis dahin: **neue Variablen immer auch im Handover nennen.**
- **Gewicht ohne Startpunkt:** Schickt der Kurzbefehl nur `weightTarget` ohne
  `weightStart`/`weightStartDate`, misst Jarvis ab Tag eins gegen das Endgewicht,
  statt ein Zwischenziel zu interpolieren. Bewusst so — soll das lieber
  „Ziel fehlt" sein, bis der Startpunkt da ist?
- **E-Mail: wann wird entworfen?** Empfehlung aus dem Review ist Warteschlange
  statt Sofort-Entwurf (Begründung unten). Rico hat sich noch nicht festgelegt.
- **E-Mail: wie weit darf Jarvis autonom senden?** Vorschlag: gar nicht ohne
  Freigabe, ausgenommen eine ausdrücklich freigeschaltete Klasse. Offen.
- **Private Mails ins Modell?** Geschäftlich und privat von Anfang an getrennte
  Konten; ob private Inhalte je in einen Prompt gehen, entscheidet Rico.

## Für nächsten Agent — Anschreiben

Rico will, dass **Jarvis** Mails schreibt und sendet, bewusst **nicht** das CRM.
Stufe 1 steht; hier die Leiter und die Entscheidungen, die schon gefallen sind.

**Drei Korrekturen am Review vom selben Tag — nicht in die alte Fassung zurückfallen:**

1. **Kein `ANTHROPIC_API_KEY`, und das ist nicht verhandelbar** (Rico, 21.09.).
   Die Richtung dreht sich um: **Claude ruft Jarvis**, nicht Jarvis eine API.
   Rico benutzt sein normales Abo, Jarvis wird über einen MCP-Server zum
   Werkzeug — genau wie das CRM es heute schon ist. Kein Modellaufruf im
   Jarvis-Code, keine laufenden Kosten. Fernziel ist eine Sprach-Kaskade auf
   derselben Grundlage.
2. **Das Postfach ist SMTP/IMAP, kein Google-Konto.** Damit ist das ganze
   OAuth-Thema für Mail vom Tisch. Zugangsdaten stehen noch aus.
3. **Vorlagen sind Gerüste, keine fertigen Mails.** Rico will individualisierte
   Anschreiben mit Ansprechpartner, Firma, Gesprächsdatum, Gesprächspartner und
   Thema als Kontext. Deshalb hat eine Vorlage **zwei** Hälften: `body` (Gerüst
   mit Platzhaltern, Weg ohne Modell) und `guidance` (Anweisung an Claude, vor
   allem: was *nicht* erfunden werden darf).

**Leiter:**

| Stufe | Inhalt | Stand |
|---|---|---|
| 1 | Warteschlange aus CRM-Aufgaben, Kontextfelder, Vorlagen, Kopieren/`mailto` | **fertig** (21.09.) |
| 2 | MCP-Server für Jarvis — Claude/ChatGPT liest die Warteschlange und schreibt Entwürfe zurück | **live** (06.10., `main`, Commit `97257b6`; ChatGPT-Plugin laut Rico erstellt, Funktionstest offen) |
| 3 | SMTP senden / IMAP lesen | wartet auf Ricos Postfach-Daten |
| 4 | Rückmeldung ans CRM über `nachricht_festhalten` (MCP) | offen |

**Der Arbeitsablauf, auf den das zuläuft** (Rico, 21.09.): im Gespräch im CRM
festhalten, dass eine Mail rausgehen muss → Jarvis zeigt sie abends in der
Warteschlange → Rico gibt frei → Jarvis sendet → das CRM bekommt den Eintrag.
Bewusst **nicht** mitten im Call-Block schreiben.

**Was Stufe 1 gebaut hat:** `scripts/mail-layer.sql` (läuft über
`npm run core:migrate` mit), Modelle `MailTemplate`/`MailDraft`,
`src/lib/mailTemplate.ts` (Platzhalter, rein — Server und Oberfläche teilen
sie), `MailService`, `CrmService.getLeadsForMail`, `src/actions/mail.ts`,
Seite `/mail`, Komponenten unter `src/components/mail/`.

**Der Lesevertrag bleibt unverletzt.** Stufe 4 schreibt über den MCP-Server des
CRM (`nachricht_festhalten`), nicht in `crm_*`. Das gehört in
`~/dev/Lightning CRM/docs/lesevertrag-jarvis.md`, sobald Stufe 4 steht — sonst
hält der nächste CRM-Agent den Vertrag für gebrochen.

**Die Adressen fehlen weiter** (gemessen 21.09.): 16 von 207 aktiven Leads haben
eine E-Mail, in `pitch`/`data`/`offer` 4 von 63. Alle drei Vorgänge in der
Warteschlange stehen ohne Adresse da. Das Nachziehen gehört ins CRM und ist
unabhängig von allen weiteren Stufen.

## Für nächsten Agent — Claude-Code-Anbindung

**Planungsupdate 06.10.:** `docs/chatgpt-voice-plan.md` prüft den aktuellen Code
und den Weg über ChatGPT Voice. Der MCP-Beschluss bleibt bestehen; ChatGPT ist
als zusätzlicher Client neben Claude vorgesehen. Erstes Ziel ist ein
authentifizierter, lesender Jarvis-MCP-Server. Lightning CRM hat bereits einen
getrennten MCP-Server. Die alten Voice-Hooks sind weiterhin verwaist.
**Übergabe an Claude:** `docs/CLAUDE-MCP-HANDOVER.md` enthält den vollständigen
Implementierungsauftrag samt Werkzeuge, OAuth, Tests und ChatGPT-Anbindung.
Rico meldet, dass eine gesprochene CRM-Leseabfrage vermutlich bereits klappt;
dieser Vorversuch muss nicht wiederholt werden. Jarvis ist live; das ChatGPT-
Plugin wurde laut Rico erstellt. Beim Review fiel auf, dass `MailService.setStatus()` die
dokumentierte Zustandsfolge noch nicht vollständig erzwingt; vor einem
MCP-Status-/Sende-Werkzeug beheben.

**Umsetzung 06.10. (Claude):** Server steht, siehe „Aktueller Stand" und
`docs/mcp-server.md`. Codex hat `feat/jarvis-mcp` nach 48 grünen Tests, Build
und Diff-Review per Fast-Forward auf `main` gebracht und gepusht. Vercel
Production enthält `JARVIS_MCP_SECRET` und `JARVIS_MCP_PUBLIC_URL` (indol-Adresse);
der Redeploy ist live. Produktionsprüfung: ohne Token `401`, OAuth-Metadaten
korrekt, vier Dashboard-Seiten `200`. Rico hat das Plugin in seinem privaten
ChatGPT-Konto nach eigener Angabe erstellt. Offen sind die Prüfung von
Installation/OAuth und der Text-/Sprachtest auf dem Handy. Claude muss für
dieses Ziel nicht verbunden werden. Zugangswort
niemals in Chat, Repo oder Logs schreiben.

**Verbindungsversuch:** Rico ist im privaten ChatGPT-Plus-Konto angemeldet.
Im Codex-internen Browser wurde das Formular „Add custom MCP server" mit
`Jarvis OS`, der indol-MCP-URL und OAuth ausgefüllt. ChatGPT meldete bei der
automatischen Erkennung „Couldn’t discover OAuth settings" und konnte seine
eigene Callback-URL nicht laden; auch „Retry" half nicht. Der Server lieferte
parallel beide öffentlichen Metadaten als JSON mit HTTP `200` und am MCP-Endpunkt
`401` mit `WWW-Authenticate`. Rico meldete anschließend, dass er das Plugin in
ChatGPT erstellt hat; die Codex-Browsersitzung konnte dies nicht verifizieren.
Text und Sprache sind weiterhin ungetestet.

Entscheidungen dabei:
- **Kein offizielles MCP-SDK.** `@modelcontextprotocol/sdk` 1.32 zieht Express,
  Hono und einen eigenen HTTP-Unterbau in die Next-App. Protokoll von Hand wie
  im CRM (`src/lib/mcp/protocol.ts`), Kompatibilität per MCP Inspector geprüft.
- **ChatGPT-Anforderungen** (am 06.10. in der OpenAI-Doku nachgelesen):
  Rücksprung `https://chatgpt.com/connector_platform_oauth_redirect` bzw.
  `…/connector/oauth/{id}`, PKCE S256 in den Metadaten, `iss` in jeder
  Antwort der Zustimmungsseite (RFC 9207), `resource` wird als Empfänger ins
  Zeichen übernommen. Alles umgesetzt; CIMD bewusst nicht (DCR reicht).
- **Eigenes Geheimnis, eigener Schlüssel.** CRM-Zeichen sind bei Jarvis
  ungültig — auch wenn jemand dasselbe Geheimnis wählt (Test vorhanden).
- **Bekannte Grenze:** ohne Datenbank kann ein OAuth-Code in seinen fünf
  Minuten nicht als verbraucht markiert werden; PKCE bindet ihn an den
  Connector. Sperren aller Zeichen: Geheimnis wechseln.

**⚠️ Befund fürs CRM (nicht hier lösen):** Der CRM-Anmelde-Server erlaubt als
Rücksprung nur `claude.ai`/`claude.com`/`anthropic.com`
(`Lightning CRM/api/_lib/oauth.js`, `rueckSprungErlaubt`). ChatGPT kann den
CRM-Connector damit **nicht** über OAuth verbinden. Ricos Eindruck, die
gesprochene CRM-Abfrage in ChatGPT klappe schon, sollte er am Plugin selbst
nachprüfen. Fix gehört ins CRM-Projekt: `chatgpt.com` zulassen und `iss` in
der Antwort mitschicken (so wie hier).

Claude Code wird später **direkt** in Jarvis OS integriert (Rico, 2026-09-09).
Der KI-Export-Button ist deshalb am 2026-09-10 entfernt worden. Keine Arbeit mehr
in einen Export-Flow stecken; die Fläche in der Shell bleibt für die echte
Anbindung frei.

**Festgelegt am 21.09.:** Der Weg ist **ein MCP-Server für Jarvis**, wie ihn das
CRM bereits hat — und *nur* der. Rico benutzt sein normales Claude-Abo; Claude
ruft Jarvis als Werkzeug auf. Ein Modellaufruf aus dem Jarvis-Code heraus
(`ANTHROPIC_API_KEY`) ist **ausdrücklich abgelehnt** und keine Rückfalloption.
Jarvis hat heute keine KI-Abhängigkeit im `package.json`, und das bleibt so.
Claude Code selbst wird nicht eingebettet — es ist ein Entwickler-Werkzeug,
keine Laufzeit. Auf derselben Grundlage soll später die Sprach-Kaskade laufen.

**Achtung, verwaister Code:** `src/lib/voice.ts`, `src/hooks/useTTS.ts` und
`src/hooks/useSpeechRecognition.ts` rufen `/api/jarvis/tts` auf — **diese Route
existiert im Repo nicht.** Die ElevenLabs-Anbindung sieht halb fertig aus, ist
aber tot. Vor jeder Sprach-Arbeit entweder wiederherstellen oder entfernen.

## Infrastruktur — Jarvis und CRM zusammen (Stand 09.10.2026)

Dieselbe Übersicht steht im CRM-Handover. Wer etwas daran ändert, zieht beide nach.

| Teil | Wo | Adresse / Stand |
|---|---|---|
| Jarvis OS | Vercel-Projekt `jarvis-os`, Repo `ricobusinessworkspace-web/jarvis-os`, Branch `main` | `https://jarvis-os-indol.vercel.app` (einzige Production-Domain, 06.10. bei Vercel geprüft) |
| Lightning CRM | Vercel-Projekt `calling-station`, Repo `ricobusinessworkspace-web/Lightning-CRM`, Branch `master` | `https://calling-station.vercel.app` |
| Datenbank | **ein** Supabase-Projekt `duzmanqvyhqurxlpxrrg` (London) für Jarvis, CRM und G-Projekt | Dev = Production, kostenloser Tarif ohne zurückspielbare Sicherung |
| Jarvis-MCP | `/api/mcp`, eigene OAuth, Geheimnis `JARVIS_MCP_SECRET` | **live**, antwortet ohne Anmeldung mit 401 (09.10. geprüft) |
| CRM-MCP | `/api/mcp`, eigene OAuth, Geheimnis `MCP_TOKEN` | live; OAuth erlaubt nur Claude-Rücksprünge → **ChatGPT kann sich dort nicht anmelden**, Fix gehört ins CRM |

**Wer redet mit wem:**
```
ChatGPT-App (Handy/Mac, Sprache) ─┬─> Jarvis-MCP ─> Jarvis-Services ─> Supabase (liest crm_* nach Lesevertrag)
Claude                            └─> CRM-MCP ────> crm_* (lesen und schreiben)
```
- ChatGPT/Claude rechnen nichts selbst und lesen keine Datenbank. Sie rufen
  Werkzeuge auf; Jarvis holt auch die CRM-Zahlen selbst aus der gemeinsamen
  Datenbank. Den CRM-Connector braucht es nur, um am CRM etwas zu **ändern**.
- Das Plugin wird einmal im Browser unter `chatgpt.com/plugins` eingetragen und
  gilt dann im selben Konto auch in der Handy-App. Privat- und Work-Konto sind
  getrennt; im Work-Konto muss eigene Plugins ggf. der Admin erlauben.
- **Bauen** (Codex, Claude Code) und **benutzen** (ChatGPT-App, Claude) sind
  getrennt. Jarvis wird abwechselnd von Codex und Claude gebaut, das CRM von
  Claude. Abgestimmt wird nur über die Handovers und den Lesevertrag.

**Zugangswort:** `JARVIS_MCP_SECRET` hat Claude am 06.10. erzeugt und bei Vercel
(Production) gesetzt, ohne es auszugeben. Eine Kopie liegt in
`~/jarvis-mcp-zugangswort.txt` (nur für Rico lesbar). Die Datei soll in den
Passwort-Manager und dann gelöscht werden. Sperren aller Verbindungen: Wert
bei Vercel ändern, neu veröffentlichen.

**Die Grenze zwischen den Projekten ist nur eine Absprache.** Jarvis meldet
sich als `postgres` an, für Jarvis gelten also keine Zugriffsregeln. „Jarvis
schreibt nie in `crm_*`" steht im Lesevertrag, verhindert wird es nicht.
Empfehlung (offen): eine eigene Datenbank-Rolle für Jarvis, die `crm_*` nur
lesen darf. Spätestens nötig, wenn das CRM verkauft wird. Dann braucht es
ohnehin ein eigenes Supabase-Projekt.

**Offene Sicherheitspunkte (am 06./09.10. von außen geprüft, von Rico zu entscheiden):**
- Beide GitHub-Repos sind **öffentlich**. In der Historie stehen ein altes
  DB-Passwort (Jarvis) und ein Google-Schlüssel (CRM). Ob beide inzwischen
  rotiert sind, ist nicht bestätigt.
- Das **Jarvis-Dashboard hat keinen Login**. `/`, `/health`, `/vertrieb` und
  `/mail` zeigen echte Daten für jeden, der die Adresse kennt.
- 11 Jarvis-Tabellen (`core_*`, `ingest_*`, `mail_*`) sind ohne Zugriffsregeln.
  Die CRM-Sicht `lead_timeline` umgeht die Regeln (Supabase-Prüfung vom 06.10.).
  Runbook: `~/dev/Lightning CRM/docs/ungeschuetzte-tabellen.md`.

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
  `DIRECT_URL` für Migrationen, `INGEST_SECRET` für die Apple-Kurzbefehle,
  `WIDGET_SECRET_TOKEN` für die iPhone-Widgets, `JARVIS_MCP_SECRET` (mind. 32
  Zeichen, eigenes Geheimnis) für den MCP-Server, optional
  `JARVIS_MCP_PUBLIC_URL` (feste Basisadresse = OAuth-Issuer)

## Vision & Langziel

**Assistenten-Zielbild (06.10.):** ChatGPT spricht mit Rico über Jarvis-Daten,
Wochenverlauf, Ziele und Mindset; Claude bleibt die Arbeitsoberfläche für das
Lightning CRM. Der vorgeschlagene Mailweg ist ChatGPT/Claude als Oberfläche →
ein Jarvis-Entwurf mit überprüfter Freigabe → ein Versanddienst → CRM-Rückmeldung.
Die Versandzuständigkeit ist vor Umsetzung mit Rico festzulegen; Details und
Alternativen stehen in `docs/assistant-vision.md`.

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
0. **Nächste Arbeit steht in `docs/plan-chatgpt-schreiben-und-motivation.md`**
   (09.10., Ricos Entscheidungen eingearbeitet): Sonntag als Joker für
   Regel-Serien, ChatGPT liest Phasen richtig und darf abhaken (Ursachen,
   Routine-Schritte, Regel-Rückfälle; nur heute/gestern; immer freigeschaltet),
   Motivationssystem in Gold (Ton, Tagesringe, perfekter Tag, Serienstufen,
   Ziele-Seite als Zielbild), Erinnerung per Kurzbefehl statt Web Push.
   Streak-Fix ist live (`95950af`).
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
5. **`/routines` und `/vertrieb` nicht kaputtmachen** — beides sind Tippziele der
   iPhone-Widgets (`docs/ios-widget.md`).
6. Befehle: `npm run core:check` (Daten prüfen), `core:migrate`, `core:seed`,
   `npm run build` (prüft auch Typen), `npm test` (Vitest — 62 Prüfungen,
   darunter MCP ohne Datenbank), `npm run test:e2e`
   (Playwright-Rauchtest gegen den Dev-Server — **Achtung, Dev = Production-DB**).
   Stand 09.10.: 100 Prüfungen.

## Dokumente

| Datei | Zweck | Lesen wann |
|---|---|---|
| `HANDOVER.md` | dieser — Stand, gelöste Probleme, offene Fragen | vor jeder Prompt |
| `README.md` | Einstieg für Menschen, Befehlsübersicht | einmal |
| `AGENTS.md` | Next.js-16-Warnung + Arbeitsablauf | Session-Start (via `CLAUDE.md`) |
| `DATENBANK_BRIEFING.md` | Performance-Analyse mit Messungen, Übergabe an DB-Agent | bei Performance-Fragen; danach archivierbar |
| `docs/apple-shortcuts.md` | iOS-Kurzbefehle für Erinnerungen, Health **und Zielwerte**; Sync-Zeitpunkte; nachträglich korrigieren | beim Einrichten der Apple-Anbindung |
| `docs/ios-widget.md` | beide iPhone-Widgets (Calls, Routine): Einrichtung und Technik | beim Anfassen der Widgets / `/routines` / `/vertrieb` |
| `docs/orb-animation.md` | Start-/Ladeanimation (Jarvis-Orb): Vertrag, Regeln, Zahlen, Portierung auf Lightning CRM, Abnahmeliste | beim Anfassen des Orbs oder wenn er ins CRM soll |
| `docs/bank-sync.md` | Bank-Sync über n8n | beim Anfassen des Bank-Imports |
| `docs/mcp-server.md` | MCP-Server: Adresse, Vercel-Variablen, ChatGPT/Claude verbinden, Testfragen, Fehlerbilder | beim Verbinden oder wenn der Connector klemmt |
| `docs/plan-chatgpt-schreiben-und-motivation.md` | Plan: ChatGPT-Schreibwerkzeuge, Datenbasis vor/nach Phase 2, Motivationssystem und Push; Reihenfolge und offene Entscheidungen | vor der nächsten größeren Arbeit |
| `docs/chatgpt-voice-plan.md`, `docs/CLAUDE-MCP-HANDOVER.md` | Planung und Auftrag für den MCP-Weg (Codex, 06.10.) | nur als Hintergrund — Stand steht hier |

`~/dev/coding-workflow-standards.md` (außerhalb des Repos) gilt projektübergreifend.
