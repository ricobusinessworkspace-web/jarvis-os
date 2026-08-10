# Jarvis OS – Project Handover 🚀

## 1. Aktueller Stand (Finance Dashboard 2.0)
Wir haben einen massiven Architektur-Pivot durchgeführt:
- **Altes System (FinTS):** Vollständig verworfen und aus dem Codebase entfernt (`scripts/sync-banks.mts` gelöscht). Grund: DKB und BW-Bank blockieren inoffizielle Open-Source-FinTS-Clients systematisch (Whitelist für Produkt-IDs / Format-Crashes).
- **Neues System (CSV-Import):** Das Finance-Modul ist jetzt zu 100% unabhängig, lokal und extrem stabil. Es nutzt einen smarten CSV-Importer (Drag & Drop), der Umsätze von der DKB und BW-Bank liest, parst und in der Datenbank abspeichert.

## 2. Abgeschlossene Features
- **CSV Uploader (`src/components/finance/CSVUploader.tsx`):**
  - Akzeptiert Drag & Drop.
  - Dynamisches Parsing der Spalten (versteht DKB und BW-Bank Formate automatisch).
  - Ignoriert Duplikate (über einen deterministischen `bankTransactionId` Hash aus Datum, Betrag und Verwendungszweck).
- **Auto-Categorization (`src/actions/finance.ts`):**
  - Jeder neue Umsatz läuft durch eine Regex-/Keyword-Engine und wird automatisch in Kategorien wie `Lebensmittel`, `Wohnen`, `Mobilität`, `Abo/Software`, etc. sortiert.
- **Interaktives Finance Dashboard (`src/app/(dashboard)/finance/FinanceClient.tsx`):**
  - **Net Worth Widget:** Zeigt den aktuellen Spielstand.
  - **Steuer-Schublade (Tax Drawer):** Summiert alle steuerlich absetzbaren Ausgaben in Echtzeit.
  - **Kategorie-Pie-Chart:** Zeigt die Ausgabenverteilung.
  - **Transaktions-Liste mit Edit-Modal:** Transaktionen können angeklickt werden. Man kann Kategorien ändern, Notizen/Rechnungsnummern hinzufügen und den `Steuerrelevant`-Schalter umlegen.

## 3. Datenbank-Änderungen (Prisma)
Das Modell `Transaction` (`jarvis_transactions`) wurde erfolgreich um drei Felder erweitert (via Raw-SQL um Datenverlust zu vermeiden):
- `notes` (String)
- `taxRelevant` (Boolean)
- `tags` (Json)

## 4. Vercel Deployment & Config
- In der `package.json` wurde das Skript `"build": "next build"` wiederhergestellt, nachdem es zuvor manuell deaktiviert worden war. Das automatische Vercel-Deployment über den `main`-Branch läuft jetzt fehlerfrei.

## 5. Nächste Schritte für den Folge-Agenten
- **Daten-Visualisierung:** Weiterer Ausbau des Dashboards (z.B. historische Entwicklung des Net Worth als Line-Chart).
- **Ziele & Motivation:** Einbindung von Sparzielen ("Goals"), um den Gamification-Faktor zu erhöhen.
- **Claude-Integration für Steuern:** Export-Funktion der steuerrelevanten Transaktionen bauen, sodass diese als strukturierter Prompt an Claude übergeben werden können, um die Steuererklärung noch weiter zu vereinfachen.
