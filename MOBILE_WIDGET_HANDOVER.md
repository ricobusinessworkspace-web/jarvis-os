# Mobile Developer Handover: iOS Routine Widget

This document provides all technical details required to maintain, debug, or extend the native iOS Routine Widget for Jarvis OS. The widget is currently implemented using the third-party iOS app **Scriptable**, which executes JavaScript to render native iOS UI components.

## Architecture Overview
The widget connects to a dedicated Next.js API route to fetch the user's daily habits (routines). 

1. **Backend:** Next.js API Route (`src/app/api/widgets/routines/route.ts`)
2. **Frontend (Widget):** Scriptable JavaScript (running natively on iOS)
3. **Authentication:** Vercel SSO Bypass Token + App-level query token

## 1. The Backend API

**Endpoint:** `GET /api/widgets/routines`
**File:** `src/app/api/widgets/routines/route.ts`

### Parameters
- `token`: (Required) A hardcoded secret used to prevent unauthorized access.
  - Default: `jarvis-scriptable-secret-123`
  - In production, this should ideally be moved to an environment variable (`WIDGET_SECRET_TOKEN`).

### Data Source
The API relies on `RoutineService.getTodayRoutines()` from `src/core/services/RoutineService.ts`. It returns all tracker items for the current day, along with their status (`completed`, `not_done`, or `skipped`).

### Response Format
```json
{
  "success": true,
  "data": {
    "total": 12,
    "completed": 0,
    "pending": 12,
    "items": [
      {
        "id": "7b6ca8ea...",
        "name": "Bett machen ☑️",
        "category": "Morgenroutine",
        "status": "not_done"
      }
    ]
  }
}
```

## 2. Authentication & Vercel Bypass

Since the application is hosted on Vercel and deployed under an organization (`wardogs`) with **Vercel Authentication (SSO)** enabled, the API route is blocked at the Edge network layer by default.

To bypass this without disabling Vercel Authentication for the entire project:
1. In the Vercel Dashboard, enable **Protection Bypass for Automation**.
2. Copy the generated secret.
3. Pass the secret in the HTTP request headers from the widget.

**Header:** `x-vercel-protection-bypass: <SECRET_TOKEN>`

## 3. The Scriptable Code

This is the production-ready Scriptable code currently used by the user.

> **Key Features:**
> - **Time-based filtering:** Shows "Morgenroutine" before 15:00 and "Abendroutine" after 15:00.
> - **Emoji stripping:** Emojis are stripped from the task names via Regex to ensure a clean UI next to the SF Symbols.
> - **Deep Linking:** Tapping the widget opens the dedicated mobile PWA route `/routines`.

```javascript
// ====== CONFIGURATION ======
const API_URL = "https://jarvis-os-wardogs.vercel.app/api/widgets/routines?token=jarvis-scriptable-secret-123";
const VERCEL_BYPASS_TOKEN = "4aqlDAcWy3hTwud2GZmm53cXJtYrnXHW"; 
const DASHBOARD_URL = "https://jarvis-os-wardogs.vercel.app/routines";
// ===========================

async function fetchRoutines() {
  try {
    let req = new Request(API_URL);
    if (VERCEL_BYPASS_TOKEN) {
      req.headers = { "x-vercel-protection-bypass": VERCEL_BYPASS_TOKEN };
    }
    let res = await req.loadJSON();
    return res.data;
  } catch(e) {
    return null;
  }
}

let data = await fetchRoutines();
let widget = new ListWidget();
widget.backgroundColor = new Color("#0a0a0f");

// Deep Link to PWA
widget.url = DASHBOARD_URL;

// Time Check: Morning routine before 15:00, Evening routine after
let hour = new Date().getHours();
let isMorning = hour < 15;
let targetCategory = isMorning ? "Morgenroutine" : "Abendroutine";

// Top-Bar
let topStack = widget.addStack();
topStack.centerAlignContent();
let title = topStack.addText(isMorning ? "☀️ MORGEN" : "🌙 ABEND");
title.font = Font.blackSystemFont(11);
title.textColor = new Color(isMorning ? "#fbbf24" : "#818cf8"); 
topStack.addSpacer();

let sym = SFSymbol.named("checkmark.circle.fill");
let symImg = topStack.addImage(sym.image);
symImg.imageSize = new Size(12, 12);
symImg.tintColor = new Color("#34d399");

widget.addSpacer(6);

if (!data || !data.items) {
  let err = widget.addText("Daten-Fehler!");
  err.font = Font.systemFont(10);
  err.textColor = Color.red();
} else {
  let activeItems = data.items.filter(i => i.category === targetCategory);
  let completed = activeItems.filter(i => i.status === 'completed').length;
  
  let stats = widget.addText(`${completed} von ${activeItems.length} erledigt`);
  stats.font = Font.boldSystemFont(10);
  stats.textColor = new Color("#888888");
  widget.addSpacer(6);

  let count = 0;
  for (let item of activeItems) {
    if (count >= 4) {
      if (activeItems.length > 4 && count === 4) {
        let more = widget.addText(`+ ${activeItems.length - 4} weitere...`);
        more.font = Font.systemFont(9);
        more.textColor = new Color("#666666");
      }
      count++;
      continue;
    }
    
    let row = widget.addStack();
    row.centerAlignContent();
    let isDone = item.status === 'completed';
    
    let checkSym = SFSymbol.named(isDone ? "checkmark.circle.fill" : "circle");
    let checkImg = row.addImage(checkSym.image);
    checkImg.imageSize = new Size(10, 10);
    checkImg.tintColor = isDone ? new Color("#34d399") : new Color("#444444");
    
    row.addSpacer(6);
    
    // Strip Emojis
    let cleanName = item.name.replace(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '').trim();
    
    let name = row.addText(cleanName);
    name.font = Font.systemFont(11);
    name.textColor = isDone ? new Color("#666666") : new Color("#ffffff");
    name.lineLimit = 1;
    
    widget.addSpacer(4);
    count++;
  }
}

Script.setWidget(widget);
Script.complete();
widget.presentSmall();
```

## Future Recommendations for Mobile Devs
If migrating to a native Swift iOS Widget (WidgetKit) in the future:
1. Re-use the existing `/api/widgets/routines` endpoint.
2. Implement the `x-vercel-protection-bypass` header in `URLSession`.
3. Use iOS 17 App Intents if interactive checkbox toggling (without opening the PWA) is required. This will necessitate creating a `POST /api/widgets/routines/complete` endpoint in Next.js to handle the background API calls.
