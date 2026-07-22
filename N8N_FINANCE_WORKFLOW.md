# n8n Finance Workflow – Setup Guide

Diese Anleitung beschreibt, wie du den n8n-Workflow aufsetzt, der täglich deine Bankumsätze automatisch an Jarvis OS pusht.

---

## Voraussetzungen

1. **GoCardless Account** — Erstelle einen kostenlosen Account auf [GoCardless Bank Account Data](https://bankaccountdata.gocardless.com/)
2. **n8n** — Lokal oder gehostet erreichbar (Default: `http://localhost:5678`)
3. **Jarvis OS** — Deployed auf Vercel mit aktiver `/api/webhooks/finance` Route

---

## 1. GoCardless Setup

### API Credentials
1. Gehe zu [GoCardless Dashboard](https://bankaccountdata.gocardless.com/) → **User Secrets**
2. Erstelle ein neues Secret → du erhältst `secret_id` + `secret_key`

### Bank-Verbindung (Requisition)
1. Im GoCardless Dashboard → **Requisitions** → **New Requisition**
2. Wähle dein Land (DE) und deine Bank (z.B. N26, Sparkasse, etc.)
3. Du wirst zur Bank weitergeleitet, um den Zugriff zu autorisieren
4. Nach der Autorisierung erhältst du eine **Requisition ID** und die verknüpften **Account IDs**

> **Wichtig:** PSD2-Zugriffe laufen alle 90 Tage ab. Du musst den Consent dann erneuern.

---

## 2. n8n Workflow erstellen

### Node 1: Cron Trigger
- **Trigger Interval:** Every Day
- **Hour:** 3 (03:00 Uhr nachts)
- **Timezone:** Europe/Berlin

### Node 2: HTTP Request – Access Token
- **Method:** POST
- **URL:** `https://bankaccountdata.gocardless.com/api/v2/token/new/`
- **Body (JSON):**
  ```json
  {
    "secret_id": "{{$env.GOCARDLESS_SECRET_ID}}",
    "secret_key": "{{$env.GOCARDLESS_SECRET_KEY}}"
  }
  ```
- **Response:** Enthält `access` Token (gültig 24h)

### Node 3: HTTP Request – Transactions abrufen
- **Method:** GET
- **URL:** `https://bankaccountdata.gocardless.com/api/v2/accounts/{{ACCOUNT_ID}}/transactions/`
- **Headers:** `Authorization: Bearer {{$node["Access Token"].json.access}}`
- **Query Parameters:**
  - `date_from`: `{{$today.minus({days: 1}).toFormat('yyyy-MM-dd')}}`
  - `date_to`: `{{$today.toFormat('yyyy-MM-dd')}}`

### Node 4: HTTP Request – Kontostand abrufen
- **Method:** GET
- **URL:** `https://bankaccountdata.gocardless.com/api/v2/accounts/{{ACCOUNT_ID}}/balances/`
- **Headers:** `Authorization: Bearer {{$node["Access Token"].json.access}}`

### Node 5 (Optional): OpenAI – Kategorie-Mapping
- **Model:** gpt-4o-mini
- **System Prompt:**
  ```
  Du bist ein Finanz-Kategorisierer. Ordne jeden Buchungstext einer dieser Kategorien zu:
  Gehalt, Miete, Lebensmittel, Software, Transport, Versicherung, Freizeit, Gesundheit, Sparen, Provision, Sonstiges.
  Antworte nur mit dem Kategorienamen.
  ```
- **User Message:** `{{$json.remittanceInformationUnstructured}}`

### Node 6: Function – Payload transformieren
```javascript
const transactions = $input.all().map(item => {
  const tx = item.json;
  const amount = Math.abs(parseFloat(tx.transactionAmount.amount));
  const type = parseFloat(tx.transactionAmount.amount) >= 0 ? 'income' : 'expense';
  
  return {
    bankTransactionId: tx.transactionId || tx.internalTransactionId,
    amount: amount,
    type: type,
    category: tx.category || 'Sonstiges', // From OpenAI node or fallback
    description: tx.remittanceInformationUnstructured || tx.creditorName || tx.debtorName || '',
    date: tx.bookingDate + 'T00:00:00.000Z'
  };
});

const balance = $node["Kontostand"].json.balances?.[0]?.balanceAmount?.amount;

return [{
  json: {
    transactions,
    current_balance: balance ? parseFloat(balance) : undefined
  }
}];
```

### Node 7: HTTP Request – Push to Jarvis
- **Method:** POST
- **URL:** `https://jarvis-os-xxxxx.vercel.app/api/webhooks/finance`
  *(Ersetze mit deiner Vercel URL)*
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer {{$env.N8N_WEBHOOK_SECRET}}`
- **Body:** `{{JSON.stringify($json)}}`

---

## 3. n8n Environment Variables

Setze in deinen n8n Settings → **Variables**:
- `GOCARDLESS_SECRET_ID` → Dein GoCardless Secret ID
- `GOCARDLESS_SECRET_KEY` → Dein GoCardless Secret Key
- `N8N_WEBHOOK_SECRET` → Selbes Secret wie in Jarvis `.env`

---

## 4. Mehrere Konten

Wenn du Giro + Business-Konto hast, dupliziere die Nodes 3+4 für jede Account ID und merge die Ergebnisse im Function Node.

---

## 5. Testen

1. Starte den Workflow manuell in n8n (Play-Button)
2. Prüfe die Jarvis Response im n8n Output Panel
3. Öffne dein Jarvis Dashboard und verifiziere die neuen Transaktionen
