# ChatGPT Voice als Sprachzugang für Jarvis OS

Stand: 2026-10-06. Planungsstand, noch keine Implementierung.
Der konkrete Arbeitsauftrag für Claude steht in `docs/CLAUDE-MCP-HANDOVER.md`.

## Ziel und bestehende Festlegungen

Rico spricht in der ChatGPT-App mit einem Assistenten, der aktuelle Jarvis-Daten
lesen und ausgewählte Aufgaben ausführen kann. Jarvis bleibt die fachliche Quelle
für eigene Daten; das CRM bleibt die Quelle für Leads, Anrufe und CRM-Aufgaben.

Der bisherige Beschluss in `HANDOVER.md` bleibt erhalten: Jarvis ruft kein
Sprachmodell per API auf und speichert keinen Modell-API-Schlüssel. Stattdessen
ruft der Assistent Jarvis über MCP-Werkzeuge auf. ChatGPT ist ein zusätzlicher
Client zum ursprünglich vorgesehenen Claude-Zugang. Die Sprachoberfläche läuft
in ChatGPT, nicht im Jarvis-Dashboard.

## Ist-Zustand aus der Codebasis

- Jarvis OS ist eine Next.js-App auf Vercel mit Prisma und gemeinsamer
  Supabase-Datenbank. Die Fachlogik liegt überwiegend unter
  `src/core/services/`, darunter `AnalyticsService`, `TaskInboxService`,
  `RoutineService`, `GoalService` und `MailService`.
- Ein Jarvis-MCP-Endpunkt und eine eigene MCP-Anmeldung fehlen. Die vorhandenen
  Widget-, Apple- und n8n-Tokens sind zweckgebunden und kein geeigneter
  ChatGPT-Zugang.
- `src/lib/voice.ts`, `src/hooks/useTTS.ts` und
  `src/hooks/useSpeechRecognition.ts` sind verwaist. `voice.ts` ruft
  `/api/jarvis/tts` auf, aber diese Route existiert nicht. Diese Dateien sind
  keine fertige Jarvis-Sprachlösung.
- CRM-Metriken und Ziele werden von Jarvis über den dokumentierten Lesevertrag
  aus der gemeinsamen Datenbank gelesen. Für CRM-Schreibvorgänge ist der
  CRM-eigene MCP-Server zuständig, nicht ein direkter Jarvis-Schreibzugriff auf
  `crm_*`.
- Lightning CRM hat bereits `api/mcp.js` mit lesenden und schreibenden Tools,
  HTTPS-Transport und OAuth. Das ist eine Vorlage für Protokoll und Anmeldung,
  aber kein Ersatz für Jarvis-spezifische Werkzeuge.
- Die bestehende Jarvis-Oberfläche hat keine allgemeine nutzerbezogene
  Autorisierung für einen neuen privaten MCP-Endpunkt. Diese Grenze muss vor
  Freigabe produktiver Daten ausdrücklich geschlossen werden.
- Das alte `jarvis_comparison_analysis.md` beschreibt einen früheren Stack mit
  Voice-CLI und Llama/Groq. Es ist kein verlässlicher aktueller Implementierungsplan;
  maßgeblich sind `HANDOVER.md` und der gegenwärtige Code.

## Produktweg

1. **Sofort nutzbarer Vorversuch:** Den bestehenden Lightning-CRM-MCP-Server in
   ChatGPT als privates Plugin verbinden und in einer Sprachunterhaltung eine
   reine Leseabfrage testen. Das beweist Account-Freischaltung, OAuth, Tool-Aufruf
   und Verhalten von Voice im tatsächlichen Konto, ohne Jarvis-Code zu ändern.
   Der private MCP-Server wird zuerst über ChatGPT im Web hinzugefügt; danach
   kann das installierte Plugin auf unterstützten Sprachoberflächen genutzt
   werden. Verfügbarkeit hängt vom Konto und ggf. Workspace-Einstellungen ab.
   **Update 06.10.: Rico glaubt, dass die gesprochene CRM-Leseabfrage bereits
   funktioniert.** Für die weitere Planung gilt dieser Schritt als erledigt;
   die Jarvis-Verbindung muss separat gebaut und geprüft werden.
2. **Jarvis-MCP bauen:** Einen eigenen, authentifizierten Streamable-HTTP-Endpunkt
   im Jarvis-Projekt veröffentlichen. Erste Werkzeuge sind nur lesend:
   `heute_ueberblick`, `aufgaben_anzeigen`, `routinen_anzeigen`,
   `ziele_anzeigen` und `mail_warteschlange_anzeigen`. Antworten sollen knapp,
   strukturiert und sprechbar sein, mit Datenstand und klarer Unterscheidung
   zwischen null, nicht gemessen und nicht erreichbar.
3. **ChatGPT anbinden:** Den Jarvis-Endpunkt als eigenes privates MCP-Plugin
   installieren. CRM und Jarvis sind zwei getrennte Plugins. Ein kurzer
   Assistenten-Kontext legt fest, welche Quelle für welche Frage gilt und dass
   der Assistent bei fehlenden Daten nichts erfindet. Test mit gesprochenen
   Fragen auf Desktop und iPhone.
4. **Schreibaktionen einzeln ergänzen:** Zuerst risikoarme Aktionen wie einen
   Jarvis-Routinenschritt abhaken oder einen Mail-Entwurf speichern. Jede Aktion
   braucht validierte Parameter, klare Zuordnung, Ergebnis und Wiederholschutz.
   Mailversand bleibt an den bestehenden Zustand `freigegeben` gebunden und
   bekommt erst nach SMTP/IMAP-Implementierung einen eigenen Ablauf. CRM-
   Änderungen laufen über den CRM-MCP-Server.
5. **Späterer Ausbau:** Proaktive Anstöße, Gesprächsgedächtnis oder eigene
   Sprachoberfläche erst planen, wenn der Werkzeugweg zuverlässig läuft. Ein
   eigener Realtime-API-Client wäre ein anderes Produkt mit API-Kosten und
   würde die bisherige Entscheidung gegen Modellaufrufe in Jarvis ändern.

## Technische Leitplanken

- MCP-Werkzeuge rufen bestehende Services auf. Keine zweite Berechnung von
  Kennzahlen und keine direkten Writes in fremde Tabellen.
- Pro MCP-Request Identität und Berechtigung prüfen. Für einen privaten
  ChatGPT-Connector OAuth mit auf Jarvis begrenztem Token und korrekter
  Audience verwenden; CRM-Token nicht wiederverwenden. Secret-Ausfall muss
  geschlossen bleiben. Nie Widget- oder n8n-Token als allgemeines MCP-Token
  benutzen.
- Schreibwerkzeuge separat freischalten; Tool-Metadaten, Eingabevalidierung,
  Bestätigung im ChatGPT-Client und serverseitige Zustandsprüfung kombinieren.
  Bei vorgelesenen E-Mails und CRM-Texten mit fremdem Inhalt rechnen; dieser
  Inhalt darf keine Werkzeuganweisungen überschreiben.
- Vor einem Status-Werkzeug für Mails die tatsächliche Zustandsprüfung in
  `MailService.setStatus()` vervollständigen: derzeit werden die dokumentierten
  Übergänge nicht erzwungen.
- Serverlogik ohne produktive Testeinträge prüfen. Die lokale Entwicklung nutzt
  dieselbe Datenbank wie Production. Für Datenbankänderungen die bestehenden
  Migrationsskripte verwenden, nie `prisma db push`.
- Bei der Implementierung die Next.js-16-Dokumentation in `node_modules` lesen.
  Über den Supabase-Pooler Abfragen sequenziell halten, wie auf der Heute-Seite.

## Abnahme je Meilenstein

1. CRM-Plugin: Gesprochene Frage nach einem Lead liefert echte Daten. Ein
   Schreibablauf wird erst mit Testdaten oder einem kontrollierten, ausdrücklich
   gewünschten echten Vorgang geprüft; eine verweigerte Freigabe darf nichts
   ändern.
2. Jarvis-Lesezugang: MCP-Inspector verbindet sich mit gültiger Anmeldung;
   ungültige Anmeldung wird abgewiesen; jede Leseabfrage liefert erwartete
   Quellen, Datenstand und Zustände. Gesprochene Fragen nach Calls, Aufgaben,
   Routinen und Mail-Warteschlange treffen das richtige Tool.
3. Jarvis-Schreibzugang: Gültiger Befehl schreibt genau einmal; ungültige ID,
   veralteter Stand, wiederholter Aufruf oder verweigerte Freigabe schreiben
   nichts. Anschließend stimmen Dashboard und MCP-Antwort überein.

## Offene Produktentscheidung

Für die erste Version ist **ChatGPT Voice als Oberfläche + zwei getrennte
MCP-Plugins** die Empfehlung. Zu klären ist nur, welche Jarvis-Schreibaktionen
Rico nach dem Lesezugang tatsächlich per Sprache erlauben möchte. Der
CRM-Lesevertrag und die bisherige Mail-Freigabe geben bereits die Grenzen für
CRM und Versand vor.

## Aktuelle OpenAI-Quellen

- ChatGPT Voice und Plugins: https://help.openai.com/en/articles/20001274-chatgpt-voice
- Voice in der Desktop-App: https://learn.chatgpt.com/docs/features/voice
- Plugins in ChatGPT: https://learn.chatgpt.com/docs/plugins
- Eigenen MCP-Server verbinden: https://developers.openai.com/api/docs/guides/custom-mcp-server
- MCP-Plugin verbinden und testen: https://developers.openai.com/plugins/deploy/connect-chatgpt
