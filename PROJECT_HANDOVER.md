# 🤝 Project Handover: Jarvis OS Cockpit (Update)

Dieses Dokument dient als nahtlose Übergabe für den nachfolgenden Entwicklungs-Agenten / Feature Builder. Es beschreibt den **hochaktuellen Entwicklungsstand**, die stark vereinfachte und extrem performante Systemarchitektur, Datenmodelle, Schlüsselkomponenten und die Philosophie für die künftige Arbeit.

---

## ⚡ 1. Projekt-Überblick & Vision
Jarvis OS ist ein hochintegriertes, personalisiertes Offline-First-Cockpit für Rico. Das System ist im edlen **Apple-Minimal-Dark-Design** gehalten, läuft extrem performant auf einer lokalen SSD und vereint Leistungstracking, Wissensdatenbank und einen sprachgesteuerten KI-Assistenten (Jarvis).

**Zentrale Änderung (Architektur-Shift):**
Das Projekt wurde von einer fehleranfälligen Cloud-Lösung auf eine **100% lokale, autarke SQLite-Datenbank** im Electron-Prozess umgebaut. Dieser Schritt garantiert maximale Performance, Offline-Fähigkeit und Stabilität.

---

## 🏗️ 2. Technische Architektur

### Frontend (Next.js + Tailwind + Framer Motion)
- **State Management:** Zustand (`src/lib/store.ts`). Der Store hält alle Daten lokal und synchron.
- **Hydratisierung:** Ein `StoreHydrator.tsx` lädt beim App-Start alle Daten via IPC-Call aus dem Backend und lauscht auf `dashboard-data-updated` Events.
- **Design-System:** Apple-Style (Glasmorphismus, abgerundete Ecken, große Hierarchien). Speziell optimiert für **11,9-Zoll Screens** durch kompakte 3-Sektionen-Aufteilung (Daily Focus, Tracking, Trends).

### Backend (Electron + SQLite)
- **Kommunikation:** Ausschließlich über IPC (`window.electronAPI`). Keine API-Routen (`/api/*`) oder Server Actions!
- **Datenbank (`electron/database.js`):** Komplett lokale SQLite. 
- **Tabellen-Schema:** 
  - `tasks`, `content_items`, `trackers`, `tracker_items`, `tracker_logs`, `personal_logs`, `settings`, `crm_task_overrides`.

---

## 🚀 3. Aktueller Stand (Zuletzt implementierte Features)

1. **Vollständiges 11,9" Redesign:**
   - Aufteilung in 3 Ebenen: Daily Focus (Oben), Habit & Health Tracking (Mitte, volle Breite), Trends & Analytics (Unten).
2. **Schlaf-Tracking (Bettzeit & Wachzeit):**
   - Das Schlaf-Tracking nutzt nun echte Uhrzeiten (native `<input type="time" />` Felder im Glasmorphismus-Design) anstatt fester Stunden. 
   - `database.js` berechnet die geschlafenen Stunden automatisch (`calculateSleepHours`) unter Berücksichtigung von Mitternacht.
3. **Hardcore 5 AM Streak Widget:**
   - Berechnet sich komplett lokal aus der Historie.
   - **Regel:** Wer um oder vor `05:00` aufsteht, behält den Streak. Wer um `05:01` oder später aufsteht, bricht ihn.
4. **Wochen-Historie (Zeitmaschine):**
   - Im Habit-Tracker kann über Pfeile (◀ / ▶) in die Vergangenheit navigiert werden, um alte Konstanz- und Schlafdaten anzuschauen.
5. **Mahlzeiten-Widget entfernt:** Das Cockpit wurde bereinigt.

---

## 🔮 4. Entwickler-Guidelines (WICHTIG für den nächsten Agenten)

- **Keine Cloud:** Alle neuen Features müssen via `database.js` in SQLite wandern.
- **Keine Next.js Backend-Logik:** Keine `route.ts`, keine Server Actions, kein Prisma, kein Drizzle. Das Frontend ist "dumm" und macht nur IPC-Calls an Electron.
- **UI First:** Rico legt massiven Wert auf ein flüssiges, wunderschönes Apple-artiges UI. Nutze Animationen (Framer Motion), weiche Schatten und `backdrop-blur`. 
- **11,9" Screen-Größe beachten:** Baue keine Tabellen, die endlos horizontal scrollen. Nutze Platz effizient.
- **Kein Polling:** Updates passieren event-driven. Das Frontend wartet auf Updates vom Backend (`dashboard-data-updated`).

---

## 🛠️ 5. Befehle zum Starten
1. Terminal 1: `npm run dev` (Startet den Next.js Frontend Server auf Port 3000)
2. Terminal 2: `npm run electron:dev` (Startet die Electron-App und öffnet das Window)
