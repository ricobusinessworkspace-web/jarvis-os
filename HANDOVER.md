---
last_updated: 2026-09-09
last_agent: Claude Opus 5 — Command Center, Semantic Layer, Performance
status: In Progress
---

## Projekt-Snapshot

**Was ist das Projekt?**
Persönliches Operating System für Rico. Kern ist ein Command Center, das den
6-Monats-Plan gegen echte Daten hält — nach dem Prinzip *Ursachen vor Wirkungen*:
die tägliche Handlung (Calls, Training, Post) ist die Stellschraube, Umsatz und
Pipeline sind nur Folgen.

**Aktueller Stand:**
- **Semantic Layer** (`core_*`-Tabellen): fertig, im Einsatz. Metriken, Quellen,
  Soll-Werte und Ziele liegen in der Datenbank, nicht im Code.
- **Dashboard „Heute"**: fertig. Calls, Körper-Schnelleingabe, Ursachen, Routine,
  Aufgaben, Monatsverlauf. Rico trackt seit dem 08.09. damit.
- **Reiter Verlauf / Vertrieb / Health**: fertig. Verlauf erlaubt Nachtragen und
  Korrigieren beliebiger Tage.
- **Routinen bearbeitbar**: fertig — umbenennen, verschieben, löschen, ergänzen.
- **Apple-Anbindung** (Erinnerungen + Health-Kalorien): Endpunkt und Datenbank
  stehen und sind getestet. **Offen: Rico muss die iOS-Kurzbefehle einrichten**
  (`APPLE_INTEGRATION.md`) und `INGEST_SECRET` in Vercel setzen. Bis dahin
  bleiben beide Karten leer.
- **G-Projekt (Punktesystem)**: bewusst nicht angebunden, `g_*`-Tabellen sind leer.
- **Performance**: von 3,4 s auf ~1,1 s Seitenaufruf. Hauptursache liegt aber
  außerhalb des Codes, siehe `DATENBANK_BRIEFING.md`.

## Was funktioniert (behalte das)

- **`NULL ≠ 0`.** Fehlender Eintrag heißt „nicht gemessen", nie null. Jede Metrik
  trägt einen Zustand (`soll` · `basis` · `unter` · `erfasst` · `ungemessen` ·
  `offday`), nicht nur eine Zahl. Ohne diese Trennung ist ein vergessener Log-Tag
  nicht von einem schlechten Tag zu unterscheiden.
- **Quellen-Schicht `core_metric_sources`.** Pro Metrik eine nach `priority`
  geordnete Quellenliste, erster Treffer gewinnt. Ein neues System anzubinden ist
  eine Zeile in der Tabelle, kein neuer Code-Pfad.
- **Keine erfundenen Zahlen.** Kein Platzhalter-Ziel, kein 0 % für ein Ziel, das
  nicht existiert. Das Umsatzziel steht bewusst auf `pending`.
- **Ziele kommen aus der Quelle, die sie besitzt.** Das Call-Ziel liest Jarvis aus
  `user_profiles.daily_call_goal` im CRM (60), die Basis 30 stammt aus dem Plan.
- **`useOptimistic`** für alle Klick- und Eingabe-Rückmeldungen.
- **`npm run core:check`** rechnet alles gegen echte Daten nach — bestes Werkzeug
  bei jedem Datenzweifel.

## Gelöste Probleme (nicht wiederholen)

- **Problem:** Jeder Klick hing sekundenlang.
  **Lösung:** `revalidatePath('/', 'layout')` durch `revalidateTracking()` ersetzt.
  **Warum wichtig:** `'layout'` verwirft das Dashboard-Layout, dessen Datenfunktion
  dann bei jedem Häkchen erneut lief — rund 20 Abfragen pro Klick.

- **Problem:** Haken wurde gesetzt und sprang sofort wieder zurück.
  **Lösung:** `useOptimistic` statt eigenem State.
  **Warum wichtig:** Eigener State, der nach der Server-Action gelöscht wird, fällt
  auf die noch alten Props zurück. Gespeichert war immer korrekt, nur die Anzeige log.

- **Problem:** Zwei Prisma-Clients (`core/db.ts` und `lib/prisma.ts`).
  **Lösung:** `core/db.ts` reicht `lib/prisma.ts` durch.
  **Warum wichtig:** Zwei Clients = zwei Pools, die sich die eine erlaubte
  Verbindung wegnahmen.

- **Problem:** `Promise.all` für Datenbankabfragen.
  **Lösung:** Sequenziell oder `$transaction([...])`.
  **Warum wichtig:** Gemessen — 6 Abfragen parallel 1020 ms, sequenziell 943 ms,
  gebündelt 495 ms. Bei `connection_limit=1` ist parallel am langsamsten.

- **Problem:** Sehr lange Ladezeit beim Start.
  **Lösung:** `EcosystemLoader` entfernt.
  **Warum wichtig:** Ein schwarzer Vollbild-Layer (zIndex 99999), der erst nach
  vollständiger Hydration verschwand. Der Inhalt war längst da und wurde verdeckt.

- **Problem:** Sales-Widgets meldeten dauerhaft 0 Calls.
  **Lösung:** Quelle von `crm_events` auf `crm_calls` umgestellt.
  **Warum wichtig:** `crm_events` ist leer und war jahrelang die falsche Tabelle.

- **Problem:** Schlaf wurde als „0 Stunden" statt „nicht ausgefüllt" gewertet.
  **Lösung:** Quelle filtert 0 heraus (`zeroIsNull`).
  **Warum wichtig:** `jarvis_personal_logs` legt Tageszeilen mit Default 0 an.

- **Problem:** Datenbank-Passwort lag im Klartext in fünf Skripten, Repository ist
  öffentlich.
  **Lösung:** Skripte entfernt. **Rotation steht noch aus** — siehe Action Items.
  **Warum wichtig:** Löschen entfernt nichts aus der Git-Historie.

## Offene Entscheidungen

- **Session-Mode statt Transaction-Mode für die Datenbank?** Tauscht Tempo gegen
  Skalierbarkeit. Erst nach dem Vercel-Regionswechsel bewerten — siehe
  `DATENBANK_BRIEFING.md` §6.
- **G-Projekt:** anbinden gegen `tracker_user_stats` (Live-Daten) oder auf die
  neuen `g_*`-Tabellen warten? Rico entscheidet, wenn die Migration steht.
- **Elektron-Shell:** `package.json` verweist auf `electron/main.js`, das einen
  statischen Export lädt, den es nicht gibt. Behalten oder entfernen?

## Tech Stack & Key Dependencies

- **Next.js 16.2** (App Router) — weicht von Trainingsdaten ab, Docs liegen unter
  `node_modules/next/dist/docs/`. Siehe `AGENTS.md`.
- **React 19** — `useOptimistic` für optimistische Updates
- **Prisma 5.22** + **PostgreSQL 17.6** auf Supabase (Region London)
- **Tailwind v4** — CSS-first `@theme` in `globals.css`, Dark-only
- **Zustand** — nur noch für Content-Kanban und Einstellungen
- **Vercel** — Deployment vom `main`-Branch
- Konfiguration: `DATABASE_URL` mit `pgbouncer=true&connection_limit=1`,
  `DIRECT_URL` für Migrationen, `INGEST_SECRET` für die Apple-Kurzbefehle

## Vision & Langziel

Ein Cockpit, das ehrlich zeigt, ob die täglichen Ursachen erfüllt wurden — auch
und gerade wenn die Antwort unangenehm ist. Alles Weitere (Vertrieb, Health,
Finanzen) hängt daran, nie umgekehrt. Externe Systeme (CRM, Apple, G-Projekt)
liefern Daten, definieren aber nie die Wahrheit im Dashboard — die steht im
Semantic Layer.

## Für nächsten Agent

1. **Zuerst `AGENTS.md`** — Next.js 16 verhält sich anders als du denkst.
2. **Nie `prisma db push`.** Die Datenbank enthält Tabellen fremder Apps
   (`crm_*`, `g_*`, `lead_*`, `user_profiles`), die nicht in `schema.prisma`
   stehen. Migrationen laufen über `npm run core:migrate` (idempotent).
3. **`crm_*` und `g_*`/`tracker_*` nur lesen.** Fremde Anwendungen. Alle Zugriffe
   sind gekapselt: fällt das CRM aus, stehen Metriken auf „nicht gemessen".
4. **Bei Performance-Fragen zuerst `DATENBANK_BRIEFING.md`** — enthält Messungen
   samt Methode. Nicht nochmal von vorn messen.
5. **`/routines` nicht kaputtmachen** — Ziel des iPhone-Widgets (`IOS_WIDGET.md`).
6. Befehle: `npm run core:check` (Daten prüfen), `core:migrate`, `core:seed`,
   `npm run build` (prüft auch Typen), `npm run test:e2e`.

**Weitere Dokumente:** `DATENBANK_BRIEFING.md` · `APPLE_INTEGRATION.md` ·
`IOS_WIDGET.md` · `N8N_FINANCE_WORKFLOW.md` · `TESTING_GUIDE.md` ·
`RICOS_WORKSPACE_GUIDE.md`
