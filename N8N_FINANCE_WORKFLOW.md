# Bank Sync – Setup Guide

Automatische Synchronisation deiner Bankumsätze (BW-Bank + DKB) via FinTS direkt in Jarvis OS.

---

## Voraussetzungen

- Node.js installiert
- Jarvis OS Projekt mit `npm install` aufgesetzt
- Online-Banking bei BW-Bank und/oder DKB aktiviert
- FinTS/HBCI-Zugang bei deiner Bank freigeschaltet

---

## 1. Env-Variablen eintragen

Öffne `/Users/rico/dev/Jarvis OS/.env` und füge am Ende hinzu:

```env
# ── Banking (FinTS) ──
# BW-Bank (Privat)
FINTS_BW_URL="https://banking-li4.s-fints-pt-li.de/fints30"
FINTS_BW_BLZ="60050101"
FINTS_BW_USER="dein-anmeldename"
FINTS_BW_PIN="dein-online-banking-pin"

# DKB (Geschäftlich)
FINTS_DKB_URL="https://fints.dkb.de/fints"
FINTS_DKB_BLZ="12030000"
FINTS_DKB_USER="dein-anmeldename"
FINTS_DKB_PIN="dein-online-banking-pin"
```

> **Anmeldename BW-Bank:** Ist dein Online-Banking Anmeldename (nicht die Kontonummer).
> **Anmeldename DKB:** Ist in der Regel dein Benutzername aus dem Online-Banking.

---

## 2. Erster Testlauf

```bash
cd "/Users/rico/dev/Jarvis OS"
npm run sync:banks
```

Beim **ersten Lauf** wird wahrscheinlich eine TAN abgefragt (pushTAN oder chipTAN). Bestätige diese in deiner Banking-App. Danach funktioniert der Sync für ca. 90 Tage ohne TAN.

---

## 3. n8n Automatisierung

Importiere die Datei `Jarvis_Finance_Workflow.json` von deinem Desktop in n8n:

1. Öffne n8n → Neuer Workflow → ⋯ → **Import from File**
2. Wähle `Jarvis_Finance_Workflow.json`
3. Workflow auf **Active** stellen

Der Workflow hat nur 2 Nodes:
- **Schedule Trigger:** Läuft täglich um 03:00 Uhr
- **Execute Command:** Startet `npm run sync:banks`

---

## 4. Optionen

```bash
# Standard: Letzte 2 Tage
npm run sync:banks

# Letzte 7 Tage (z.B. nach Urlaub)
npx tsx scripts/sync-banks.ts --days 7

# Letzte 30 Tage (initialer Import)
npx tsx scripts/sync-banks.ts --days 30
```
