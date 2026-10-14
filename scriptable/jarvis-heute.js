// Jarvis OS — Heute
// Scriptable-Widget. Einrichtung: docs/ios-widget.md
//
// Der Tag als Kacheln, wie „Heute" im Dashboard: Calls, Training, Post,
// Morgen, Abend, Regeln. Groß kommt die laufende Woche (Mo–So) dazu.
// Zustände, Zahlen und Sätze kommen fertig aus /api/widgets/heute — hier wird
// nichts gerechnet und nichts formuliert.

// ====== KONFIGURATION ======
const HOST = "https://jarvis-os-indol.vercel.app";
const TOKEN = "HIER_DAS_WIDGET_SECRET_TOKEN_EINSETZEN";
// ===========================

const API_URL = `${HOST}/api/widgets/heute`;
const TAP_URL = `${HOST}/`;
const CACHE_FILE = "jarvis-heute.json";

const family = config.runsInWidget ? config.widgetFamily : "large";
const isAccessory = String(family).startsWith("accessory");

// ---------- Farben (Jarvis-Blocksystem) ----------
// Weiß = Soll, Grau = Basis, Rot = darunter, Rahmen = offen / nicht gemessen.
// Auf dem Sperrbildschirm färbt iOS selbst — dort zählt nur Helligkeit.
const dyn = (light, dark) => (isAccessory ? new Color(dark) : Color.dynamic(new Color(light), new Color(dark)));
const LABEL = dyn("#000000", "#f5f5f7");
const SECONDARY = dyn("#6e6e73", "#8e8e93");
const BG = dyn("#f2f2f7", "#000000");
const TILE_BG = dyn("#ffffff", "#1c1c1e");
const FILL = {
  soll: dyn("#000000", "#f5f5f7"),
  basis: dyn("#8e8e93", "#8e8e93"),
  unter: dyn("#ff3b30", "#ff453a"),
  frei: dyn("#e5e5ea", "#2c2c2e"),
  kommt: dyn("#f2f2f7", "#1c1c1e"),
};
const RING = dyn("#c7c7cc", "#48484a");

// ---------- Daten ----------
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
    // Lieber der letzte Stand mit Hinweis als nichts — nie still alt.
    if (!fm.fileExists(path)) return { data: null, error: String(e) };
    try {
      const cached = JSON.parse(fm.readString(path));
      return { data: cached.json, stale: new Date(cached.at) };
    } catch {
      return { data: null, error: String(e) };
    }
  }
}

// ---------- Zeichnen ----------
/** Ein Block im Jarvis-Stil: gefüllt nach Zustand, offen/leer als Rahmen. */
function block(size, zustand, radius) {
  const dc = new DrawContext();
  dc.size = new Size(size, size);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const p = new Path();
  const inset = zustand === "offen" || zustand === "leer" ? 1 : 0;
  p.addRoundedRect(new Rect(inset, inset, size - 2 * inset, size - 2 * inset), radius, radius);
  dc.addPath(p);
  if (zustand === "offen" || zustand === "leer") {
    dc.setStrokeColor(zustand === "offen" ? SECONDARY : RING);
    dc.setLineWidth(1.5);
    dc.strokePath();
  } else {
    dc.setFillColor(FILL[zustand] || FILL.kommt);
    dc.fillPath();
  }
  return dc.getImage();
}

function addBlock(stack, size, zustand, radius = size * 0.28) {
  const img = stack.addImage(block(size, zustand, radius));
  img.imageSize = new Size(size, size);
}

function text(stack, value, font, color = LABEL, limit = 1) {
  const t = stack.addText(String(value));
  t.font = font;
  t.textColor = color;
  t.lineLimit = limit;
  t.minimumScaleFactor = 0.7;
  return t;
}

const kurz = k => (k.key === "sales.calls_count" ? String(k.wert ?? "–")
  : k.key === "regeln" ? `${k.wert}/${k.soll}`
  : k.soll ? `${k.wert}/${k.soll}`
  : k.zustand === "soll" ? "✓" : "–");

function standText(d) {
  if (d._stale) {
    const hh = String(d._stale.getHours()).padStart(2, "0");
    const mm = String(d._stale.getMinutes()).padStart(2, "0");
    return `Stand ${hh}:${mm} · offline`;
  }
  return `Calls ${d.texte.calls} · Woche ${d.texte.woche}`;
}

// ---------- Ansichten ----------
function kopf(stack, d) {
  const row = stack.addStack();
  row.centerAlignContent();
  text(row, "Heute", Font.semiboldSystemFont(15));
  row.addSpacer();
  text(row, `${d.heute.erledigt}/${d.heute.gesamt}`, Font.semiboldRoundedSystemFont(15), SECONDARY);
}

/** Kacheln als Raster — 3 Spalten, wie im Dashboard. */
function kacheln(stack, d, groesse) {
  const ks = d.heute.kacheln;
  for (let r = 0; r < Math.ceil(ks.length / 3); r++) {
    const row = stack.addStack();
    row.spacing = 8;
    for (const k of ks.slice(r * 3, r * 3 + 3)) {
      const t = row.addStack();
      t.layoutVertically();
      t.size = new Size(groesse.w, groesse.h);
      t.setPadding(8, 10, 8, 10);
      t.cornerRadius = 14;
      t.backgroundColor = TILE_BG;
      const top = t.addStack();
      top.centerAlignContent();
      text(top, k.name, Font.mediumSystemFont(12), SECONDARY);
      top.addSpacer();
      addBlock(top, 10, k.zustand);
      t.addSpacer();
      text(t, kurz(k), Font.semiboldRoundedSystemFont(groesse.zahl), k.zustand === "unter" ? FILL.unter : LABEL);
    }
    if (r === 0) stack.addSpacer(8);
  }
}

function woche(stack, d) {
  const w = d.woche;
  const head = stack.addStack();
  text(head, "Diese Woche", Font.semiboldSystemFont(13));
  head.addSpacer();
  text(head, d.texte.wocheRest, Font.systemFont(12), SECONDARY);
  stack.addSpacer(8);

  const tage = ["M", "D", "M", "D", "F", "S", "S"];
  const kopfzeile = stack.addStack();
  kopfzeile.centerAlignContent();
  const leer = kopfzeile.addStack();
  leer.size = new Size(64, 12);
  for (const t of tage) {
    const c = kopfzeile.addStack();
    c.size = new Size(20, 12);
    c.centerAlignContent();
    text(c, t, Font.mediumSystemFont(9), SECONDARY);
    kopfzeile.addSpacer(4);
  }
  stack.addSpacer(4);

  for (const z of w.zeilen) {
    const row = stack.addStack();
    row.centerAlignContent();
    const name = row.addStack();
    name.size = new Size(64, 18);
    name.centerAlignContent();
    text(name, z.name, Font.systemFont(12));
    name.addSpacer();
    for (const zelle of z.zellen) {
      const c = row.addStack();
      c.size = new Size(20, 18);
      c.centerAlignContent();
      addBlock(c, 15, zelle, 4);
      row.addSpacer(4);
    }
    row.addSpacer();
    const rechts = z.key === "regeln"
      ? (z.ist ? `${z.ist} Rückf.` : "gehalten")
      : `${z.ist}/${z.ziel ?? "–"}`;
    text(row, rechts, Font.mediumRoundedSystemFont(12), z.key === "regeln" && z.ist ? FILL.unter : SECONDARY);
    stack.addSpacer(5);
  }
}

function renderSmall(w, d) {
  w.setPadding(14, 14, 14, 14);
  kopf(w, d);
  w.addSpacer(10);
  const grid = w.addStack();
  grid.layoutVertically();
  const ks = d.heute.kacheln;
  for (let r = 0; r < 2; r++) {
    const row = grid.addStack();
    row.spacing = 7;
    for (const k of ks.slice(r * 3, r * 3 + 3)) addBlock(row, 34, k.zustand, 9);
    if (r === 0) grid.addSpacer(7);
  }
  w.addSpacer();
  text(w, d.texte.heute, Font.semiboldSystemFont(13));
  text(w, d._stale ? standText(d) : `Calls ${d.texte.calls}`, Font.systemFont(11), SECONDARY);
}

function renderMedium(w, d) {
  w.setPadding(14, 14, 14, 14);
  kopf(w, d);
  w.addSpacer(8);
  kacheln(w, d, { w: 96, h: 50, zahl: 17 });
  w.addSpacer();
  text(w, standText(d), Font.systemFont(11), SECONDARY);
}

function renderLarge(w, d) {
  w.setPadding(16, 16, 16, 16);
  kopf(w, d);
  w.addSpacer(10);
  kacheln(w, d, { w: 96, h: 62, zahl: 22 });
  w.addSpacer(16);
  woche(w, d);
  w.addSpacer();
  if (d._stale) text(w, standText(d), Font.systemFont(11), SECONDARY);
}

function renderRectangular(w, d) {
  const row = w.addStack();
  row.centerAlignContent();
  for (const k of d.heute.kacheln) {
    addBlock(row, 11, k.zustand, 3);
    row.addSpacer(3);
  }
  w.addSpacer(4);
  text(w, d.texte.heute, Font.semiboldSystemFont(13));
  text(w, `Calls ${d.texte.calls}`, Font.systemFont(12), SECONDARY);
}

function renderCircular(w, d) {
  const s = w.addStack();
  s.layoutVertically();
  s.centerAlignContent();
  text(s, `${d.heute.erledigt}/${d.heute.gesamt}`, Font.semiboldRoundedSystemFont(18));
  text(s, "heute", Font.systemFont(10), SECONDARY);
}

function renderUnavailable(w, error) {
  text(w, "Heute", Font.semiboldSystemFont(15));
  w.addSpacer(6);
  text(w, "Jarvis nicht erreichbar", Font.systemFont(13), SECONDARY);
  text(w, String(error || "").slice(0, 80), Font.systemFont(10), SECONDARY, 2);
}

// ---------- Zusammenbau ----------
const res = await load();
const widget = new ListWidget();
widget.url = TAP_URL;
if (!isAccessory) widget.backgroundColor = BG;

if (!res.data) renderUnavailable(widget, res.error);
else {
  const d = { ...res.data, _stale: res.stale };
  if (family === "accessoryCircular") renderCircular(widget, d);
  else if (isAccessory) renderRectangular(widget, d);
  else if (family === "small") renderSmall(widget, d);
  else if (family === "medium") renderMedium(widget, d);
  else renderLarge(widget, d);
}

const secs = res.data ? res.data.refreshAfterSeconds || 900 : 600;
widget.refreshAfterDate = new Date(Date.now() + secs * 1000);

if (config.runsInWidget) Script.setWidget(widget);
else if (family === "accessoryCircular") widget.presentAccessoryCircular();
else if (isAccessory) widget.presentAccessoryRectangular();
else if (family === "small") widget.presentSmall();
else if (family === "medium") widget.presentMedium();
else widget.presentLarge();
Script.complete();
