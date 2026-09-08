# Command Center – Analyse & Umsetzungsplan

> Stand: 2026-09-08 · Branch `main` · Phase 0 abgeschlossen, kein Produktivcode geschrieben
> Mockup: https://claude.ai/code/artifact/0c901fec-1526-4618-8fef-25a58939cbac

---

## 1. Kernbefunde aus der Analyse

1. **Core Event Layer existiert nicht.** Keine `core_events`, `core_metric_definitions`,
   `core_goals`, `core_intentions` — weder in `schema.prisma` noch in der DB. Der frühere
   Architektur-Auftrag wurde nie umgesetzt.
2. **Das CRM gibt das Call-Ziel vor.** `user_profiles.daily_call_goal` → **Rico = 60**
   (Alan 60, Angelie 100). `crm_calls` ist pro Nutzer attribuiert (Rico: 48 von 296).
   Jarvis liest das Ziel, erfindet es nicht.
3. **`crm_events` ist leer (0 Zeilen)** → die bestehenden Sales-Widgets zeigen dauerhaft
   „0 Calls". Echte Calls liegen in `crm_calls` (`ts` ms, `status` answered/not_answered).
4. **Pipeline-Stufen liefert das CRM** über `crm_leads.stage`:
   `cold 130 · pitch 47 · data 12 · offer 2 · closed 57`. Kein eigenes Mapping in Jarvis.
5. **Punktesystem ist mitten im Umbau.** Die neuen `g_*`-Tabellen sind **alle leer**;
   Live-Daten stehen in `tracker_user_stats` (Rico: 155 Punkte / 115 € Schulden,
   letzte Abrechnung 2026-08-20; zweiter Spieler „Leo"). → Anbindung gegen `tracker_*`,
   `g_*` als Umschaltpfad offenhalten.
6. **„Ursachen"-Tracker existiert bereits** (`jarvis_trackers`, `type: 'intentions'`) mit
   *20 Anrufe* / *Personal Brand Post* / *Trainingseinheit*. Dazu fertige, aber **nicht
   gemountete** Komponenten `IntentionsWidget` / `IntentionsClient`.
7. **Datensättigung ist real niedrig:** Ernährung nie geloggt, Gewicht 6 Einträge (Juli),
   Schlaf lückenhaft, Tracker-Logs mit großen Lücken. Die UI muss „meist leer" tragen.
8. **Jarvis läuft als PWA auf Vercel** (mit SSO-Protection) + iPhone-Widget über
   **Scriptable** (`MOBILE_WIDGET_HANDOVER.md`). Diese Schiene trägt auch die
   Apple-Integrationen.

---

## 2. Bestand: Design-System & Komponenten

**Stack:** Next.js 16.2 (App Router), React 19, Tailwind v4 (CSS-first `@theme`),
Zustand, Prisma 5, Supabase Postgres, Vercel. Shadcn-Stil-Primitives in
`src/components/ui/` + `cn()`.

**Tokens** (`src/app/globals.css`): Dark-only, Apple-minimal. Semantische CSS-Variablen,
Utilities `.press` / `.glass` / `.card`, Component-Layer `.crm-card` / `.crm-header` /
`.crm-stat-*` — der De-facto-Widget-Look.

**Pattern pro Widget (konsequent):**
```
components/widgets/XxxWidget.tsx        Server Component
core/services/XxxService.ts             Prisma, Berlin-TZ via getBerlinDateStr()
components/widgets/client/XxxClient.tsx 'use client', initialData, optimistic
actions/dashboard.ts                    Server Actions + revalidatePath('/', 'layout')
```

**Wiederverwendbar:** `IntentionsClient` (Toggle + Streak), `RoutineClient`,
`StreakStatsPopover`, `PerformanceGraphClient` (Recharts), `.crm-*`-Klassen.
**Verwaist / kaputt:** `CrmWidget` + `SalesEngineWidget` (lesen leeres `crm_events`),
`DashboardLayoutClient` (Drag-Layout, nicht eingebunden).

---

## 3. Entscheidungen

| Thema | Entscheidung |
|---|---|
| **Event Layer** | Schlank: Config-Tabellen + `AnalyticsService` on-read. Kein `core_events` (aufgeschobener Scope). |
| **Vertriebs-KPIs** | Kommen aus dem CRM (Calls, Ziel, Stufen, Conversion). Jarvis liest, baut nicht nach. |
| **Call-Ziel** | **Basis 30** (6-Monats-Plan) / **Soll 60** (`user_profiles.daily_call_goal`). |
| **Fallback** | CRM offline → manueller Tageshaken, sichtbar als Badge „manuell". Dashboard bleibt eigenständig. |
| **Aufgaben** | **Apple Reminders ersetzt `/tasks`.** Route + Sidebar raus, `jarvis_tasks` archiviert. |
| **Reminders-Modus** | **Read-only + Deep Link.** Reminders bleibt einzige Wahrheit, Tippen öffnet die App. Kein Outbox-Sync. |
| **Kalorien** | Über **Apple Health**, nicht über eine App-API. Logging-App bleibt **Cronometer** (Free-Tier hat Barcode + Health-Sync; MyFitnessPal hat Barcode hinter der Paywall). App jederzeit tauschbar. |
| **Punktesystem** | **Vorerst nicht in der UI** — das G-Projekt ist noch nicht funktionstüchtig (`g_*` leer). Das Design ergibt sich aus der Implementierung, wenn es live geht. |
| **Ingest** | Ein Pipe: `POST /api/ingest/*` (Bearer + Vercel-Bypass-Header), gefüllt von **iOS-Kurzbefehl-Automationen**. Reminders, Health-Kalorien und künftige Quellen sind nur Metrik-Quellen. |
| **Aufgaben-Quellen** | Zwei getrennte Listen in einer Karte: **Erinnerungen** (Apple) und **CRM · deine Leads** (`crm_leads.task_text` JSON, gefiltert auf `claimed_by = Rico` → 102 Leads, aktuell 11 offene Aufgaben). |
| **Automatik** | Metriken werden von Quellen **automatisch erfüllt**, nicht nur manuell abgehakt (siehe §3a). |
| **Lightning CRM** | Meilenstein-Anzeige **entfernt**. Bleibt als `core_goals`-Eintrag in den Daten, ohne UI-Fläche. |
| **Aktivität** | Der Monatsverlauf (eine Metrik pro Zeile) steht **auf dem Dashboard**, nicht versteckt im Verlauf. |

### 3a. Automatik-Schicht (`core_metric_sources`)

Viele Metriken sollen sich künftig selbst erfüllen, statt manuell abgehakt zu werden —
Beispiel: *sobald im G-Projekt die Regel „Posting" erledigt ist, gilt `content.posts`
für den Tag automatisch als erfüllt.* Dafür bekommt jede Metrik eine geordnete Liste
von Quellen:

```
core_metric_sources
  metric_key      z.B. content.posts
  kind            'crm' | 'tracker' | 'health' | 'reminders' | 'gproject' | 'manual'
  config          jsonb — z.B. { rule: 'posting' } oder { table: 'crm_calls', user: '…' }
  priority        1 = gewinnt; 'manual' immer als letzte Stufe
```

`AnalyticsService` fragt die Quellen in Prioritätsreihenfolge ab und liefert den ersten
Treffer inklusive `source`, damit die UI zeigen kann, **woher** ein Wert stammt
(„auto aus CRM" / „manuell"). Neue Systeme anzubinden heißt dann: eine Zeile in
`core_metric_sources`, kein neuer Code-Pfad.
| **Struktur** | **Heute** (Startseite) · **Verlauf** · **Vertrieb** · **Health** · **Finance (WIP)**. |
| **Kalender** | Kein Monatsgitter als Hauptanzeige. **Tages-Navigator + editierbares Tagesblatt**; Monatsverlauf nur eine Metrik pro Zeile. |
| **Off-Day** | Sonntag ausgegraut, nicht im Adherence-/Coverage-Nenner. |
| **Solls** | In `core_intentions`, **in der UI editierbar** (Basis + Soll getrennt). |
| **Block** | Block 1 ab 2026-09-01, 12 Wochen, Mo–Sa getrackt. *(Startdatum-Detail siehe offene Frage)* |

---

## 4. Produktvision

### 4.1 Zustände — überall gleich kodiert
Soll · Basis · darunter · **nicht gemessen** (gestrichelt) · Off-Day (ausgegraut).
Farbe steht nie allein: Füllgrad, Zahl und Rand tragen mit. `NULL ≠ 0` bleibt sichtbar.

### 4.2 Heute (Startseite)
Nur der heutige Tag, ruhig, wenige Karten:
- **Calls** — Ist / 60, Basis-30-Marke im Meter, Quelle CRM
- **Kalorien** — Ist / Ziel aus Apple Health, Makros als Nebenzeile
- **Ursachen** — Calls / Training / Post, drei Zustände, Streak, Adherence + Coverage,
  je Zeile die Quelle („auto aus CRM" / „manuell" / später „auto aus G-Projekt")
- **Aufgaben** — zweigeteilt: *Erinnerungen* (Apple, read-only + Deep Link) und
  *CRM · deine Leads* (offene `task_text`-Einträge mit Lead-Name und Stage)
- **Aktivität** — Monatsverlauf, eine Metrik pro Zeile, Wochen durch Abstände getrennt,
  Tag anklickbar → springt in den Verlauf

### 4.3 Verlauf
- **Tages-Navigator:** horizontaler Streifen, zurückscrollbar, Pfeiltasten.
- **Tagesblatt** = die Arbeitsfläche: alle Werte des gewählten Tages, editierbar,
  gruppiert (Ursachen / Körper / Routine). Leeres Feld bleibt „nicht gemessen".
  Aus Health gelesene Werte sind schreibgeschützt und als solche markiert.
- Kein zweiter Monatsverlauf — der steht auf dem Dashboard.

### 4.4 Vertrieb
Calls heute/Woche gegen CRM-Ziel · Pipeline-Stufen wie vom CRM geliefert ·
Conversion als „wird ermittelt" (Messphase) · Umsatzziel als **pending**, nie als 0 %.

### 4.5 Health
Training (inkl. Basketball) · Kalorien · Schlaf · Gewicht · Routine, je mit Streak und
Coverage, plus eigener Aktivitäts-Monatsverlauf. **Kein Lightning-CRM-Status** — der
gehört nicht in Health und ist komplett entfernt.

### 4.6 Finance
Bestehende Seite als Reiter mit WIP-Badge. Kein Umbau.

---

## 5. Umsetzungsplan

### Phase 1 — Semantic Layer + AnalyticsService
1. Prisma-Modelle `core_metric_definitions`, `core_goals`, `core_intentions`
   (`baseValue`, `stretchValue`, `comparator`, `activeWeekdays`, `validFrom/To`)
   und **`core_metric_sources`** (siehe §3a — die Automatik-Schicht).
2. Seed (`scripts/seed-semantic-layer.mts`): Metriken für Vertrieb / Health / Social /
   Code. Goals: *Lightning CRM verkauft* (2026-12-31), *Umsatzziel Vertrieb* = `pending`
   ohne Zielwert. **Kein `revenue.monthly`.**
3. `AnalyticsService.getMatrix(from, to, keys[])` → pro Tag/Metrik
   `{ value|null, base, stretch, state, source }`. Invariante: keine Quelle → `null`.
   Quellen: `crm_calls` (gefiltert auf Rico) · `crm_leads.stage` ·
   `jarvis_tracker_logs` · `jarvis_personal_logs` · `jarvis_weight_entries` ·
   `tracker_user_stats` · Ingest-Cache (Reminders / Health).
4. `src/lib/blocks.ts` — Block/Woche/Off-Day.
5. Server Action `updateIntention()` für editierbare Solls.

**Fertig wenn:** Seed per SQL prüfbar, `getMatrix` liefert für 3 Testtage korrekte States,
Soll änderbar, `revenue.monthly` nachweislich nicht gesetzt.

### Phase 2 — Apple-Ingest
1. `POST /api/ingest/apple` (Bearer, wie `webhook-auth.ts`) + Cache-Tabellen
   `ingest_reminders`, `ingest_health`.
2. Zwei iOS-Kurzbefehl-Automationen (Reminders heute · Health Nahrungsenergie),
   inkl. `x-vercel-protection-bypass`-Header wie beim Scriptable-Widget.
3. Generischer `POST /api/ingest/metrics` für künftige Quellen.
4. Dokumentation der Kurzbefehle in `APPLE_INTEGRATION.md`.

**Fertig wenn:** Reminders und Kalorien erscheinen ohne manuelles Zutun im Dashboard;
Ausfall der Automation zeigt „nicht gemessen", nicht 0.

### Phase 3 — Heute-Dashboard
Route `/` neu (altes Grid nach `/overview` oder ablösen). Karten wie 4.2.
Aufgaben-Karte zweigeteilt: Reminders (read-only + Deep Link) und CRM-Lead-Aufgaben
(`crm_leads.task_text` parsen, `claimed_by`-Filter, offene Einträge, Deep Link ins CRM).
Aktivitäts-Monatsverlauf als eigene Karte, Zellen klickbar → Verlauf.

**Fertig wenn:** Alle Karten zeigen echte Daten oder sauber „nicht gemessen";
Ursachen-Toggle schreibt und aktualisiert; Aktivitätszelle springt zum richtigen Tag.

### Phase 4 — Verlauf
Tages-Navigator + editierbares Tagesblatt (inkl. Nachtragen für Vortage),
Monatsverlauf als Metrik-Zeilen. Server Action `saveDay(date, patch)`.

**Fertig wenn:** Ein Vortag lässt sich vollständig nachtragen und korrigieren;
leeres Feld bleibt `null`.

### Phase 5 — Vertrieb
`CrmService` auf `crm_calls` + `user_profiles.daily_call_goal` umstellen,
Pipeline aus `crm_leads.stage`, Messphase-Labels, CRM-offline-Fallback.

### Phase 6 — Health
Health-Reiter mit eigenem Aktivitäts-Verlauf. Kein Code-/Meilenstein-Block.

### Phase 6a — G-Projekt anbinden *(sobald funktionstüchtig)*
Quelle in `core_metric_sources` eintragen (z.B. Regel „Posting" → `content.posts`),
Punkte-Karte gestalten. UI-Design ergibt sich aus der dann vorhandenen Implementierung.

### Phase 7 — Aufräumen
`/tasks` entfernen, `jarvis_tasks` archivieren, `SalesEngineWidget` /
`DashboardLayoutClient` löschen, Finance als Reiter einhängen.

---

## 6. Offene Punkte

1. **Block-Startdatum:** Der 01.09.2026 ist ein **Dienstag**. Läuft Woche 1 als
   Di 01.–Mo 07. (heute = Woche 2, Tag 1) oder rechnest du Mo–So?
2. **Call-Attribution:** 158 von 296 `crm_calls` haben `by_user_name = NULL`.
   Als deine zählen oder ignorieren?
3. **G-Projekt-Migration:** Wann geht `g_*` live? Bis dahin lese ich `tracker_*`.

## 7. Annahmen

- `crm_*` und `g_*` / `tracker_*` = **read-only Fremdbestand** (keine Trigger,
  keine Schemaänderung von Jarvis aus).
- Berlin-Zeit ist die Tagesgrenze aller Tagesmetriken.
- Dark-only bleibt; neue Views nutzen das bestehende Token-System.
- Keine erfundenen Zahlen: fehlende Quelle → „nicht gemessen" / „pending", nie `0`.
