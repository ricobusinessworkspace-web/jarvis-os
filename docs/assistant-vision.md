# Jarvis, ChatGPT und Claude: Zielbild

Stand: 06.10.2026. Dieses Dokument beschreibt die empfohlene Rollenverteilung und die Reihenfolge der nächsten Schritte.

## Entscheidung

**Jarvis ist die Daten- und Aktionsschicht für persönliche Performance.** Das Dashboard und sein Semantic Layer bleiben die Quelle für Ziele, Routinen, Gesundheit, Tages- und Wochenverlauf. ChatGPT ist Ricos Gesprächsoberfläche für Rückblick, Reflexion, Planung und später eng begrenzte Jarvis-Aktionen. Es erhält diese Daten über Jarvis-MCP; es speichert keine zweite Wahrheit.

**Lightning CRM bleibt das Arbeitssystem für Vertrieb.** Claude ist Ricos Oberfläche für Lead-Recherche, Pflege, Vertriebsarbeit und kontextuelle E-Mail-Entwürfe im CRM. Jarvis liest die nötigen CRM-Daten über die vorhandenen Verträge, verändert CRM-Daten aber nur über ausdrücklich dafür vorgesehene Schnittstellen. Eine zweite, breite CRM-Verbindung in ChatGPT bringt für diesen Arbeitsstil wenig Nutzen und erhöht die Zahl der möglichen Schreibwege.

**E-Mail ist ein gemeinsamer Ablauf mit genau einem Versandweg.** Die bestehende Jarvis-Warteschlange und ihre Entwürfe sind der geplante Ort für Freigabe und Versand. Claude kann CRM-Kontext für den Text liefern; ChatGPT kann den konkreten Entwurf vorlesen, besprechen und später den Versand anstoßen. Beide Assistenten benutzen dafür dieselben Backend-Zustände. Sie müssen nicht direkt miteinander sprechen.

## E-Mail-Optionen

| Weg | Vorteil | Nachteil | Einordnung |
|---|---|---|---|
| ChatGPT direkt mit dem gesamten CRM-MCP verbinden | Schnell für vorhandene CRM-Aktionen | Doppelte Vertriebsoberfläche, mehr Schreibrechte, Versandzustand verteilt | Für Ricos Arbeit derzeit nicht nötig |
| ChatGPT an Claude weiterreichen lassen | Claude kann seine CRM-Fähigkeiten nutzen | Zusätzlicher Agentendienst, unklare Zuständigkeit für Freigabe, Fehler und Wiederholungen | Keine sinnvolle erste Ausbaustufe |
| ChatGPT → Jarvis-MCP → Jarvis-Maildienst; CRM erhält danach einen Eintrag | Ein Versandzustand, nachvollziehbare Freigabe, dieselbe Warteschlange in App und Sprache | SMTP/IMAP und CRM-Rückmeldung müssen noch gebaut werden | Empfohlener Zielweg |

Bis der Jarvis-Maildienst sendet, kann ChatGPT Warteschlange und Entwürfe lesen und einen Entwurf speichern. „Senden“ ist heute kein Jarvis-MCP-Werkzeug. Der von Rico beschriebene Versand über Claude/CRM ist ein bestehender separater Weg; dessen genaue Zustands- und Freigaberegeln sind hier nicht geprüft.

## Reihenfolge

1. **Performance vollständig lesen:** Wochenverlauf im Jarvis-MCP ergänzen, in ChatGPT aktualisieren und per Text und Sprache testen. Die laufende Woche muss als unvollständig erkennbar sein; fehlende Messwerte dürfen nicht als Null gelten.
2. **Kleine Jarvis-Aktionen:** Routinen für ein ausdrücklich genanntes Datum und einen ausdrücklich genannten Block abhaken, mit idempotentem Service und sichtbarem Ergebnis. Erst nach Prüfung der bestehenden Routine-Datenstruktur. Keine pauschale Schreibfreigabe für andere Systeme.
3. **Mail lesen und freigeben:** Den konkreten Entwurf mit Empfänger, Betreff und Text samt Version anzeigen und vorlesen. Eine Freigabe muss sich auf genau diese Version beziehen. `MailService.setStatus()` muss vorher die Zustandsfolge erzwingen.
4. **Mail senden:** SMTP-Versand aus Jarvis, Schutz vor doppeltem Senden, Fehler-/Retry-Zustand und Protokoll. Der Versand erfolgt erst nach Ricos Prüfung am Bildschirm. ChatGPT Voice kann die Aktion anstoßen; eine nötige Bestätigung erfolgt laut aktueller OpenAI-Dokumentation am Bildschirm und nicht allein per gesprochenem „Ja“.
5. **CRM-Rückmeldung:** Nach erfolgreichem Versand den Vorgang über das dafür vorgesehene CRM-MCP-Werkzeug dokumentieren. Fehler dort dürfen keine zweite E-Mail auslösen. Der Lesebereich `crm_*` bleibt unangetastet.
6. **Später Proaktivität:** Jarvis kann aus denselben Daten Hinweise zu Wochenmuster, Energie und Zielen ableiten. Automatische Aktionen brauchen je Aktion eine klare Zuständigkeit und Freigaberegel.

## Leitplanken

- Jeder Fakt hat eine Quelle und einen Datenstand; unbekannt bleibt unbekannt.
- Lese- und Schreibwerkzeuge sind getrennt. Neue Schreibrechte werden einzeln, mit konkretem Zweck und kleinem Geltungsbereich ergänzt.
- Ein E-Mail-Versand hat eine eindeutige Versand-ID. Bei Wiederholung wird sein Ergebnis zurückgegeben, nicht erneut gesendet.
- Beim Senden prüft der Server Empfänger, Entwurfsversion, Freigabe und Status selbst. Eine Bestätigung im Chat ersetzt diese Prüfungen nicht.
- ChatGPT und Claude sind austauschbare Oberflächen über stabile Dienste; kein Dienst ist vom Chatverlauf eines Assistenten abhängig.

## Offene Entscheidungen

- Ob Jarvis dauerhaft der einzige Outbound-Versandweg wird oder der bestehende CRM-Versand übernommen wird, ist vor Bau der Sendefunktion mit Rico festzulegen. Es soll am Ende nur einen verbindlichen Versandzustand geben.
- Für SMTP/IMAP fehlen im Jarvis-Projekt noch Postfachdaten und ein getesteter Versandpfad.
