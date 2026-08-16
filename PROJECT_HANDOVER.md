# Jarvis OS – Project Handover 🚀

> **Letzte Aktualisierung:** 16. August 2026  
> **Stack:** Next.js 16.2 (App Router, Turbopack) · React 19 · Prisma 5 · PostgreSQL · Vercel · Tailwind CSS v4

---

## 1. Architektur-Überblick

Jarvis OS ist ein persönliches Produktivitäts-Dashboard mit Apple-minimalistischem Design. Es besteht aus:

### App Shell
- **Root Layout** (`src/app/layout.tsx`): Inter Font, Dark Mode, PWA-Metadaten, `<EcosystemLoader />`
- **Dashboard Layout** (`src/app/(dashboard)/layout.tsx`): `<StoreHydrator>` (Zustand) + `<SidebarProvider>` + `<Sidebar>` + `<TopBar>` + `<PullToRefresh>`
- **Zustand Store** (`src/lib/store.ts`): Client-State für Tasks, Content, PersonalLogs, Trackers, Settings, CRM, Search

### Design System (`src/app/globals.css`)
- Apple-minimal Dark Theme (#000 Basis, #141416 Surfaces)
- Glasmorphismus (`.glass`), `.press` Utility (Button-Press-Feedback), `.card` Utility
- Micro-Animations (150ms), Skeleton Shimmer Loading

---

## 2. Routen & Features

### Dashboard Home (`/`)
Zwei-Spalten-Layout: **The Engine** (links) + **The Business** (rechts)

**The Engine:**
- `<FiveAmStreakWidget />` – 5-AM-Aufsteh-Streak aus PersonalLog
- `<RoutineWidget />` + `<RoutineClient />` – **Heute-Checkliste** (Morgen-/Abendroutine) mit per-Habit Streak-Counter (🔥) und Tages-Score. Kein Wochenverlauf – jeder Tag ist ein Neustart
- `<SleepWidget />` + `<SleepClient />` – **Heute-Card** mit Bett-/Aufwachzeit und berechneter Schlafdauer

**The Business:**
- `<NetWorthWidget />` – Net Worth mit Ziel-Fortschrittsbalken, Area Chart, Balances/Pipeline Tabs
- `<CalendarWidget />` – Google Calendar Tagesagenda (OAuth)
- `<TaskWidget />` – Tages-Tasks mit Prioritäten und Subtask-Checklisten
- `<ContentWidget />` – Content Pipeline (Idee → Veröffentlicht)
- `<WeightWidget />` – Körpergewicht-Tracking

### Tasks (`/tasks`)
Apple Reminders-Klon mit Smart Lists (Heute, Geplant, Alle, Markiert), Custom Lists, Detail-Drawer mit Notizen, Fälligkeit, Priorität, Bereich.

### Content Kanban (`/content`)
4-Spalten Kanban (Ideen → In Arbeit → Geplant → Veröffentlicht) mit Subtasks, Deadlines, Priority-Flagging.

### Finance Hub (`/finance`)
- **CSV Uploader** (`CSVUploader.tsx`): Robuster Two-Pass-Parser mit Auto-Header-Detection (überspringt Metadaten-Zeilen am Anfang), unterstützt DKB & BW-Bank (deutsch + englisch), ISO-8859-1, deterministische Deduplizierung
- **Auto-Kategorisierung** via Regex-Engine (Lebensmittel, Wohnen, Mobilität, Abo/Software, etc.)
- **Net Worth Goal** mit Fortschrittsbalken
- **Recharts Analytics**: 6-Monats Income/Expense + Kategorie Pie Chart
- **Transaktionsliste** mit Edit-Modal (Beschreibung, Betrag, Datum, Kategorie) und Lösch-Funktion

### Mobile Routines (`/routines`)
Standalone Mobile-View für Routinen + Schlaf-Tracking.

---

## 3. Server Actions (`src/actions/`)

| Datei | Kernfunktionen |
|-------|----------------|
| `dashboard.ts` | `getDashboardData`, Task/Content CRUD, `savePersonalLog`, `logTrackerItem`, `updateTrackerItem`, Net Worth Logging, Weight Tracking |
| `finance.ts` | `getFinanceDashboardData`, `uploadTransactions`, `updateTransaction`, `deleteTransaction`, `updateNetWorthGoal` |
| `google-calendar.ts` | OAuth Token Management, `fetchCalendarEvents` (Google Calendar v3 API) |

---

## 4. Datenbank (Prisma Schema)

**Core Models:** `Task`, `ContentItem`, `PersonalLog`, `Setting`, `Tracker` → `TrackerItem` → `TrackerLog`, `Transaction`, `WeightEntry`, `KPI`, `Activity`, `KnowledgeItem`

**CRM Models:** `crm_leads`, `crm_events`, `crm_task_overrides`

**G-Project Models:** `tracker_action_rules`, `tracker_user_stats`, `tracker_action_entries`

**Transaction-Felder:** `notes` (String), `taxRelevant` (Boolean), `tags` (Json) – via Raw-SQL hinzugefügt

---

## 5. API & Webhooks (`src/app/api/`)

Alle Webhooks sind via `N8N_WEBHOOK_SECRET` Bearer-Token geschützt:
- `/api/webhooks/finance` – Bank-Transaktionen von n8n/GoCardless, SHA-256 Deduplizierung
- `/api/webhooks/tasks`, `/api/webhooks/activity`, `/api/webhooks/kpis`, `/api/webhooks/knowledge` – Externe CRUD-Endpoints
- `/api/widgets/routines` – Widget-Endpoint für iOS Scriptable (`WIDGET_SECRET_TOKEN`)
- `/api/auth/google/*` – Google Calendar OAuth2 Flow
- `/api/status` – Health Check (DB + n8n Erreichbarkeit)

---

## 6. Deployment & Infrastruktur

- **Vercel Auto-Deploy** vom `main`-Branch (GitHub: `ricobusinessworkspace-web/jarvis-os`)
- **Build:** `next build` (Turbopack) – benötigt Netzwerk für Google Fonts
- **Prisma:** `postinstall` generiert den Client automatisch
- **Electron-fähig** (Electron 42.2, aber primär als Web-App genutzt)

---

## 7. Architektur-Entscheidungen

| Entscheidung | Begründung |
|-------------|------------|
| FinTS verworfen → CSV-Import | DKB/BW-Bank blockieren Open-Source FinTS-Clients systematisch |
| Routine: Nur Heute-Ansicht | "Jeder Tag ist eine neue Chance" – kein Wochenverlauf auf dem Dashboard |
| Steuer-Features ausgeblendet | User will erst Kernfeatures stabilisieren, Steuern kommen später |
| Apple-minimal Design | Subtile Borders, `.press` Button-Feedback, wenig visueller Noise |

---

## 8. Nächste Schritte

- [ ] **Routine Analytics Page** – Separate Seite/Route für Wochen-/Monatsanalyse der Routinen mit Graphen
- [ ] **Steuer-Export** – Export steuerrelevanter Transaktionen als strukturierten Prompt für Claude
- [ ] **Onboarding** – Erste Nutzung vereinfachen (aktuell braucht man Seed-Daten für Tracker)
- [ ] **Notifications** – Push-Benachrichtigungen für fällige Tasks und Routine-Erinnerungen
