// Jarvis OS — Calls
// Scriptable-Widget. Einrichtung: docs/ios-widget.md
//
// Heute und die laufende Woche (Mo–So): wie viele Calls, gegen welche
// Basis, wie viele Tage übrig, wie viel pro Tag noch fehlt. Mittel kommt der
// Split dazu. Alles fertig aus /api/widgets/heute — hier wird nichts
// gerechnet und nichts formuliert. Ein Tag, der läuft, ist nie rot.

// ====== KONFIGURATION ======
const HOST = "https://jarvis-os-indol.vercel.app";
const TOKEN = "HIER_DAS_WIDGET_SECRET_TOKEN_EINSETZEN";
// ===========================

const API_URL = `${HOST}/api/widgets/heute`;
const TAP_URL = `${HOST}/vertrieb`;
const CACHE_FILE = "jarvis-calls-v2.json";

const family = config.runsInWidget ? config.widgetFamily : "medium";
const isAccessory = String(family).startsWith("accessory");

const dyn = (light, dark) => (isAccessory ? new Color(dark) : Color.dynamic(new Color(light), new Color(dark)));
const LABEL = dyn("#000000", "#f5f5f7");
const SECONDARY = dyn("#6e6e73", "#8e8e93");
const BG = dyn("#f2f2f7", "#000000");
const TRACK = isAccessory ? new Color("#ffffff", 0.25) : dyn("#e5e5ea", "#2c2c2e");
const MARK = dyn("#8e8e93", "#8e8e93");

async function load() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.cacheDirectory(), CACHE_FILE);
  try {
    const req = new Request(API_URL);
    req.headers = { Authorization: `Bearer ${TOKEN}` };
    req.timeoutInterval = 12;
    const json = await req.loadJSON();
    if (!json || !json.ok) throw new Error(json && json.error ? json.error : "Antwort ohne ok");
    fm.writeString(path, JSON.stringify({ json, at: Date.now() }));
    return { data: json };
  } catch (e) {
    if (!fm.fileExists(path)) return { data: null, error: String(e) };
    try {
      const cached = JSON.parse(fm.readString(path));
      return { data: cached.json, stale: new Date(cached.at) };
    } catch {
      return { data: null, error: String(e) };
    }
  }
}

/** Schiene von 0 bis Soll, Strich an der Basis. */
function rail(width, height, ist, basis, soll) {
  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const pill = (x0, x1, color) => {
    if (x1 - x0 <= 0.5) return;
    const p = new Path();
    p.addRoundedRect(new Rect(x0, 0, x1 - x0, height), height / 2, height / 2);
    dc.addPath(p);
    dc.setFillColor(color);
    dc.fillPath();
  };
  pill(0, width, TRACK);
  const ziel = soll || basis;
  if (ziel) {
    pill(0, Math.min(1, (ist || 0) / ziel) * width, LABEL);
    if (basis && soll && basis < soll) {
      const x = (basis / soll) * width;
      dc.setFillColor(MARK);
      dc.fillRect(new Rect(x - 0.75, 0, 1.5, height));
    }
  }
  return dc.getImage();
}

function addRail(stack, w, h, ist, basis, soll) {
  const img = stack.addImage(rail(w, h, ist, basis, soll));
  img.imageSize = new Size(w, h);
}

function text(stack, value, font, color = LABEL, limit = 1) {
  const t = stack.addText(String(value));
  t.font = font;
  t.textColor = color;
  t.lineLimit = limit;
  t.minimumScaleFactor = 0.7;
  return t;
}

const calls = d => d.heute.kacheln.find(k => k.key === "sales.calls_count");
const offline = d => (d._stale ? `Stand ${String(d._stale.getHours()).padStart(2, "0")}:${String(d._stale.getMinutes()).padStart(2, "0")} · offline` : null);

function heuteBlock(stack, d, gross) {
  const c = calls(d);
  text(stack, "Calls heute", Font.semiboldSystemFont(13), SECONDARY);
  stack.addSpacer(2);
  const row = stack.addStack();
  row.bottomAlignContent();
  text(row, c.wert ?? "–", Font.semiboldRoundedSystemFont(gross));
  row.addSpacer(4);
  text(row, `/ ${c.basis ?? "–"}`, Font.mediumRoundedSystemFont(gross * 0.42), SECONDARY);
  stack.addSpacer(6);
  addRail(stack, 128, 6, c.wert, c.basis, c.soll);
  stack.addSpacer(5);
  text(stack, d.texte.callsZiel, Font.systemFont(11), SECONDARY);
}

function renderSmall(w, d) {
  w.setPadding(14, 14, 14, 14);
  heuteBlock(w, d, 40);
  w.addSpacer();
  text(w, `Woche ${d.texte.woche}`, Font.semiboldSystemFont(12));
  text(w, offline(d) || d.texte.wocheRest, Font.systemFont(11), SECONDARY);
}

function renderMedium(w, d) {
  w.setPadding(14, 16, 14, 16);
  const cols = w.addStack();
  const left = cols.addStack();
  left.layoutVertically();
  heuteBlock(left, d, 40);
  left.addSpacer();
  cols.addSpacer(18);

  const right = cols.addStack();
  right.layoutVertically();
  const wk = d.woche.calls;
  text(right, "Diese Woche", Font.semiboldSystemFont(13), SECONDARY);
  right.addSpacer(2);
  text(right, d.texte.woche, Font.semiboldRoundedSystemFont(22));
  text(right, offline(d) || d.texte.wocheRest, Font.systemFont(11), SECONDARY);
  right.addSpacer(8);
  for (const s of wk.split) {
    const row = right.addStack();
    text(row, s.name, Font.systemFont(11), SECONDARY);
    row.addSpacer();
    text(row, `${s.ist}/${s.basis ?? "–"}`, Font.mediumRoundedSystemFont(11));
    right.addSpacer(2);
    addRail(right, 132, 3, s.ist, s.basis, s.soll);
    right.addSpacer(5);
  }
}

function renderRectangular(w, d) {
  const c = calls(d);
  const top = w.addStack();
  text(top, "Calls", Font.semiboldSystemFont(12));
  top.addSpacer();
  text(top, `${c.wert ?? "–"} / ${c.basis ?? "–"}`, Font.semiboldRoundedSystemFont(14));
  w.addSpacer(4);
  addRail(w, 150, 5, c.wert, c.basis, c.soll);
  w.addSpacer(4);
  text(w, `Woche ${d.texte.woche} · ${d.woche.tageUebrig} T`, Font.systemFont(11), SECONDARY);
}

function renderCircular(w, d) {
  const s = w.addStack();
  s.layoutVertically();
  s.centerAlignContent();
  text(s, calls(d).wert ?? "–", Font.semiboldRoundedSystemFont(20));
  text(s, "Calls", Font.systemFont(10), SECONDARY);
}

const res = await load();
const widget = new ListWidget();
widget.url = TAP_URL;
if (!isAccessory) widget.backgroundColor = BG;

if (!res.data) {
  text(widget, "Calls", Font.semiboldSystemFont(15));
  text(widget, "Jarvis nicht erreichbar", Font.systemFont(13), SECONDARY);
} else {
  const d = { ...res.data, _stale: res.stale };
  if (family === "accessoryCircular") renderCircular(widget, d);
  else if (isAccessory) renderRectangular(widget, d);
  else if (family === "small") renderSmall(widget, d);
  else renderMedium(widget, d);
}

const secs = res.data ? res.data.refreshAfterSeconds || 900 : 600;
widget.refreshAfterDate = new Date(Date.now() + secs * 1000);

if (config.runsInWidget) Script.setWidget(widget);
else if (family === "accessoryCircular") widget.presentAccessoryCircular();
else if (isAccessory) widget.presentAccessoryRectangular();
else if (family === "small") widget.presentSmall();
else widget.presentMedium();
Script.complete();
