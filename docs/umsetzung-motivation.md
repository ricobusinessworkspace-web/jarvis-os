# Umsetzung Motivationssystem (Schritte 4–8)

Stand 09.10.2026 · Arbeitsplan zu `docs/plan-chatgpt-schreiben-und-motivation.md`,
Teil C. Rico ist unterwegs und hat freigegeben: **jeder Schritt wird nach grünen
Tests, Build und Browser-Check (Desktop + 375 px) gepusht und in Production
geprüft**; Testhaken im Browser sind erlaubt, wenn sie sofort zurückgenommen und
in der DB gegengeprüft werden; das neue Scriptable-Widget darf mit Token in den
iCloud-Ordner.

Haken = erledigt. Jeder Schritt endet mit Commit, Push, Production-Prüfung,
Handover-Delta.

---

## Grundentscheidungen (gelten für alle Schritte)

1. **Eine Rechenstelle: `MotivationService`** (`src/core/services/`).
   Serien, Stufen, Ringe, perfekter Tag, Rekordwand, Wochenrückblick,
   Erinnerungstext — alles aus `AnalyticsService.getMatrix` + `summarize`.
   Die reine Logik (ohne DB) liegt in `src/lib/motivation.ts` und ist
   vollständig unit-getestet. Dashboard, Ziele-Seite, Widget-Endpunkte und MCP
   formen nur um.
2. **Optimistisches Feedback ohne Erfinden.** Der Server liefert je Zeile die
   Serie für beide Fälle („wenn heute erledigt" / „wenn nicht") — gerechnet
   mit `summarize` auf einer Kopie der Matrix, in der nur die heutige Zelle
   ersetzt ist. Der Browser wählt nur aus, er zählt nicht selbst.
3. **Ein gemeinsamer Zustand für „Heute"** (`TodayProvider`, Client): Ursachen,
   Regeln und Routine teilen sich ein `useOptimistic`. Nur so können Ringe und
   „perfekter Tag" live mitlaufen, wenn irgendwo ein Haken fällt.
4. **Gold nur für Belohnungen.** Token `--color-gold` in `globals.css`
   (`@theme`), dazu `gold-glow`. Verwendet ausschließlich für erreichte
   Meilensteine (ab Stufe 7), Rekorde, geschlossene Ringe, perfekten Tag.
5. **Was schon gefeiert wurde, merkt sich `localStorage`** — je Gerät, mit
   try/catch; ohne Speicher wird höchstens doppelt gefeiert, nie falsch.
6. **Ton nur auf Tipp** (iOS-Regel), Web Audio, keine Dateien, Schalter
   „Töne" (Standard an, `localStorage`), erreichbar auf der Ziele-Seite und
   per ⌘K.
7. **Sonntag = Joker** wird sichtbar: in Regelzeilen am Sonntag und in den
   Ketten (Heatmaps) als eigene Markierung.

### Definitionen (fest, im Code dokumentiert)

- **Stufen:** 3 · 7 · 14 · 21 · 30 · 50 · 100 Tage. Stufe = höchste erreichte
  Marke ≤ Serie. Ab 7 Gold.
- **Perfekter Tag:** alle Ursachen mit Ziel an dem Tag erfüllt, beide Routinen
  mindestens Basis, keine Regel gebrochen. Gezählt **ab Phase 2** (erst seitdem
  gibt es Regeln — davor wäre die Bedingung eine andere). Ein Tag ohne
  Ursachen/Routinen mit Ziel (Sonntag) ist nie perfekt, reißt aber die Serie
  perfekter Tage nicht (Joker). Heute zählt erst, wenn er perfekt ist.
- **Ringe heute:** Ursachen = erfüllte / Ursachen mit Ziel heute;
  Routinen = erledigte Schritte / Soll beider Routinen; Regeln = gehalten /
  alle. Ein Ring ist „geschlossen", wenn erfüllt = gesamt (> 0).
- **Neuer Rekord** (Dashboard wie ChatGPT): nur durch eine Handlung, ab 2 Tagen.

---

## Schritt 4 — C1 + C4: Feedback, Ton, Serienstufen, Gold

- [x] Gold-Token in `globals.css`
- [x] `src/lib/motivation.ts`: `MEILENSTEINE`, `stufe(serie)`, `naechsteStufe`,
      `serieMitHeute(matrix, key, heute, zelle, opts)` (Was-wäre-wenn über `summarize`)
- [x] `src/lib/sound.ts`: `tick()`, `fanfare()` (zwei Sinus, ~80 ms, Hüllkurve),
      `toeneAn()/setToene()` über `localStorage`
- [x] Dashboard-Seite liefert je Ursache/Regel: `streakIfDone`, `streakIfNot`,
      `bestIfDone`, `runStart` (für „schon gefeiert")
- [x] `HabitRow` mit framer-motion: Kästchen ploppt, Flamme zuckt, Zahl zählt
      (Schlüssel-Wechsel), Flamme wächst mit der Stufe, ab 7 Gold; „Neuer
      Rekord" als kurzer Gold-Glanz; Sonntag-Joker-Hinweis bei Regeln
- [x] `RoutineCard`: Haken ploppt, Ton beim Abhaken
- [x] Meilenstein-Feier (Gold, in der Zeile statt Toast) einmal je Lauf und Stufe
- [x] ⌘K-Befehl „Töne an/aus"
- [x] Tests: `motivation.test.ts` (Stufen, Was-wäre-wenn inkl. Joker und Regeln)
- [x] Browser: Training an/aus mit Rücknahme + DB-Check; 375 px

## Schritt 5 — C2 + C3: Tagesringe, perfekter Tag

- [x] `TodayProvider` (gemeinsames `useOptimistic`) — Ursachen, Regeln,
      Routine darauf umstellen, Verhalten unverändert
- [x] `motivation.ts`: `ringe(...)`, `istPerfekt(...)`, `perfekteTage(matrix, ...)`
      (Anzahl, Serie, Rekord) — Tests
- [x] `DayRings` oben auf „Heute": drei Ringe, live, geschlossen = Gold-Rand
- [x] Feier „Perfekter Tag Nr. N": Orb in Gold (`JarvisOrb` Variante, nur CSS),
      Text, Doppelton; einmal je Tag (`localStorage`); kommt der perfekte Tag
      von außen (ChatGPT), Feier ohne Ton beim nächsten Laden
- [x] Browser: Ringe ändern sich beim Abhaken; Feier per Vorschau ohne echte
      Daten prüfen (Testschalter nur im Dev: `?feier=1`)

## Schritt 6 — C5: Ziele-Seite als Zielbild

- [ ] `MotivationService.zielbild()`: Reise (Planstart → 01.03.2027, Blöcke,
      Phasen, „Du bist hier", Countdown), Umsatz (kumuliert, Ziel aus
      `core_goals`; ohne Wert „noch keine Provision erfasst"), Ketten je
      Ursache/Regel (Tageszustände + Serie/Rekord), Rekordwand
- [ ] Rekordwand: längste Serien je Kennzahl, perfekte Tage (Anzahl, längste
      Serie), beste Blockwoche nur bei Abdeckung ≥ 0,7, erreichte
      Meilensteine in Gold
- [ ] Seite: Reise → Ergebnis → Ketten → Rekordwand → Einstellungen
      (`GoalsEditor` + Töne-Schalter, eingeklappt)
- [ ] Tests für `zielbild`-Logik (Umsatz ohne Wert, beste Woche, Ketten mit Joker)
- [ ] Browser Desktop + 375 px (Heatmap scrollt horizontal, keine Seitenbreite)

## Schritt 7 — C6: Erinnerung per Kurzbefehl

- [ ] `GET /api/widgets/nudge` (`checkWidgetAuth`) → `{ zeigen, titel, text }`
      aus `MotivationService.erinnerung()`: Serie in Gefahr > nahe Stufe >
      Routine offen > Calls unter Basis; alles erledigt → `zeigen: false`
- [ ] Tests der Auswahl-Logik
- [ ] `docs/apple-shortcuts.md`: Kurzbefehl „Jarvis Erinnerung" +
      Automationen 18:00 / 21:30 — Rico richtet ein
- [ ] Production: Endpunkt ohne Token 401, mit Token Antwort

## Schritt 8 — C7 + C8: Wochenrückblick, Widget

- [ ] `motivation.ts`: `wochenrueckblick(matrix, woche)` — Quoten, neue
      Rekorde, beste Ursache, eine Sache für nächste Woche (aus den Daten)
- [ ] Karte auf „Heute" dienstags (Wochenstart), wegklickbar (`localStorage`)
- [ ] MCP: `performance_wochenverlauf` bekommt `rueckblick` der letzten
      abgeschlossenen Woche
- [ ] `GET /api/widgets/motivation`: Ringe, perfekter Tag, Top-Serien, Texte
- [ ] `scriptable/jarvis-ringe.js`: Ringe + Serien, klein/mittel/Sperrbildschirm;
      mit Token in iCloud-Scriptable-Ordner
- [ ] `docs/ios-widget.md` ergänzen
- [ ] Production prüfen

---

## Fortschritt

- **10.10., Schritt 5 fertig und live.** `TodayProvider` (ein `useOptimistic`
  für Ursachen, Regeln, Routine), `DayRings` oben auf „Heute" (live, Gold-Rand
  bei geschlossenem Ring), „Perfekte Tage N · Serie · Rekord" ab Phase 2,
  beide Fälle vom Server (`perfekteTage(…, heuteAls)`). Feier: Orb in Gold
  (`.orb--gold`, nur CSS) + Text + Doppelton, einmal je Tag; **per Portal an
  `<body>`** — ein Vorfahr mit `backdrop-filter` hatte `fixed` sonst unter den
  Bildschirm geschoben. Dev-Vorschau `?feier=1`. Browser: Post an → Ring 2/3
  sofort, zurück, DB wie vorher.
- **10.10., Schritt 4 fertig und live.** Dashboard liefert je Ursache/Regel den
  `ausblick` (Serie für beide Fälle); Karten schalten Serie optimistisch um,
  `useFeier` spielt Tick bzw. Doppelton und zeigt „Stufe N erreicht" /
  „Neuer Rekord" in Gold (Stufe einmal je Lauf, `localStorage`). Regel-Rückfälle
  ohne Ton; am Sonntag „Sonntag ist Joker, Serie bleibt". Routine: Tick beim
  Abhaken. ⌘K: „Töne an/aus" (`useToene`). Getestet: 108 Tests; im Browser Post
  an (Serie 0→1 sofort) und zurück, DB danach wie vorher (Ricos echte Haken unberührt).
