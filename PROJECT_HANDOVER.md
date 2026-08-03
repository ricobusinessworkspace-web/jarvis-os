# Jarvis OS - Project Handover

## 🎯 Projekt-Status & Ziel
**Jarvis OS** ist ein persönliches Dashboard. Das aktuelle Modul **"Finance"** ist strukturell und technisch fertiggestellt, wartet jedoch auf eine serverseitige Freischaltung durch die Banken.

## 🛠️ Erledigte Arbeiten (Stand: 25.07.2026)
1. **Finance Dashboard UI:** 
   - Die Route `/finance` ist implementiert (Next.js App Router).
   - Beinhaltet KPI-Grid (Liquid, Assets, Net Worth), ein Recharts-Chart und eine Transaktionsliste.
2. **FinTS/HBCI Banking-Skript (`scripts/sync-banks.mts`):**
   - Komplett funktionsfähiges TypeScript-Skript für den Abruf von DKB und BW-Bank.
   - **Features:** 
     - ESM-kompatibel (läuft über `tsx`).
     - Abfangen von "Account not found in UPD" durch cleveren IBAN-Mock-Fallback.
     - Erfolgreiche Behandlung von PushTAN (BW-Bank) und App-TAN (DKB).
3. **Environment:** 
   - Lokale `.env` wurde mit den echten Zugangsdaten und IBANs konfiguriert (niemals committen!).

## 🚧 Aktuelle Blocker (Bank-Seite)
Das Skript loggt sich erfolgreich ein (im Bank-Portal sichtbar), aber die Banken liefern keine Umsatz-Daten:
- **DKB:** Server wirft beim Umsatzabruf den Fehler `Account not found in UPD` (Konto ist für FinTS-Datenabruf serverseitig nicht autorisiert).
- **BW-Bank:** Server sendet eine leere Liste (0 Transaktionen in 30 Tagen, Saldo N/A), was ebenfalls bedeutet, dass die Schnittstelle für Drittsoftware stummgeschaltet ist.
- **Maßnahme:** Der User hat Vorlagen erhalten, um den Support beider Banken zur Freischaltung des FinTS-Zugangs aufzufordern.

## 🚀 Next Steps für den nächsten Agenten
Sobald der User meldet, dass die Banken den Zugang freigeschaltet haben:
1. **Testlauf:** Führe `npm run sync:banks -- --days 30` im Terminal aus, um historische Daten abzurufen.
2. **Automatisierung:** Richte einen Mac-Hintergrund-Task (`launchd` oder lokaler Cron) ein, der das Skript jede Nacht (z.B. 03:00 Uhr) ausführt. *Wichtig: Da der User einen Mac nutzt, ist `launchd` zu bevorzugen.*
3. **Feature-Ausbau:** Falls der Finance-Sync stabil läuft, mit dem nächsten Modul (z.B. Task-Management) fortfahren.

## 🧹 Housekeeping
- Temporäre Debugging-Dateien auf dem Desktop (`Jarvis_Banking.txt`) wurden bereits erfolgreich in die System-`.env` überführt.
- Der Code auf dem `main` Branch ist sauber und kann jederzeit deployt werden (z.B. Vercel). (Hinweis: Vercel Auto-Deployment Regel beachten).
