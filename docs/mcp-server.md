# Jarvis-MCP-Server einrichten

Damit ChatGPT (auch per Sprache) und Claude mit Jarvis arbeiten können:
Tagesüberblick, Aufgaben, Routinen, Ziele und Mail-Warteschlange lesen,
Mail-Entwürfe speichern. **Senden und Freigeben geht nur in Jarvis selbst.**

Der Lightning-CRM-Connector bleibt davon getrennt und unverändert. Leads,
Anrufe und CRM-Änderungen laufen weiter über ihn.

**Die Adresse, die in das Feld „Server-URL" gehört:**

```
https://jarvis-os-indol.vercel.app/api/mcp
```

Am 06.10.2026 bei Vercel geprüft: das ist die einzige Production-Domain des
Projekts `jarvis-os`. Die alte `jarvis-os-wardogs.vercel.app` zeigt auf ein
SSO-geschütztes Alt-Deployment und funktioniert hier **nicht**.

---

## 1. Zugangswort erzeugen

Einmal erzeugen, nirgends im Repository ablegen (das Repository ist öffentlich):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**Nicht** das `MCP_TOKEN` des CRM wiederverwenden, auch nicht
`WIDGET_SECRET_TOKEN`, `INGEST_SECRET` oder `N8N_WEBHOOK_SECRET`.

## 2. Bei Vercel hinterlegen

Vercel → Projekt `jarvis-os` → Settings → Environment Variables:

| Name | Wert | Umgebung | Pflicht |
|---|---|---|---|
| `JARVIS_MCP_SECRET` | das Zugangswort aus Schritt 1 (mind. 32 Zeichen) | Production | ja |
| `JARVIS_MCP_PUBLIC_URL` | `https://jarvis-os-indol.vercel.app` | Production | empfohlen |

`JARVIS_MCP_PUBLIC_URL` nagelt die Adresse fest, unter der sich der Server
ausweist (der OAuth-„Issuer"). Ohne sie gilt die Adresse, unter der die Anfrage
ankam — funktioniert auch, hängt dann aber an einer Kopfzeile.

Danach neu veröffentlichen, sonst kennt die Serverfunktion die Variablen nicht.

**Ohne `JARVIS_MCP_SECRET` bleibt der Server zu** (`503`). Das ist Absicht.

## 3. In ChatGPT verbinden

1. Im Browser `https://chatgpt.com/plugins` öffnen → **+** → „Add custom MCP server".
2. Name: `Jarvis OS`, URL: siehe oben, Anmeldung: **OAuth**.
   Client-ID und Secret leer lassen — ChatGPT registriert sich selbst.
3. Risiko-Hinweis bestätigen. Es öffnet sich „Zugriff auf Jarvis OS erlauben?".
   Zugangswort eingeben → **Erlauben**.
4. Neue Unterhaltung, `@` tippen, Jarvis OS wählen, eine Testfrage stellen.
5. Danach in der ChatGPT-App per Sprache testen (siehe Testfragen).

Wird die Verbindung mit „redirect_uri" abgelehnt: in den erweiterten
Einstellungen des Plugins steht die Rücksprung-Adresse, die ChatGPT benutzt.
Erlaubt sind alle `https://chatgpt.com/…`-Adressen
(`rueckSprungErlaubt` in `src/lib/mcp/oauth.ts`).

## 4. In Claude verbinden

Claude → Einstellungen → Connectors → „Connector hinzufügen" → Name und URL,
sonst nichts. Zustimmungsseite wie oben.

Claude Code (ohne Anmeldeseite, Zugangswort direkt):

```bash
claude mcp add --transport http jarvis https://jarvis-os-indol.vercel.app/api/mcp --header "Authorization: Bearer DEIN_ZUGANGSWORT"
```

## 5. Prüfen

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://jarvis-os-indol.vercel.app/api/mcp
```

Erwartet `401` (nicht `503` — das hieße: Variable fehlt oder nicht neu veröffentlicht).

```bash
npx @modelcontextprotocol/inspector --cli https://jarvis-os-indol.vercel.app/api/mcp --transport http --header "Authorization: Bearer DEIN_ZUGANGSWORT" --method tools/list
```

Erwartet: sieben Werkzeuge (nach dem Refresh der ChatGPT-Verbindung).

---

## Werkzeuge

| Werkzeug | Art | Quelle im Code |
|---|---|---|
| `heute_ueberblick` | liest | `AnalyticsService.getMatrix` — dieselben Zahlen wie „Heute" |
| `jarvis_kontext` | liest | `DatenbasisService.metriken` / `datenluecken` — Handbuch: Phasen, je Kennzahl Quelle, Ziel heute, seit wann bewertet, was ein leerer Tag heißt, bekannte Lücken |
| `phasen_vergleich` | liest | `DatenbasisService.phasenVergleich` — je Phase und Kennzahl Quote, Abdeckung, beste Serie, `aussagekraeftig` (Abdeckung ≥ 0,7) |
| `tage_anzeigen` | liest | `DatenbasisService.tage` — tagesgenau, höchstens 31 Tage, mit Phase je Tag |
| `performance_wochenverlauf` | liest | `AnalyticsService.getMatrix` und `summarize` — bis zu 12 abgeschlossene Blockwochen plus laufende Woche, je Woche `datenqualitaet` („lueckenhaft" unter 0,5 Abdeckung) |
| `aufgaben_anzeigen` | liest | `TaskInboxService.getCrmTasksMitStatus`, `getReminders` |
| `routinen_anzeigen` | liest | `RoutineService.getRoutineBlocks` + Routine-Metriken |
| `ziele_anzeigen` | liest | `GoalService.getGoalsPage` — mit Herkunft Jarvis/CRM/Apple Health |
| `mail_warteschlange_anzeigen` | liest | `MailService.getQueueMitStatus`, `getLooseDrafts` |
| `mail_entwurf_speichern` | schreibt | `MailService.entwurfSpeichern` — nur Betreff und Text |

**Bewusst nicht dabei:** Freigeben, Senden, Löschen, Status ändern, Routinen
abhaken, irgendetwas am CRM. Vor einem Status- oder Sendewerkzeug muss
`MailService.setStatus()` die Zustandsfolge `offen → entwurf → freigegeben →
gesendet` erst erzwingen (heute prüft es nur Pflichtfelder).

## Testfragen (Text und Sprache)

- „Wie läuft mein Tag?" → `heute_ueberblick`
- „Wie lief meine Performance in den letzten vier Wochen?" → `performance_wochenverlauf`; Blockwochen sind Dienstag bis Montag, die laufende Woche ist unvollständig.
- „Wie lief der September im Vergleich zu dieser Woche?" → `jarvis_kontext` + `phasen_vergleich`; die Antwort nennt die Phasen und Datenlücken und wertet Phase 1 nicht als Leistungsabfall.
- „Wie sahen meine Tage vom 1. bis 5. Oktober aus?" → `tage_anzeigen`
- „Wie viele Calls habe ich heute, und was ist das Ziel?" → `heute_ueberblick`
- „Was steht an Aufgaben an?" → `aufgaben_anzeigen`
- „Wie weit bin ich mit der Abendroutine?" → `routinen_anzeigen`
- „Was sind meine Ziele?" → `ziele_anzeigen`
- „Welche Mails muss ich heute schreiben?" → `mail_warteschlange_anzeigen`
- „Schreib einen Entwurf für die erste Mail." → erst Warteschlange, dann
  `mail_entwurf_speichern` — ChatGPT fragt vor dem Speichern nach.

## Fehlerbilder

| Zeichen | Ursache |
|---|---|
| `503` an `/api/mcp` | `JARVIS_MCP_SECRET` fehlt, ist kürzer als 32 Zeichen oder nicht neu veröffentlicht |
| `401` trotz Anmeldung | Zeichen abgelaufen (8 h, wird still erneuert) oder Zugangswort gewechselt → Connector neu verbinden |
| `invalid_redirect_uri` beim Verbinden | Client nutzt eine Rücksprung-Adresse außerhalb von chatgpt.com/claude.ai/claude.com |
| `invalid_target` | Connector bittet um ein Zeichen für eine andere Adresse — URL im Connector prüfen |
| Antwort „nicht_erreichbar" | CRM-Abfrage gescheitert. Jarvis sagt das, statt „keine Aufgaben" zu behaupten |
| `302` auf `vercel.com/sso-api` | falsche Adresse (`-wardogs`), siehe oben |

**Alle Verbindungen sofort sperren:** `JARVIS_MCP_SECRET` bei Vercel ändern und
neu veröffentlichen. Jedes ausgestellte Zeichen ist damit wertlos.

## Technik in Kürze

- Transport „Streamable HTTP", zustandslos, nur JSON-Antworten
  (`src/lib/mcp/protocol.ts`). Von Hand statt mit dem offiziellen SDK — das SDK
  bringt Express und Hono in die Next-App. Kompatibilität mit dem offiziellen
  MCP Inspector ist geprüft.
- OAuth 2.1 ohne Datenbank (`src/lib/mcp/oauth.ts`): Selbst-Registrierung
  (RFC 7591), PKCE S256, Issuer-Kennung `iss` (RFC 9207, damit ChatGPT seine
  feste Rücksprung-Adresse nutzt), Zeichen mit Empfänger und Aussteller.
  CRM-Zeichen sind hier ungültig, auch bei gleichem Geheimnis.
- Einzelplatz: Nutzer ist fest `Rico` (`NUTZER` in `src/lib/mcp/tools.ts`),
  nie ein Werkzeug-Parameter.
- Tests: `npm test` (OAuth, Protokoll, Mail-Entwurf gegen eine Datenbank im
  Speicher — nie gegen Supabase).
