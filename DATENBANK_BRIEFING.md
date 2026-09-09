# Briefing: Datenbank-Situation Jarvis OS

> Stand 2026-09-09 · alle Zahlen selbst gemessen, Methode jeweils angegeben
> Für einen Agenten, der die Datenbankanbindung übernimmt.

---

## 0. Zwei getrennte Probleme

1. **Zugangsdaten liegen öffentlich** — akut, siehe §1.
2. **Jede Abfrage kostet ein Vielfaches dessen, was sie sollte** — siehe §2 ff.

Sie hängen nicht zusammen. Problem 1 ist dringender.

---

## 1. Offengelegte Zugangsdaten (akut)

Das Repository `github.com/ricobusinessworkspace-web/jarvis-os` ist **öffentlich**
(anonymer API-Zugriff liefert HTTP 200). Darin lagen bis heute fünf Skripte mit
der vollständigen Supabase-Verbindung samt Passwort im Klartext:

```
run_pg.js · check_policies.js · check_rls.js
run_bank_migration.js · create_weight_table.js
```

Dazu das Vercel-Protection-Bypass-Token in `MOBILE_WIDGET_HANDOVER.md`.

Die Dateien sind entfernt (Commit `962756e`), **aber die Werte stehen weiter in
der Git-Historie** und sind über GitHub abrufbar. Löschen allein genügt nicht.

**Erforderlich:**

1. Supabase-Datenbankpasswort zurücksetzen, danach `DATABASE_URL` und
   `DIRECT_URL` in Vercel **und** in der lokalen `.env` aktualisieren.
2. Vercel-Bypass-Token neu erzeugen; das iPhone-Widget in Scriptable
   nachziehen (siehe `MOBILE_WIDGET_HANDOVER.md`).
3. Repository auf privat stellen, falls nicht bewusst öffentlich.
4. Optional: Historie bereinigen (`git filter-repo`). Nur sinnvoll **nach**
   der Rotation und mit Wissen, dass alle Klone ungültig werden. Die Rotation
   ist der eigentliche Schutz, nicht das Umschreiben.

---

## 2. Die Anbindung

```
DATABASE_URL  aws-1-eu-west-2.pooler.supabase.com:6543
              ?pgbouncer=true&connection_limit=1     ← Transaction-Mode
DIRECT_URL    aws-1-eu-west-2.pooler.supabase.com:5432
              (keine Parameter)                      ← Session-Mode
```

- PostgreSQL 17.6, Region **eu-west-2 (London)**
- Prisma 5.22, Next.js 16.2 auf Vercel
- `connection_limit=1` ist für Serverless korrekt: jede Funktionsinstanz
  bekommt genau eine Verbindung, damit viele Instanzen den Pooler nicht
  erschöpfen.

---

## 3. Messungen

**Methode:** Mittel aus 10 Durchläufen, jeweils nach einem Aufwärmlauf,
ausgeführt von einem Mac in Deutschland gegen London.

### 3.1 Netz und Protokoll

| Messung | Wert |
|---|---|
| Roher `pg`-Client, eine Abfrage | **26 ms** |
| Prisma über Pooler (6543), eine Abfrage | **155 ms** |
| Prisma über Direkt (5432), eine Abfrage | **36 ms** |

### 3.2 Die Ursache — Anweisungen pro logischer Abfrage

Gezählt über Prismas `query`-Event für **eine** `tracker.count()`:

```
POOLER 6543 : 4 Anweisungen → BEGIN | DEALLOCATE ALL | SELECT COUNT(*) | COMMIT
DIREKT 5432 : 1 Anweisung   → SELECT COUNT(*)
```

Mit `pgbouncer=true` schaltet Prisma Prepared Statements ab und umschließt
jede Abfrage mit Transaktion und `DEALLOCATE ALL`. **Aus einem Round-Trip
werden vier.** Bei 26 ms Latenz sind das 104 ms statt 26 ms — der gemessene
Unterschied 155 zu 36 ms.

### 3.3 Ein vollständiger Dashboard-Aufruf

| | Pooler (6543) | Direkt (5432) |
|---|---|---|
| Dauer | **1490 ms** | **951 ms** |
| SQL-Anweisungen | **35** | **15** |
| davon Nutzlast (SELECT) | 11 | 11 |
| Protokoll-Overhead | 24 | 4 |

Elf echte Abfragen, 35 Anweisungen. Zwei Drittel des Verkehrs ist Protokoll.

### 3.4 Parallelität hilft nicht — sie schadet

Sechs unabhängige Abfragen:

| Strategie | Dauer |
|---|---|
| `Promise.all` | **1020 ms** |
| nacheinander `await` | 943 ms |
| `$transaction([...])` | **495 ms** |

Bei `connection_limit=1` konkurrieren parallele Abfragen um dieselbe
Verbindung und werden langsamer als sequenzielle. `$transaction` mit einem
Array bündelt sie dagegen in eine Runde.

---

## 4. Die Kausalkette

```
Kosten ≈ Anzahl Anweisungen × Netzlatenz
```

Beide Faktoren sind derzeit ungünstig:

- **Anweisungen:** ×4 durch den Transaction-Mode-Overhead
- **Latenz:** Datenbank in London. Vercel deployt standardmäßig nach
  Washington (`iad1`) — rund 80 ms über den Atlantik.

Steht Vercel wirklich in `iad1`, kostet ein Dashboard-Aufruf dort
**35 × 80 ms ≈ 2,8 s allein an Netzwerkzeit** — unabhängig von jeder
Code-Optimierung. Genau das beschreibt der Nutzer als „hängt".

**Der Regionswechsel ist der größte Hebel und kostenlos.** Er senkt die
Latenz auf 1–2 ms, wodurch der Protokoll-Overhead praktisch verschwindet.

---

## 5. Bereits erledigt — bitte nicht wiederholen

- **Ein Prisma-Client statt zwei.** `src/core/db.ts` reicht `src/lib/prisma.ts`
  durch. Vorher legte jedes Modul einen eigenen Client mit eigenem Pool an;
  beide teilten sich die eine erlaubte Verbindung.
- **Kein `Promise.all` mehr** auf Prisma-Aufrufe (siehe 3.4).
- **`$transaction`-Bündel** für Semantic-Layer-Konfiguration und Layout-Abfragen.
- **Fünf Quellabfragen zu einer `UNION ALL`-Abfrage** zusammengelegt
  (`AnalyticsService.loadAllRows`).
- **`getRoutineBlocks`** war ein verschachteltes `include`, das Prisma in
  mehrere Runden auflöste — jetzt eine Rohabfrage (747 ms → 126 ms).
- **Konfigurationscache**, 30 s TTL, wird bei Soll-Änderungen geleert.
- **`revalidatePath('/', 'layout')` entfernt.** Es verwarf das Layout, dessen
  Datenfunktion dann bei jedem Klick erneut lief.
- **Layout-Abfragen von sieben auf zwei** reduziert.
- Alle Zugriffe auf fremde Tabellen (`crm_*`) sind gekapselt: fällt das CRM
  aus, stehen Metriken auf „nicht gemessen", die Seite bleibt stehen.

Ergebnis lokal: Seitenaufruf 3,4 s → etwa 1,1 s.

---

## 6. Offene Optionen

### 6.1 Vercel-Region auf London — zuerst machen

Settings → Functions → Region → `lhr1`, danach neu deployen.
Kostenlos, kein Code, größter Effekt. **Vorher prüfen, wo aktuell deployt
wird** — steht das ohnehin schon auf `lhr1`, ist diese Analyse hinfällig und
die Ursache liegt woanders.

### 6.2 Session-Mode statt Transaction-Mode — mit Vorsicht

`DATABASE_URL` auf Port 5432 ohne `pgbouncer=true` umstellen: 15 statt 35
Anweisungen pro Aufruf.

**Risiko:** Session-Mode bindet je Client eine echte Serververbindung. Bei
vielen gleichzeitigen Serverless-Instanzen kann das die Verbindungen des
Projekts erschöpfen. Für einen Einzelnutzer wahrscheinlich unkritisch, aber
es ist ein Tausch von Tempo gegen Skalierbarkeit — bitte bewusst entscheiden
und mit `connection_limit` (etwa 3–5) begrenzen.

Erst nach 6.1 bewerten: in London könnte der Mehraufwand irrelevant sein.

### 6.3 Weniger Abfragen

Elf SELECTs pro Aufruf sind noch nicht das Minimum. Zusammenlegbar wären
`WeightService.getLatest`, die Reminder-Abfrage und die Layout-Abfragen — mit
`$transaction` oder als gemeinsame `UNION`-Abfrage. Erwartete Ersparnis
gering, solange 6.1 offen ist.

### 6.4 Nicht empfohlen

- **`connection_limit` hochsetzen, um zu parallelisieren.** Messung 3.4 zeigt:
  `Promise.all` ist auch dann nicht der Gewinn, den man erwartet, und das
  Limit von 1 schützt den Pooler.
- **`pgbouncer=true` einfach entfernen, Port 6543 behalten.** Im
  Transaction-Mode brechen Prepared Statements dann sporadisch — Fehler, die
  erst unter Last auftreten.

---

## 7. Nachmessen

```bash
npm run core:check     # rechnet alle Metriken gegen echte Daten nach
npm run build          # Produktionsbuild inklusive Typprüfung
```

Für Zeitmessungen: Prismas `query`-Event mitschreiben und Anweisungen zählen —
die Anzahl der Anweisungen ist aussagekräftiger als die Millisekunden, weil
sie unabhängig vom Standort des Messrechners ist.

```ts
const p = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
p.$on('query', e => console.log(e.query.split(' ')[0]));
```

---

## 8. Fallstricke

- **Nie `prisma db push`.** Die Datenbank enthält Tabellen fremder
  Anwendungen (`crm_*`, `g_*`, `lead_*`, `user_profiles`), die nicht in
  `schema.prisma` stehen. `db push` würde sie löschen. Migrationen laufen
  über `scripts/core-layer.sql` per `npm run core:migrate` (idempotent).
- **`crm_*` und `g_*`/`tracker_*` gehören fremden Apps.** Nur lesen.
- **`crm_events` ist leer** und war lange die falsche Quelle für Anrufe.
  Richtig ist `crm_calls`, gefiltert auf `by_user_name`.
- **`jarvis_personal_logs` legt Tageszeilen mit Default 0 an.** Dort heißt 0
  „nicht ausgefüllt", nicht „null Stunden".
- Weiteres in `HANDOVER.md`.
