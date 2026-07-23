# 🤝 Project Handover

**To:** Next Lead Developer / Agent  
**From:** Antigravity Agent  
**Date:** 2026-07-23  

Dieses Dokument dient als nahtlose Übergabe für den nachfolgenden Entwicklungs-Agenten. Es beschreibt die Systemarchitektur von Ricos Jarvis OS, die neuesten abgeschlossenen Epics (insbesondere die Bank-Automatisierung) und die offenen Aufgaben.

---

## ⚡ 1. Projekt-Überblick & Repositories

Rico arbeitet aktiv an einem zusammenhängenden Produktivitäts- und Business-Ecosystem. Die wichtigsten lokalen Repositories sind:

1. **`Jarvis OS`** (`/Users/rico/dev/Jarvis OS`): 
   - **Tech-Stack:** Next.js 16 (Turbopack), Prisma ORM, Supabase Postgres, TailwindCSS.
   - **Funktion:** Die primäre Web-App (Dashboard, Finanzen, Routines, Sleep Tracking, CRM Overview). Wird automatisch auf Vercel (Production) deployt.
   
2. **`Lightning CRM`** (`/Users/rico/dev/Lightning CRM`): 
   - **Tech-Stack:** Electron, Node.js.
   - **Funktion:** Die Desktop-App für Kaltakquise und Lead-Management. Scrapt Leads, trackt Anrufe/E-Mails und pusht Statistiken in die Jarvis-DB.

---

## 🏦 2. Epic: Banking Automation (Kürzlich abgeschlossen)

Das größte kürzlich fertiggestellte Feature ist die **vollautomatische Bank-Synchronisation**. 
*Ursprünglich war GoCardless/Nordigen geplant, jedoch wurden dort Neuanmeldungen deaktiviert. Das System wurde daher auf eine direkte, 100% private **FinTS/HBCI** Architektur umgebaut.*

### Die FinTS-Architektur
1. **Das Sync-Skript (`scripts/sync-banks.ts`):**
   - Ein lokales Node.js-Skript in Jarvis OS, das die `lib-fints` Bibliothek nutzt.
   - Verbindet sich direkt mit der **BW-Bank** (Privat, BLZ: 60050101) und der **DKB** (Geschäftlich).
   - Holt Kontoauszüge (letzte 2 Tage) und den aktuellen Saldo.
   - Die PINs liegen sicher und ausschließlich in der lokalen `.env` Datei.
   - TAN-Handling: Fragt beim ersten Start (oder nach 90 Tagen) interaktiv im Terminal nach der TAN (pushTAN/chipTAN).

2. **Der Webhook (`src/app/api/webhooks/finance/route.ts`):**
   - Das Skript formatiert die Umsätze und schickt sie per `POST` an Ricos Vercel Production-URL.
   - Der Webhook ist durch das `N8N_WEBHOOK_SECRET` geschützt.
   - **Idempotenz:** Jeder Umsatz hat eine einzigartige `bankTransactionId`. Der Webhook gleicht diese mit der Datenbank ab und ignoriert Duplikate.

3. **Automatisierung (n8n):**
   - Rico hat lokal n8n laufen. Ein einfacher Workflow triggert jede Nacht um 03:00 Uhr einen "Execute Command"-Node, der `npm run sync:banks` im Jarvis OS Verzeichnis ausführt.

---

## 🚀 3. Weitere kürzliche Milestones

- **Datenbank-Migration:** Das Prisma-Schema wurde um das Feld `bankTransactionId` im Modell `Transaction` erweitert. Die Migration wurde per direktem SQL (`add_bank_tx_id.sql`) auf der Supabase-Produktionsdatenbank erfolgreich angewendet.
- **CRM-Tracker:** Das `Lightning CRM` erfasst nun separat E-Mail- und Call-Events. Jarvis OS zeigt beides gestapelt im `CrmWidget.tsx` auf dem Dashboard an.
- **PWA UX:** Pull-to-Refresh wurde für das Dashboard implementiert, um Mobile- und Mac-Trackpad-Reloads zu verbessern.
- **Deployment-Regel:** Code-Änderungen an Jarvis OS werden immer direkt per Git committet und auf den `main` Branch gepusht, damit das Vercel Auto-Deployment greift (Globale User-Regel).

---

## 🚨 4. Bekannte Einschränkungen & Next Steps

### Asset-Tracking (Trade Republic / Revolut)
Die aktuelle FinTS-Lösung deckt die Haupt-Cashflows (Giro/Business) perfekt ab.
- **Problem:** Trade Republic und Revolut unterstützen den deutschen FinTS/HBCI-Standard nicht.
- **Next Step:** Für Revolut könnte in Zukunft die *Enable Banking API* evaluiert werden. Für Trade Republic ist aktuell ein manueller CSV-Export-Import-Workflow am stabilsten, da TR API-Zugriffe stark blockiert.

### TAN-Renewals überwachen
- **Hinweis für den Agenten:** Alle ca. 90 Tage wird die Bank (wegen PSD2-Richtlinien) eine neue TAN anfordern. Das Sync-Skript wirft dann einen Fehler im Hintergrund. Rico muss das Skript dann einmalig manuell im Terminal (`npm run sync:banks`) starten und die TAN auf dem Handy freigeben.

### UI / Dashboard Polish
- Da die Bankdaten nun automatisch in `jarvis_transactions` fließen, könnte als nächster Schritt das Dashboard weiter ausgebaut werden (z.B. detaillierte Ausgaben-Kategorien (Pie Charts), Trend-Analysen).

---
*End of Handover*
