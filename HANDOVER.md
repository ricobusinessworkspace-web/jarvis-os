---
last_updated: 2026-09-25
last_agent: Claude Opus 5 — Orb ausgebaut, Sprung in der TopBar behoben
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
- **Jarvis-Orb** (24.09.): **fertig.** Der Drahtgitter-Ball aus dem App-Icon
  als ein Bauteil (`JarvisOrb`) mit zwei Auftritten:
  **Startsequenz** (`BootSplash` im Root-Layout) beim Laden und Neuladen, und
  **Ladezustand** (`(dashboard)/loading.tsx`) beim Reiter-Wechsel — eine Datei
  für alle sechs Reiter, die Seitenleiste bleibt dabei stehen.
  Beide enden an einem **echten Ereignis**, nicht nach Stoppuhr: die
  Startsequenz, wenn das Dokument fertig ist (`load` → `data-booted`, gesetzt
  von einem Inline-Skript im Layout, mit harter Obergrenze 4 s); der
  Ladezustand, wenn React die fertige Seite einsetzt.
  Die Drehung ist gerechnet: CSS animiert `rx` der Längenkreise
  (`R · cos φ`) statt das Bild zu kippen — ein gedrehtes flaches SVG würde
  stauchen statt zu rotieren. Knoten sitzen nur auf Breitenkreisen, weil die
  bei jeder Drehung gültig bleiben. `vector-effect: non-scaling-stroke`, sonst
  ist derselbe Strich beim kleinen Orb halb so dick und verschwindet im Schein.
  Dazu (25.09.): Masse im Inneren, zwei gegenläufige Orbitalringe mit
  Partikeln, drei nach außen laufende Wellen, ein Lichtpuls am Rand und ein
  Abgang, der kurz anzieht und heller wird statt flach auszublenden.
  **Kein JavaScript im Orb selbst.**
  *Ersetzt das frühere Skelett-`loading.tsx`* (graue Platzhalterkästen, aus dem
  Electron→Next-Umzug); es liegt in der Historie unter `54f08a4`.
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
  das Inline-Skript nimmt sie nach spätestens 4 s auf jeden Fall weg, und der
  Schleier hat `pointer-events: none`, ist also nie im Weg. Der alte
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

## Gelöste Probleme (nicht wiederholen)

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
- **Einstellungs-Oberfläche für Intentionen** fehlt noch. `AnalyticsService
  .getIntentions()` liefert die Daten, es gibt aber keine Seite, auf der Rico das
  Schlafziel (6/8) oder die Toleranzen (`tolerancePct` 10 %, `toleranceKg` 1,5)
  ohne Seed ändern kann. Nächster naheliegender Schritt.
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
| 2 | MCP-Server für Jarvis — Claude liest die Warteschlange und schreibt Entwürfe zurück | offen |
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
  `WIDGET_SECRET_TOKEN` für die iPhone-Widgets

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
5. **`/routines` und `/vertrieb` nicht kaputtmachen** — beides sind Tippziele der
   iPhone-Widgets (`docs/ios-widget.md`).
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
| `docs/ios-widget.md` | beide iPhone-Widgets (Calls, Routine): Einrichtung und Technik | beim Anfassen der Widgets / `/routines` / `/vertrieb` |
| `docs/bank-sync.md` | Bank-Sync über n8n | beim Anfassen des Bank-Imports |

`~/dev/coding-workflow-standards.md` (außerhalb des Repos) gilt projektübergreifend.
