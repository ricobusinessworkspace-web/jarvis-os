// Jarvis OS — Routine
// Scriptable-Widget. Einrichtung und Fallstricke: docs/ios-widget.md
//
// Zeigt vor 15:00 Uhr die Morgen-, danach die Abendroutine. Ein Tipp öffnet
// /routines.

// ====== KONFIGURATION ======
const HOST = "https://jarvis-os-indol.vercel.app";
const TOKEN = "HIER_DAS_WIDGET_SECRET_TOKEN_EINSETZEN";
// ===========================

const API_URL = `${HOST}/api/widgets/routines`;
const TAP_URL = `${HOST}/routines`;

/** Wechsel von Morgen- auf Abendroutine. */
const ABEND_AB = 15;

async function fetchRoutines() {
  try {
    const req = new Request(API_URL);
    req.headers = { Authorization: `Bearer ${TOKEN}` };
    req.timeoutInterval = 12;
    const res = await req.loadJSON();
    return res && res.success ? res.data : null;
  } catch (e) {
    return null;
  }
}

const data = await fetchRoutines();
const widget = new ListWidget();
widget.backgroundColor = new Color("#0a0a0f");
widget.url = TAP_URL;

const isMorning = new Date().getHours() < ABEND_AB;
const targetCategory = isMorning ? "Morgenroutine" : "Abendroutine";

// Kopfzeile
const topStack = widget.addStack();
topStack.centerAlignContent();
const title = topStack.addText(isMorning ? "☀️ MORGEN" : "🌙 ABEND");
title.font = Font.blackSystemFont(11);
title.textColor = new Color(isMorning ? "#fbbf24" : "#818cf8");
topStack.addSpacer();

const sym = SFSymbol.named("checkmark.circle.fill");
if (sym) {
  const symImg = topStack.addImage(sym.image);
  symImg.imageSize = new Size(12, 12);
  symImg.tintColor = new Color("#34d399");
}

widget.addSpacer(6);

if (!data || !data.items) {
  const err = widget.addText("nicht erreichbar");
  err.font = Font.systemFont(10);
  err.textColor = new Color("#888888");
} else {
  const activeItems = data.items.filter(i => i.category === targetCategory);
  const completed = activeItems.filter(i => i.status === "completed").length;

  const stats = widget.addText(`${completed} von ${activeItems.length} erledigt`);
  stats.font = Font.boldSystemFont(10);
  stats.textColor = new Color("#888888");
  widget.addSpacer(6);

  let count = 0;
  for (const item of activeItems) {
    if (count >= 4) {
      if (activeItems.length > 4 && count === 4) {
        const more = widget.addText(`+ ${activeItems.length - 4} weitere...`);
        more.font = Font.systemFont(9);
        more.textColor = new Color("#666666");
      }
      count++;
      continue;
    }

    const row = widget.addStack();
    row.centerAlignContent();
    const isDone = item.status === "completed";

    const checkSym = SFSymbol.named(isDone ? "checkmark.circle.fill" : "circle");
    if (checkSym) {
      const checkImg = row.addImage(checkSym.image);
      checkImg.imageSize = new Size(10, 10);
      checkImg.tintColor = isDone ? new Color("#34d399") : new Color("#444444");
      row.addSpacer(6);
    }

    // Emojis raus — neben den SF-Symbolen wird die Zeile sonst unruhig.
    const cleanName = item.name
      .replace(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, "")
      .trim();

    const name = row.addText(cleanName);
    name.font = Font.systemFont(11);
    name.textColor = isDone ? new Color("#666666") : new Color("#ffffff");
    name.lineLimit = 1;

    widget.addSpacer(4);
    count++;
  }
}

widget.refreshAfterDate = new Date(Date.now() + (data ? 15 : 10) * 60 * 1000);

if (config.runsInWidget) Script.setWidget(widget);
else widget.presentSmall();
Script.complete();
