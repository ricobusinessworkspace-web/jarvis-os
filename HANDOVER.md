# Jarvis OS — Handover

> Stand: 2026-09-09 · Branch `main` · Live auf Vercel
> Lies zuerst `AGENTS.md`: Next.js 16 weicht von Trainingsdaten ab, die
> mitgelieferten Docs liegen unter `node_modules/next/dist/docs/`.

---

## 1. Was das ist

Persönliches Operating System für Rico. Kern ist ein **Command Center**, das
den 6-Monats-Plan gegen echte Daten hält. Leitprinzip: **Ursachen vor
Wirkungen** — die tägliche Handlung (Calls, Training, Post) ist die
Stellschraube, Umsatz und Pipeline sind Folgen. Deshalb öffnet das Dashboard
nie mit Umsatzzahlen.

**Stack:** Next.js 16.2 (App Router), React 19, Tailwind v4 (CSS-first
`@theme` in `globals.css`), Prisma 5, Supabase Postgres, Zustand, Vercel.

---

## 2. Die eine Regel, die alles durchzieht

**`NULL ≠ 0`.** Ein fehlender Eintrag ist „nicht gemessen", niemals null.
Ein vergessener Log-Tag und ein Tag mit null Calls sind verschiedene Dinge,
und die Oberfläche muss beides unterscheiden. Jede Metrik trägt deshalb einen
Zustand statt nur einer Zahl:

| Zustand | Bedeutung |
|---|---|
| `soll` | Stretch-Ziel erreicht |
| `basis` | Grundminimum erreicht |
| `unter` | darunter |
| `erfasst` | gemessen, aber **ohne hinterlegtes Ziel** (Schlaf, Gewicht, Kalorien) |
| `ungemessen` | keine Quelle — nie als 0 zeigen |
| `offday` | Sonntag, zählt nicht in Adherence/Coverage |

Ausnahme mit Ansage: `core_metric_sources.config.impliesZero` markiert
lückenlose Quellen. Das CRM protokolliert jeden Anruf, dort heißt „keine
Zeile" wirklich null Anrufe.

**Erfundene Zahlen sind verboten.** Kein Platzhalter-Ziel, kein 0 % für ein
Ziel, das nicht existiert. Das Umsatzziel steht bewusst auf `pending`.

---

## 3. Architektur

### Semantic Layer (`core_*`)

Vier Konfigurationstabellen, angelegt über `scripts/core-layer.sql`:

- `core_metric_definitions` — welche Metriken es gibt
- `core_metric_sources` — **Automatik-Schicht**: pro Metrik eine nach
  `priority` geordnete Quellenliste, erster Treffer gewinnt
- `core_intentions` — Soll-Werte (`baseValue`, `stretchValue`), in der UI editierbar
- `core_goals` — Ziele, auch bewusst zielwertlose

`AnalyticsService.getMatrix(from, to, keys?)` rechnet daraus Tag × Metrik
on-read. **Ein neues System anzubinden ist eine Zeile in
`core_metric_sources`, kein neuer Code-Pfad.**

Quellenarten: `crm_calls` · `tracker` · `personal_log` · `weight` · `health`
(aus dem Kurzbefehl-Ingest) · geplant `reminders`, `gproject`.

### Ingest (`ingest_*`)

Apple Erinnerungen und Health haben keine Cloud-API. Ein iOS-Kurzbefehl
schiebt sie an `POST /api/ingest/apple` (Bearer `INGEST_SECRET`).
Anleitung: `APPLE_INTEGRATION.md`. **Noch nicht eingerichtet.**

`ingest_status` unterscheidet „nichts zu tun" von „Sync ausgefallen" — eine
leere Liste allein sagt das nicht.

### Routen

| Route | Inhalt |
|---|---|
| `/` | Heute: Calls, Körper-Schnelleingabe, Ursachen, Routine, Aufgaben, Aktivitäts-Monatsverlauf |
| `/verlauf` | Tagesstreifen + editierbares Tagesblatt (auch rückwirkend) |
| `/vertrieb` | Calls gegen CRM-Ziel, Pipeline, Messphase-Labels |
| `/health` | Training, Schlaf, Gewicht, Routine-Verlauf |
| `/content`, `/finance` | Altbestand, unverändert |
| `/routines` | Mobile Ansicht, Ziel des iPhone-Widgets — **nicht kaputtmachen** |

### Muster

```
components/today/*.tsx          Karten (Client, wo interaktiv)
core/services/*Service.ts       Datenzugriff, Berlin-Zeit via getBerlinDateStr()
actions/*.ts                    Server Actions
lib/revalidate.ts               revalidateTracking() — gezielt, nie 'layout'
lib/blocks.ts                   12-Wochen-Block, Off-Days
lib/metricState.ts              Zustand → Farbe/Label, eine Quelle für alle Views
```

---

## 4. Fallstricke — hier bin ich reingelaufen

**Der Pooler gibt genau eine Verbindung** (`connection_limit=1`, korrekt für
Serverless). Daraus folgt:

- **Nie `Promise.all` für Prisma-Abfragen.** Gemessen: 6 Abfragen einzeln
  943 ms, gebündelt 495 ms, parallel 1020 ms. Parallel ist am schlechtesten.
- **`$transaction([...])` statt sequenzieller `await`** für unabhängige Reads.
- **Nur ein Prisma-Client.** `core/db.ts` reicht `lib/prisma.ts` durch. Zwei
  Module mit je eigenem Client hatten zwei Pools, die sich die eine
  Verbindung wegnahmen.
- Jede Prisma-Abfrage kostet über den pgbouncer ~320 ms (BEGIN/DEALLOCATE/
  COMMIT), ein roher Round-Trip nur 36 ms. **Abfragen zusammenlegen lohnt.**

**`revalidatePath('/', 'layout')` ist eine Falle.** Es verwirft das Layout,
dessen Datenfunktion dann bei jedem Häkchen neu läuft. Benutze
`revalidateTracking()`.

**Optimistische Updates nur mit `useOptimistic`.** Eigener State, der nach
der Action gelöscht wird, springt sichtbar zurück — die neuen Server-Daten
sind zu diesem Zeitpunkt noch nicht da.

**`jarvis_personal_logs` legt Tageszeilen mit Default 0 an.** 0 heißt dort
„nicht ausgefüllt", nicht „null Stunden". Die Quelle filtert das.

**`crm_events` ist leer** und war jahrelang die falsche Quelle für Calls.
Richtig ist `crm_calls`, gefiltert auf `by_user_name`.

**`crm_*` und `g_*`/`tracker_*` gehören fremden Apps.** Nur lesen, keine
Trigger, keine Schemaänderung. Alle Zugriffe sind abgesichert — fällt das
CRM aus, stehen Metriken auf „nicht gemessen" statt die Seite zu kippen.

**Migrationen nie mit `prisma db push`.** Die Datenbank enthält Tabellen, die
nicht in `schema.prisma` stehen — db push würde sie löschen. Nutze
`npm run core:migrate` (rohes SQL, idempotent).

---

## 5. Werkzeuge

```bash
npm run dev            # Entwicklung
npm run build          # Produktionsbuild (prüft auch Typen)
npm run core:migrate   # Tabellen anlegen, idempotent
npm run core:seed      # Semantic Layer befüllen, idempotent
npm run core:check     # Rechnet alles gegen echte Daten nach — bestes Debug-Werkzeug
npm run test:e2e       # Playwright-Rauchtest
```

`npm run core:check` zeigt Blockposition, Metrik-Matrix, Quellen und
Kennzahlen. Bei jedem Zweifel an Daten: zuerst das laufen lassen.

---

## 6. Feste Werte

- **Block 1** ab 2026-09-01 (ein Dienstag), 12 Wochen, Wochen am Startdatum
  verankert (Di→Mo). Sonntag ist Off-Day.
- **Calls: Basis 30** (6-Monats-Plan) **/ Soll 60** (`user_profiles.daily_call_goal`
  im CRM — Jarvis liest das Ziel, erfindet es nicht).
- **Training und Post:** je 1× Mo–Sa.
- **Schlaf, Gewicht, Kalorien: kein Ziel.** Der Plan nennt keins, also wird
  nur erfasst, nicht bewertet.

---

## 7. Offen

- Apple-Kurzbefehle einrichten (`APPLE_INTEGRATION.md`) — Erinnerungen und
  Kalorien sind bis dahin leer
- G-Projekt (Punktesystem) anbinden, sobald `g_*` befüllt ist; Live-Daten
  stecken noch in `tracker_user_stats`
- Vercel-Region auf `lhr1` (Datenbank steht in London)
- Lint-Altbestand in `actions/dashboard.ts`, `finance/*`, `lib/voice.ts`
