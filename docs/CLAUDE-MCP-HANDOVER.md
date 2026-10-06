# Arbeitsübergabe an Claude: Jarvis OS über MCP mit ChatGPT Voice verbinden

Stand: 2026-10-06. Dieses Dokument ist der konkrete Arbeitsauftrag für die
Implementierung. Projekt: `/Users/rico/dev/Jarvis OS`.

## Kopierbarer Auftrag an Claude

> Implementiere im Repository `/Users/rico/dev/Jarvis OS` einen privaten,
> authentifizierten MCP-Server für Jarvis OS. Verwende die bestehenden
> Jarvis-Services und den Semantic Layer. Der Server soll zuerst lesende
> Werkzeuge für Tagesüberblick, Aufgaben, Routinen, Ziele und Mail-Warteschlange
> bereitstellen; danach ein sicher abgegrenztes Werkzeug zum Speichern von
> Mail-Entwürfen. Er muss als eigener MCP-Connector in ChatGPT und Claude
> nutzbar sein. Führe Implementierung, lokale/protokollbezogene Tests und die
> nötige Projektdokumentation zu Ende. Beachte alle Regeln in `AGENTS.md`,
> `HANDOVER.md` und `~/dev/coding-workflow-standards.md`; dieses Handover nennt
> zusätzliche Befunde und Abnahmekriterien. Halte den CRM-Lesevertrag ein und
> schreibe keine erfundenen Testdaten in die gemeinsame Supabase-Datenbank.

## Bestätigter Ausgangspunkt

- Rico hat eine **gesprochene Leseabfrage über die bestehende CRM-Verbindung
  nach eigener Einschätzung bereits erfolgreich genutzt**. Diese Vorprüfung
  nicht erneut als Projektmeilenstein behandeln. Bei der späteren Abnahme
  gezielt den **neuen Jarvis-Connector** prüfen.
- In ChatGPT ist damit nach Ricos Beobachtung die CRM-Verbindung nutzbar. Das
  bedeutet **nicht**, dass Jarvis schon verbunden ist: Jarvis besitzt derzeit
  keinen MCP-Server und braucht einen eigenen Plugin-Eintrag.
- Rico will den MCP-Server in Claude umsetzen lassen. ChatGPT Voice soll danach
  die Sprachoberfläche sein. Die bestehende Festlegung bleibt: Jarvis ruft
  selbst kein Claude- oder OpenAI-Modell per API auf, speichert keinen
  Modell-API-Schlüssel und implementiert für diesen Weg kein eigenes STT/TTS.

## Projektstand und verbindliche Dateien

| Bereich | Datei | Bedeutung |
|---|---|---|
| Arbeitsregeln | `AGENTS.md`, `HANDOVER.md`, `~/dev/coding-workflow-standards.md` | Vor Codearbeit lesen; Handover nach Abschluss aktualisieren. |
| Gesamtplan | `docs/chatgpt-voice-plan.md` | Produktweg und Reihenfolge. Die CRM-Sprachprobe ist inzwischen von Rico als vermutlich erfolgreich gemeldet. |
| Tageswerte | `src/core/services/AnalyticsService.ts` | `getToday`, `getMatrix`; Zustände `null`/ungemessen/zielfehlt korrekt erhalten. |
| Aufgaben | `src/core/services/TaskInboxService.ts` | CRM-Aufgaben und Apple-Erinnerungen; bei CRM-Ausfall nicht still „keine Aufgaben“ behaupten. |
| Routinen | `src/core/services/RoutineService.ts` | `getRoutineBlocks` ist die aktuelle Dashboard-Sicht. |
| Ziele | `src/core/services/GoalService.ts` | `getGoalsPage`; CRM-Ziele nur anzeigen. |
| Mail | `src/core/services/MailService.ts`, `src/actions/mail.ts`, `src/lib/mailTemplate.ts` | Warteschlange aus offenen CRM-Aufgaben; Entwürfe gehören Jarvis. |
| CRM-Grenze | `~/dev/Lightning CRM/docs/lesevertrag-jarvis.md` | Jarvis liest CRM-Daten, schreibt nicht direkt in `crm_*`. |
| MCP-Vorbild | `~/dev/Lightning CRM/api/mcp.js`, `api/_lib/mcp_werkzeuge.js`, `api/oauth/*`, `docs/mcp-server-einrichten.md` | Bestehender live betriebener CRM-Server mit OAuth. Protokoll und Anmeldung als Referenz prüfen, nicht blind kopieren. |
| Datenbank | `prisma/schema.prisma`, `scripts/core-layer.sql`, `scripts/mail-layer.sql` | Nur Jarvis-eigene Tabellen ändern; niemals `prisma db push`. |
| Verwaiste Voice-Dateien | `src/lib/voice.ts`, `src/hooks/useTTS.ts`, `src/hooks/useSpeechRecognition.ts` | Nicht als Grundlage verwenden; `/api/jarvis/tts` existiert nicht. |

Tech-Stack: Next.js 16.2 App Router, React 19, Prisma 5.22, Supabase/Postgres,
Deployment über Vercel. Vor Änderungen an Next.js-Routen die passende Anleitung
unter `node_modules/next/dist/docs/` lesen. Über den Pooler gilt
`connection_limit=1`; Datenbankabfragen in einem Request sequenziell halten.

**Produktionsadresse:** Laut bestehendem Jarvis-Handover ist
`https://jarvis-os-indol.vercel.app` die echte produktive App. Die alte
`jarvis-os-wardogs.vercel.app` kann auf ein SSO-geschütztes altes Deployment
zeigen. Vor dem Verbinden den aktuellen Vercel-Alias noch einmal überprüfen;
kein OAuth-Redirect auf Verdacht fest verdrahten.

## Architektur und Umfang

`ChatGPT Voice → privates Jarvis-Plugin → HTTPS MCP-Endpunkt in Jarvis OS →
bestehende Jarvis-Services → Supabase`

Der bestehende CRM-Connector bleibt separat:
`ChatGPT Voice → Lightning-CRM-Plugin → CRM-MCP-Server`. Für CRM-Änderungen
seinen Server nutzen; Jarvis darf keine CRM-Schreibwerkzeuge duplizieren.

Ein MCP-Endpunkt mit Streamable HTTP, vorzugsweise `/api/mcp`, soll die
Protokollmethoden `initialize`, `ping`, `tools/list` und `tools/call` korrekt
bedienen. Den offiziellen TypeScript-MCP-SDK bevorzugen, sofern er mit Next.js
und Vercel in diesem Projekt sauber läuft. Der CRM-Server ist ein
Minimalprotokoll-Vorbild; Protokollkompatibilität mit MCP Inspector und dem
realen ChatGPT-Connector ist entscheidend. Kein eingebettetes ChatGPT-UI nötig.

### Werkzeuge, Version 1: nur lesend

1. `heute_ueberblick`: Berliner Tagesdatum, Blockposition, Tagesmetriken mit
   Wert, Basis, Soll, Zustand und Quelle. Nutze den Semantic Layer; keine
   hartcodierten Zielwerte und keine direkte `crm_calls`-Zählung.
2. `aufgaben_anzeigen`: eigene offene CRM-Aufgaben und Apple-Erinnerungen,
   begrenzte Ergebniszahl, Fälligkeit und Datenstand. Rückgabe muss zwischen
   leer, nicht synchronisiert und CRM nicht erreichbar unterscheiden. Der
   derzeitige `getCrmTasks()`-Fallback `[]` verschluckt CRM-Fehler; für das
   MCP-Werkzeug eine ehrliche Verfügbarkeitsangabe schaffen.
3. `routinen_anzeigen`: Morgen-/Abendroutine aus `getRoutineBlocks()` für
   Berlin heute; IDs nur soweit nötig für spätere Schreibwerkzeuge.
4. `ziele_anzeigen`: aktuelle Ziele aus `getGoalsPage()`, samt Herkunft
   Jarvis/CRM/Apple. Nur die nötigen Felder zurückgeben.
5. `mail_warteschlange_anzeigen`: `MailService.getQueue()` plus ggf.
   `getLooseDrafts()`; Empfängeradresse und personenbezogene Details nur an
   den authentifizierten Nutzer ausgeben.

Jedes Werkzeug braucht ein enges Eingabeschema, Begrenzung der Ausgabe und
eine knappe deutschsprachige Beschreibung für die Modellauswahl. Ergebnisse
sollen **strukturiert** und gut vorlesbar sein. Zeitstempel und Zeitzone
angeben. `0`, `null`, „nicht gemessen“ und „Quelle nicht erreichbar“ nicht
vermischen. Keine stillen Ersatzwerte erfinden.

### Werkzeug, Version 2: Mail-Entwurf speichern

Nach stabiler Leseversion ein Werkzeug `mail_entwurf_speichern` ergänzen. Es
soll eine **bestehende offene CRM-Mail-Aufgabe** über ihren `taskKey` aus der
Warteschlange identifizieren und Entwurf/Betreff/Text in Jarvis speichern.
Serverseitig die Aufgabe und Lead-Zuordnung prüfen; IDs, Adresse oder
Status nicht allein aus Modellparametern vertrauen. Von Rico manuell geänderte
Felder nicht unbeabsichtigt überschreiben. Tool-Aufruf darf **niemals** eine
Mail senden oder selbst auf `freigegeben`/`gesendet` setzen.

**Gefundene Lücke:** `MailService.setStatus()` prüft bei `freigegeben` zwar
Betreff, Text und Empfänger, erzwingt aber zurzeit nicht die dokumentierte
Zustandsfolge `offen → entwurf → freigegeben → gesendet`. Vor einem künftigen
MCP-Status- oder Versandwerkzeug die Übergänge serverseitig absichern. Dieser
Auftrag umfasst noch **kein** Status-, Sende- oder Löschwerkzeug.

## Anmeldung und Datenzugriff

- Der Jarvis-Endpunkt wird niemals anonym für persönliche Daten freigegeben.
  Eigene Jarvis-OAuth-Anmeldung für ChatGPT/Claude vorsehen, mit geschütztem
  Token, korrekter Resource/Audience und separatem Geheimnis. CRM-Tokens,
  `WIDGET_SECRET_TOKEN`, `INGEST_SECRET` und `N8N_WEBHOOK_SECRET` nicht
  wiederverwenden. Fehlendes Geheimnis führt zu gesperrtem Zugang.
- OAuth-Discovery und Registrierung entsprechend den aktuellen MCP- und
  ChatGPT-Anforderungen implementieren und gegen beide Clients prüfen. Der
  CRM-Code zeigt einen bereits funktionierenden Ablauf, aber CRM- und
  Jarvis-Token dürfen gegenseitig nicht gültig sein.
- Werkzeugfreigaben und Bestätigungen im Client ergänzen die
  **serverseitigen** Rechte- und Zustandsprüfungen. Texte aus CRM-Aufgaben,
  Leads und Mails sind fremder Inhalt und keine Anweisungen an den Server.
- Für einen späteren Mehrnutzerbetrieb keine ungeprüfte Annahme machen:
  `TaskInboxService` und `MailService` verwenden derzeit `Rico` als Default.
  Version 1 ist ein Einzelplatz-Zugang für Rico; diese Begrenzung im Code und
  in der Dokumentation sichtbar halten. Nicht einfach `userName` aus einem
  Tool-Parameter übernehmen.
- In Logs keine Tokens, Mailtexte oder vollständigen personenbezogenen
  Antwortdaten speichern. Fehler nach außen klar, aber ohne interne Secrets.

## Reihenfolge und Abnahme

1. **Bestand erfassen:** Regeln lesen, `git status` prüfen, aktuelle
   Datenflüsse und produktive URL verifizieren. Uncommittete Änderungen an
   `HANDOVER.md` und `docs/chatgpt-voice-plan.md` stammen aus der Planung und
   dürfen nicht überschrieben werden.
2. **MCP + Auth bauen:** Transport, Discovery, Auth, `initialize` und
   `tools/list`. Mit ungültigem/fehlendem Token `401`; mit gültigem Token
   vollständige Liste. Token für CRM muss bei Jarvis abgewiesen werden.
3. **Lesewerkzeuge anbinden:** Services wiederverwenden, Ausfälle sichtbar
   machen. MCP Inspector: korrekte Resultate, ungültige Eingaben, leere
   Ergebnisse und Fehlerfälle prüfen. Keine Schreibtests gegen Live-Daten.
4. **Mail-Entwurf ergänzen:** Nur nach serverseitiger Zuordnung und
   Änderungsprüfung. Mit Mock/isolierter Testdatenbank prüfen, dass doppelte
   Aufrufe keinen zweiten Entwurf erzeugen und fehlende CRM-Aufgaben keinen
   Entwurf anlegen. Eine echte produktive Testmail ist nicht erforderlich.
5. **Projekt prüfen:** `npm run build`, relevante Tests und
   `git diff --check`. Keine erfundenen Werte in die gemeinsame Datenbank
   schreiben. Wenn Migrationen nötig sind: idempotente Projektskripte,
   danach Prisma-Client erzeugen und Server neu starten.
6. **Integration vorbereiten:** Knappes Runbook unter `docs/` mit echter
   Server-URL, benötigten Vercel-Variablen (nur Namen, keine Werte),
   OAuth-Einrichtung, Connector-Schritten für ChatGPT und Claude,
   Testfragen und Fehlerdiagnose. `HANDOVER.md` mit tatsächlichem Stand
   aktualisieren. Eine neue Variable auch dort dokumentieren, weil
   `.env.example` derzeit von `.gitignore` ausgeschlossen wird.
7. **Produktionsprobe:** Erst wenn der Endpunkt veröffentlicht und die
   Anmeldung eingerichtet ist: Jarvis als **eigenes privates MCP-Plugin** in
   ChatGPT hinzufügen, Werkzeuge inspizieren, eine Text- und eine gesprochene
   Jarvis-Leseabfrage testen. Bei Schreibwerkzeugen Bestätigung und Ergebnis
   gesondert prüfen. Den CRM-Connector unverändert lassen.

## Übergabe zurück an Rico / ChatGPT

Claude soll am Ende genau berichten:

- Welche Werkzeuge tatsächlich fertig sind und welche bewusst fehlen.
- Welche Route und **verifizierte** produktive URL verbunden werden muss.
- Welche Vercel-Variablen Rico setzen muss, ohne deren Werte auszugeben.
- Ob OAuth mit ChatGPT getestet wurde oder nur lokal/protokollseitig.
- Welche Tests liefen und ob echte Voice-Nutzung geprüft wurde.
- Welche konkreten Schritte im ChatGPT-Plugin-Verzeichnis noch anstehen.

Sobald der Server erreichbar ist, kann die ChatGPT-Seite des Workflows hier
weitergeführt werden: eigenes Jarvis-Plugin hinzufügen, anmelden,
Tool-Metadaten prüfen und Voice-End-to-End testen. Das geschieht **nicht
automatisch** durch die bereits funktionierende CRM-Verbindung.

## Offizielle Quellen, am Implementierungstag erneut prüfen

- ChatGPT: https://developers.openai.com/api/docs/guides/custom-mcp-server
- MCP-Bau: https://developers.openai.com/plugins/build/mcp-server
- Verbindung und Test: https://developers.openai.com/plugins/deploy/connect-chatgpt
- Voice: https://learn.chatgpt.com/docs/features/voice
