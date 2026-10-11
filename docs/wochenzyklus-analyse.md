# Wochenzyklus — Inventur, Vorschlag, Modellprüfung

Stand 11.10.2026 · Grundlage: `docs/wochenzyklus-spec.md` (verbindlich).
**Nur Analyse und Plan — nichts davon ist umgesetzt.** Supabase-Schema und
CRM-Spiegelung bleiben unangetastet, bis Rico einer Migration zustimmt.

---

## 1. Inventur

### Ziele — drei Orte, drei Besitzer

| Was | Wo | Inhalt heute | Zustand |
|---|---|---|---|
| Tagesziele Jarvis | `core_intentions` | Basis/Soll **pro Tag**, historisiert (`valid_from/to`), Wochentage (`active_weekdays`), abgeleitete Ziele (Routine, Health, CRM) | aktiv |
| Vertriebsziele | `crm_metric_targets` (CRM, nur gelesen) | Calls 30/50, Cold Groß 10/20, Cold Tarif 10/20, Nachgreifen 10/10 — **pro Tag**, historisiert | aktiv, deckt sich mit der Spec |
| Ergebnisziele | `core_goals` | 2 Zeilen: „Umsatzziel Vertrieb" (10.000 € bis 01.03.2027, an `sales.closed_value_eur`), „Lightning CRM verkauft" (`target_value = 'sold'`, keine Kennzahl) | aktiv, aber ohne Verbindung zu den Ursachen |
| Körperziele | `ingest_health_targets` + Intentionen bis 06.10. | seit Phase 2 beendet | nur noch Historie |

**Wochenziele gibt es nirgends gespeichert.** Sie lassen sich aber ohne
Schemaänderung ableiten: Wochenziel = Summe der Tagesziele über die Tage der
Woche, an denen das Ziel gilt (Calls: 6 × 30 = 180 Basis, 6 × 50 = 300
Performance — genau die Spec-Werte). Damit bleiben sie Konfiguration.

### Regeln

`core_metric_definitions` (Domäne `rules`) + Tracker „Regeln", gehalten bis
zum Rückfall (`assumeDoneFrom` 07.10.), gelten Mo–So, Sonntag ist Joker für
die Serie. Funktioniert; die Spec sagt zu Regeln nichts.

### Ursachen

Calls (CRM, `crm_daily_metrics`, implizite 0 — also **0 statt leer**, wie die
Spec verlangt), Training und Post (Tracker „Ursachen"). Alles **tagesbezogen**:
Zustand heute + Serie + Rekord.

### Darstellung heute — und was der Spec widerspricht

| Ort | Zeigt | Spec |
|---|---|---|
| „Heute" Calls-Karte | `0 / 50` heute | ❌ primär muss die **Woche** sein (`32 / 180 · 4 Tage übrig`) |
| „Heute" Ursachen/Regeln | Haken heute + Serie | ⚠️ Serie passt (sekundär), Woche fehlt |
| „Heute" Ringe + Widget | Tagesringe | ⚠️ tagesbezogen — sollten die Woche zeigen |
| „Heute" Aktivität (`ActivityGrid`) | Monats-Heatmap, **rote Tagesflächen** | ❌ ausdrücklich verboten |
| Health, Vertrieb (`ActivityGrid`) | dieselbe Heatmap | ❌ |
| Ziele → Ketten (am 10.10. gebaut) | GitHub-Heatmap, **rote Tage** | ❌ muss weg — Punktreihe pro Woche |
| Verlauf-Leiste | 28 Tage mit roten Punkten, Nachtragen **beliebiger** Tage | ❌ harter Schnitt Sonntag 23:59 fehlt |
| ChatGPT `ursache_eintragen` | heute + gestern | ❌ montags wäre „gestern" die abgeschlossene Woche |
| Wochenbegriff überall | Blockwoche **Di–Mo** (am Planstart 01.09., einem Dienstag, verankert) | ❌ Spec: **Mo 00:00 – So 23:59** |

### Veraltet / wird nirgends mehr gelesen

- `user_profiles.daily_call_goal` — seit 12.09. verwaist (Ziele kommen aus dem CRM).
- `jarvis_tracker_items.required` — seit 28.09. ungenutzt (alle Routineschritte stehen auf `true`, niemand liest es).
- Tracker-Haken „Ursachen / Anrufe" — Quelle mit Priorität 90 hinter dem CRM, gewinnt nie.
- Legacy-Tabellen aus der Electron-Zeit: `goals` (1 Zeile, nirgends gelesen), `content_items` (1, nirgends), `kpis` (5) und `tasks` (15) nur noch von alten Actions/Webhooks (`actions/dashboard.ts`, `/api/webhooks/*`), `settings.dashboard_layout`.
- `crm_events` (leer) — wird noch in `CrmService` und `actions/dashboard.ts` abgefragt.
- `SleepWidget`, `RoutineService.getGProjectScore` — keine Aufrufer mehr in Seiten.
- Körpermetriken: Ziele beendet, Werte laufen weiter ein (bewusst, als „erfasst").

### Zwei Befunde fürs CRM (nicht hier lösen)

1. **Es gibt keine Kennzahl „Termine".** Die Spec verlangt sie pro Woche. Sie
   müsste als `metric_key` in `crm_daily_metrics` dazukommen (CRM-Seite,
   Lesevertrag ergänzen). Bis dahin zeigt Jarvis „Termine: keine Daten aus
   dem CRM" — nie 0.
2. **Die Call-Aufteilung kommt seit 25.09. nicht mehr an**:
   `sales.calls_cold_gross` und `…_cold_tarif` enden am 25.09., `calls_count`
   und `calls_followup` laufen bis 10.10. Wegen der impliziten Null zeigt
   Jarvis für Cold Groß/Tarif seitdem **0** — das ist entweder wahr (nur
   Nachgreifen) oder eine falsche Null. Der CRM-Agent muss das klären.
   Abschlüsse (`sales.closed_count`) zuletzt am 02.09.

---

## 2. Vorschlag: Ursachen auf den Wochenzyklus

**Ein Wochenbegriff für alles: Mo–So.** Die 12-Wochen-Blöcke bleiben als
Plangliederung („Block 1"), aber jede Wochenrechnung (Ansicht, Rückblick,
ChatGPT-Wochenverlauf, Rekordwand) läuft Mo–So. Der Rückblick wandert von
Dienstag auf Montag.

### Hierarchie auf „Heute" (von oben nach unten)

1. **Primär — „Diese Woche"** (neue Karte, ersetzt die Calls-Karte):
   - `32 / 180 Anrufe · 4 Tage übrig` — Ist gegen Basis-Wochenziel, dazu
     Performance-Ziel (300) als zweite Marke auf der Schiene, und was pro
     verbleibendem Tag nötig ist (`noch 37 pro Tag`).
   - darunter der Split Cold Groß · Cold Tarif · Nachgreifen, je gegen sein Wochenziel.
   - Termine, Abschlüsse, Abschlussquote (Abschlüsse / Anrufe) gegen Wochenziel;
     ohne Daten „keine Daten", ohne Ziel „kein Ziel" — nie 0 %.
   - Training und Post ebenso als Woche: `3 / 6 · 4 Tage übrig`.
   - Die **Ringe** bleiben, zeigen aber die Woche (Calls, Ursachen, Regeln).
2. **Sekundär — Serien**: die bestehenden Zeilen mit Kästchen für heute,
   aktueller Serie und Rekord (Tagesminimum = Basis). Brüche bleiben sichtbar.
3. **Tertiär, klein — Historie**: eine Punktreihe je Kennzahl, **ein Punkt
   pro vergangener Woche** (Füllung = Anteil am Wochenziel, monochrom; unter
   Basis = hohler Punkt, kein Rot-Teppich). Ersetzt die Monats-Heatmap auf
   „Heute", Health, Vertrieb und die Ketten auf „Ziele".

### Harter Schnitt Sonntag 23:59

- `TrackingService` lehnt jeden Haken für einen Tag vor dem Montag der
  laufenden Woche ab — **ein** Regelwerk für Dashboard, Verlauf und ChatGPT.
- Verlauf: Tage der laufenden Woche bearbeitbar, ältere Tage nur lesend.
- ChatGPT: „heute und gestern" wird zu „heute und gestern, sofern in dieser
  Woche" (montags nur heute).

### Was bleibt, wie es ist

Ringe-Idee, Widget, Gold-Feier, Stufen, perfekter Tag (tagesbezogen, aber nur
sekundär), Sonntag als Joker für Serien, TrackingService, MCP-Schreibwerkzeuge.

### Reihenfolge (jeweils Tests, Build, Browser Desktop + 375 px, Push nach OK)

| # | Schritt |
|---|---|
| W1 | Wochenbegriff Mo–So (`kalenderWoche()` in `blocks.ts`), alle Wochenrechnungen umstellen, Rückblick montags |
| W2 | `WochenService`: Ist, Basis-/Performance-Wochenziel (aus Tageszielen abgeleitet), Arbeitstage übrig, nötig pro Tag; Split, Termine, Abschlüsse, Quote |
| W3 | „Heute": Wochenkarte primär, Serien sekundär, Wochenpunkte tertiär; Ringe auf Woche; `ActivityGrid` raus |
| W4 | Harter Schnitt in `TrackingService`, Verlauf und ChatGPT |
| W5 | Ziele, Health, Vertrieb: Heatmaps → Wochenpunkte; Widget und ChatGPT-Texte auf Woche |
| W6 | nur nach OK: Migration aus Abschnitt 3 und Ziel↔Ursachen-Ansicht |

---

## 3. Modellprüfung: Zielwert, Deadline, Verknüpfung mit Ursachen

| Anforderung | `core_goals` heute | Reicht? |
|---|---|---|
| Zielwert | `target_value TEXT` (`"10000"`, aber auch `"sold"`) | ⚠️ ja, aber als Text — Rechnen braucht Umwandlung, `"sold"` ist kein Wert |
| Deadline | `horizon_end DATE` | ✅ |
| Messgröße des Ergebnisses | `metric_key` (eine Kennzahl, optional) | ✅ |
| Verknüpfung mit den Ursachen, die einzahlen | — | ❌ fehlt ganz |

**Migrationsvorschlag** (additiv, über `scripts/core-layer.sql` /
`core:migrate`, nichts gelöscht, alter Code liest es einfach nicht):

```sql
-- Welche Ursachen zahlen auf welches Ziel ein (n:m).
CREATE TABLE IF NOT EXISTS core_goal_drivers (
  goal_id     UUID NOT NULL REFERENCES core_goals(id) ON DELETE CASCADE,
  metric_key  TEXT NOT NULL REFERENCES core_metric_definitions(key) ON DELETE CASCADE,
  sort_order  INT  NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',   -- z. B. „jeder Call ist ein Los"
  PRIMARY KEY (goal_id, metric_key)
);

-- Zahl als Zahl; der Text bleibt für Meilensteine ohne Zahl („verkauft").
ALTER TABLE core_goals ADD COLUMN IF NOT EXISTS target_numeric NUMERIC;
UPDATE core_goals SET target_numeric = target_value::numeric
 WHERE target_numeric IS NULL AND target_value ~ '^[0-9]+(\.[0-9]+)?$';
```

Erste Verknüpfung (Vorschlag, Rico entscheidet): „Umsatzziel Vertrieb" ←
Calls, Cold Groß, Cold Tarif, Nachgreifen (und Termine, sobald es sie gibt).
„Lightning CRM verkauft" ← noch keine messbare Ursache — bleibt Meilenstein.

**Nicht nötig:** eigene Spalte für Wochenziele. Solange ein Wochenziel immer
„Tagesziel × Arbeitstage" ist, wird es abgeleitet. Erst wenn eine Ursache ein
**eigenes** Wochenziel bekommen soll (z. B. Training 4× pro Woche statt
täglich), braucht `core_intentions` eine Spalte `period` (`day` | `week`) —
das wäre eine zweite, getrennte Migration.

---

## Offene Entscheidungen für Rico

1. **Woche Mo–So überall** (auch Rückblick, ChatGPT, Rekordwand) — Empfehlung: ja.
2. **Harter Schnitt für alle Haken** (Ursachen, Routinen, Regeln) oder nur Ursachen? Empfehlung: alle — ein Regelwerk.
3. **Training/Post als Woche**: `6 / Woche` (aus dem Tagesziel) oder eigene Wochenziele (dann Migration `period`)?
4. **Ringe auf Woche** umstellen — Empfehlung: ja (Calls · Ursachen · Regeln).
5. **Migration `core_goal_drivers` + `target_numeric`** freigeben?
6. **CRM-Agent beauftragen**: Kennzahl „Termine" liefern, Ausfall der Call-Aufteilung seit 25.09. klären.
