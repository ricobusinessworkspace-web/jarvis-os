# Jarvis OS

Persönliches Operating System. Kern ist ein **Command Center**, das den
6-Monats-Plan gegen echte Daten hält — nach dem Prinzip *Ursachen vor
Wirkungen*: die tägliche Handlung ist die Stellschraube, Umsatz und Pipeline
sind Folgen.

## Loslegen

```bash
npm install
npm run dev
```

Braucht `DATABASE_URL` und `DIRECT_URL` in `.env` (siehe `.env.example`).

## Ansichten

| Route | Inhalt |
|---|---|
| `/` | Heute — Calls, Körper, Ursachen, Routine, Aufgaben, Monatsverlauf |
| `/verlauf` | Tage nachtragen und korrigieren |
| `/vertrieb` | Calls gegen CRM-Ziel, Pipeline |
| `/health` | Training, Schlaf, Gewicht |
| `/content`, `/finance` | Content-Kanban, Finanzen |

## Befehle

```bash
npm run core:migrate   # Tabellen anlegen (idempotent)
npm run core:seed      # Semantic Layer befüllen (idempotent)
npm run core:check     # Daten gegen die Datenbank nachrechnen
npm run build          # Produktionsbuild inkl. Typprüfung
npm run test:e2e       # Playwright-Rauchtest (einzige Testsuite)
```

## Dokumente

- **`HANDOVER.md`** — Projektstand, gelöste Probleme, offene Entscheidungen.
  **Erster Anlaufpunkt für jeden Agenten**, enthält eine vollständige Doku-Übersicht.
- `AGENTS.md` — Regeln für KI-Agenten + Arbeitsablauf
- `DATENBANK_BRIEFING.md` — Datenbank-Performance, Messungen, offene Punkte
- `docs/` — Runbooks für einzelne Integrationen (Apple-Kurzbefehle, iOS-Widget, Bank-Sync)
- `~/dev/coding-workflow-standards.md` — projektübergreifend, außerhalb des Repos

## Warnung

Migrationen laufen über `scripts/core-layer.sql`, **nicht** über
`prisma db push`. Die Datenbank enthält Tabellen fremder Anwendungen
(`crm_*`, `g_*`, `user_profiles`), die nicht in `schema.prisma` stehen —
`db push` würde sie löschen.
