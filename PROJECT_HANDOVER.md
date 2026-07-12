# 🤝 Project Handover: Jarvis OS (Local CLI Edition)

**To:** Next Lead Developer / Agent
**From:** Previous Agent
**Date:** 2026-07-11 / 2026-07-12

Dieses Dokument dient als nahtlose Übergabe für den nachfolgenden Entwicklungs-Agenten. Es beschreibt den brandaktuellen Architekturwechsel, der in den letzten Sessions vollzogen wurde, und den exakten Entwicklungsstand.

---

## ⚡ 1. Projekt-Überblick & Vision (Architektur-Shift)
Jarvis OS sollte ursprünglich eine Vercel-gehostete Web-App mit UI sein. Aufgrund von strengen API Rate Limits (Google Gemini Free Tier) und nervigen Vercel-Deployments hat Rico (der User) jedoch beschlossen:
**Jarvis läuft ab sofort primär als lokales Command-Line-Interface (CLI) auf seinem Mac.**

Dadurch sparen wir uns komplizierte Web-UIs, Streaming-Proxies und Deployments und haben ein pfeilschnelles, lokales "Brain", das direkt mit der Datenbank spricht und sofort antwortet.

---

## 🏗️ 2. Neue Technische Architektur

Die Architektur ist extrem entschlackt und auf Geschwindigkeit optimiert:

- **Core Script:** `jarvis-cli.mjs` (Lokal ausgeführt per `node jarvis-cli.mjs` oder via Desktop Shortcut)
- **LLM / Brain:** **Groq** mit dem Modell `llama-3.3-70b-versatile`. Extrem schnelles Function Calling und Inference via LPU.
- **Voice / TTS:** **ElevenLabs**. Wir nutzen aktuell die Standard-Stimme "Brian" (`nPczCjzI2devNBz1zQrb`), da Ricos favorisierte deutsche Community-Stimme (Thomas Schendel) auf der ElevenLabs Free-Tier API nicht zugelassen ist. Die Audioausgabe erfolgt lokal via macOS `afplay`.
- **Datenbank:** Supabase PostgreSQL, direkt angebunden über **Prisma** (`executeTool` in der CLI führt Prisma Queries nativ aus, ganz ohne HTTP Backend).
- **Environment:** `.env` im Projekt-Root beinhaltet alle Secrets (Groq, ElevenLabs, Supabase DB URLs).

---

## 🚀 3. Aktueller Stand (Was wurde gemacht?)
1. **Next.js Web-UI gelöscht:** Alle Routen unter `src/app/(dashboard)/jarvis`, API Routen (`src/app/api/jarvis`) und Komponenten (`src/components/jarvis`) wurden vom User restlos gelöscht. Das Next.js Projekt dient nur noch als Hülle für andere Tools (G Project, CRM).
2. **LLM Migration:** Das Google Gemini SDK wurde durch das `groq-sdk` ersetzt. Die Message- und Tool-Struktur wurde auf den OpenAI-Standard umgeschrieben.
3. **Persönlichkeit geupdatet:** Jarvis hat nun einen trockenen, sarkastischen britischen Humor einprogrammiert bekommen.
4. **Desktop Shortcut:** Auf Ricos Desktop liegt eine `Jarvis.command` Datei, mit der er die CLI per Doppelklick direkt starten kann.
5. **Erfolgreich getestet:** Die CLI funktioniert hervorragend. Tools wie `getCrmOverview` werden von Groq erkannt, die Prisma-Query läuft durch und ElevenLabs spricht die Antwort aus.

---

## 🚨 4. Bekannte Einschränkungen & Next Steps

### ElevenLabs Free-Tier Restriktion
Rico wollte ursprünglich die Voice ID `Fghah4fztZORbiKfIGAs` (Thomas Schendel, die deutsche Synchronstimme von Iron Mans Jarvis). Da dies eine "Library Voice" ist, wirft die ElevenLabs API einen `payment_required` 401 Fehler.
**Lösung:** Wir haben als Fallback die Standardstimme "Brian" (`nPczCjzI2devNBz1zQrb`) eingestellt. Sollte Rico sein ElevenLabs auf "Creator" ($5) upgraden, kann die Voice-ID in der `.env` wieder auf Thomas Schendel geändert werden.

### Deine Aufgaben für die Zukunft (Next Steps)
- **Features erweitern:** Da Jarvis jetzt stabil als CLI läuft, kannst du weitere Tools in `toolDeclarations` und `executeTool` in `jarvis-cli.mjs` einbauen (z.B. Google Calendar Integration oder Apple Notes auslesen).
- **Refactoring (Optional):** Aktuell ist die gesamte CLI Logik (Tools, LLM-Aufrufe, ElevenLabs, Prisma) monolithisch in der `jarvis-cli.mjs` Datei (ca. 400 Zeilen). Bei Bedarf kannst du das in saubere Module (z.B. `src/lib/tools/...`) auslagern.

---

## 🔮 5. Entwickler-Guidelines
- **Fokus auf CLI:** Baue keine neuen Next.js Routen oder React-Komponenten für Jarvis. Alles für Jarvis passiert in der lokalen Node-Umgebung!
- **Dependencies:** Wenn du neue Node-Module brauchst (z.B. für lokale Dateioperationen), installiere sie ganz normal, aber stelle sicher, dass sie in der `jarvis-cli.mjs` richtig importiert werden.
- **Fehlerbehandlung:** Da es ein interaktives CLI ist, fange API-Fehler (Rate Limits, Offline) sauber mit `try/catch` ab, damit das Programm in der REPL-Schleife (`readline`) bleibt und nicht komplett crasht.
