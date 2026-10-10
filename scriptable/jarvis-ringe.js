// Jarvis OS — Ringe + Serien
// Scriptable-Widget. Einrichtung und Fallstricke: docs/ios-widget.md
//
// Drei Ringe wie bei Apple Activity (Ursachen, Routinen, Regeln), darunter
// der Tag in einem Satz und die längsten laufenden Serien. Ein geschlossener
// Ring und Serien ab Stufe 7 in Gold — der einzigen Belohnungsfarbe.
//
// Alle Zahlen und Texte kommen fertig aus /api/widgets/motivation. Hier wird
// nichts gerechnet und nichts formuliert.

// ====== KONFIGURATION ======
const HOST = "https://jarvis-os-indol.vercel.app";
const TOKEN = "HIER_DAS_WIDGET_SECRET_TOKEN_EINSETZEN";
// ===========================

const API_URL = `${HOST}/api/widgets/motivation`;
const TAP_URL = `${HOST}/`;
const CACHE_FILE = "jarvis-ringe.json";

const family = config.runsInWidget ? config.widgetFamily : "medium";
const isAccessory = String(family).startsWith("accessory");

// ---------- Farben ----------
// Monochrom wie das Dashboard. Gold nur für Geschafftes. Auf dem
// Sperrbildschirm färbt iOS selbst — dort zählt nur Helligkeit.
const ink = a =>
  isAccessory
    ? new Color("#ffffff", a)
    : Color.dynamic(new Color("#000000", a), new Color("#ffffff", a));
const INK = ink(1);
const DIM = isAccessory
  ? new Color("#ffffff", 0.7)
  : Color.dynamic(new Color("#3c3c43", 0.6), new Color("#ebebf5", 0.6));
const TRACK = ink(isAccessory ? 0.22 : 0.12);
const GOLD = isAccessory ? new Color("#ffffff", 1) : new Color("#e3b958");
const BG = Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e"));

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
    return { data: json, stale: false };
  } catch (e) {
    // Lieber der letzte Stand mit Hinweis als nichts — nie still alt.
    if (!fm.fileExists(path)) return { data: null, error: String(e) };
    try {
      const cached = JSON.parse(fm.readString(path));
      return { data: cached.json, stale: true, at: new Date(cached.at) };
    } catch {
      return { data: null, error: String(e) };
    }
  }
}

// ---------- Ringe ----------
/** Drei konzentrische Ringe. Ein Bogen ist eine Punktfolge — Scriptable kennt keine Kreisbögen. */
function ringsImage(size, ringe) {
  const dc = new DrawContext();
  dc.size = new Size(size, size);
  dc.opaque = false;
  dc.respectScreenScale = true;

  const width = size * 0.11;
  const gap = size * 0.025;
  const c = size / 2;
  const list = [ringe.ursachen, ringe.routinen, ringe.regeln];

  list.forEach((ring, i) => {
    const r = c - width / 2 - i * (width + gap);
    const arc = (from, to, color) => {
      const p = new Path();
      const steps = Math.max(2, Math.ceil((to - from) * 60));
      for (let s = 0; s <= steps; s++) {
        const a = -Math.PI / 2 + (from + ((to - from) * s) / steps) * Math.PI * 2;
        const pt = new Point(c + r * Math.cos(a), c + r * Math.sin(a));
        if (s === 0) p.move(pt);
        else p.addLine(pt);
      }
      dc.addPath(p);
      dc.setStrokeColor(color);
      dc.setLineWidth(width);
      dc.strokePath();
    };
    arc(0, 1, TRACK);
    const share = ring.gesamt ? Math.min(1, ring.wert / ring.gesamt) : 0;
    if (share > 0) arc(0, share, ring.zu ? GOLD : INK);
  });
  return dc.getImage();
}

function addRings(stack, size, ringe) {
  const img = stack.addImage(ringsImage(size, ringe));
  img.imageSize = new Size(size, size);
}

// ---------- Bausteine ----------
function line(stack, text, font, color, limit = 1) {
  const t = stack.addText(text);
  t.font = font;
  t.textColor = color;
  t.lineLimit = limit;
  t.minimumScaleFactor = 0.75;
  return t;
}

function staleText(cache) {
  if (!cache.stale) return null;
  const hh = String(cache.at.getHours()).padStart(2, "0");
  const mm = String(cache.at.getMinutes()).padStart(2, "0");
  return `Stand ${hh}:${mm} · offline`;
}

function ringRow(stack, ring) {
  const row = stack.addStack();
  row.centerAlignContent();
  line(row, ring.label, Font.systemFont(11), DIM);
  row.addSpacer();
  line(row, ring.gesamt ? `${ring.wert}/${ring.gesamt}` : "–", Font.mediumMonospacedSystemFont(11), ring.zu ? GOLD : INK);
}

function serieRow(stack, s) {
  const row = stack.addStack();
  row.centerAlignContent();
  const sym = SFSymbol.named("flame.fill");
  if (sym) {
    const img = row.addImage(sym.image);
    img.imageSize = new Size(10, 10);
    img.tintColor = s.gold ? GOLD : DIM;
    row.addSpacer(4);
  }
  line(row, s.label, Font.systemFont(11), DIM);
  row.addSpacer();
  line(row, String(s.serie), Font.mediumMonospacedSystemFont(11), s.gold ? GOLD : INK);
}

// ---------- Ansichten ----------
function renderSmall(w, d, cache) {
  w.backgroundColor = BG;
  w.setPadding(12, 14, 12, 14);
  const top = w.addStack();
  top.addSpacer();
  addRings(top, 76, d.ringe);
  top.addSpacer();
  w.addSpacer(8);
  line(w, d.titel, Font.semiboldSystemFont(13), d.perfekt ? GOLD : INK);
  line(w, staleText(cache) || d.zeile, Font.systemFont(10.5), DIM, 2);
}

function renderMedium(w, d, cache) {
  w.backgroundColor = BG;
  w.setPadding(14, 16, 14, 16);
  const cols = w.addStack();
  cols.centerAlignContent();
  addRings(cols, 104, d.ringe);
  cols.addSpacer(16);

  const right = cols.addStack();
  right.layoutVertically();
  line(right, d.titel, Font.semiboldSystemFont(14), d.perfekt ? GOLD : INK);
  right.addSpacer(5);
  ringRow(right, d.ringe.ursachen);
  ringRow(right, d.ringe.routinen);
  ringRow(right, d.ringe.regeln);
  right.addSpacer(6);
  const stale = staleText(cache);
  if (stale) line(right, stale, Font.systemFont(10), DIM);
  else (d.serien || []).slice(0, 2).forEach(s => serieRow(right, s));
}

function renderCircular(w, d) {
  const s = w.addStack();
  s.addSpacer();
  addRings(s, 56, d.ringe);
  s.addSpacer();
}

function renderRectangular(w, d, cache) {
  const row = w.addStack();
  row.centerAlignContent();
  addRings(row, 46, d.ringe);
  row.addSpacer(8);
  const col = row.addStack();
  col.layoutVertically();
  line(col, d.titel, Font.semiboldSystemFont(13), INK);
  line(col, staleText(cache) || d.zeile, Font.systemFont(11), DIM, 2);
}

function renderUnavailable(w, error) {
  if (!isAccessory) w.backgroundColor = BG;
  line(w, "Jarvis", Font.semiboldSystemFont(12), DIM);
  w.addSpacer(4);
  line(w, "nicht erreichbar", Font.mediumSystemFont(13), DIM);
  line(w, String(error || "").slice(0, 80), Font.systemFont(10), DIM, 2);
}

// ---------- Zusammenbau ----------
const cache = await load();
const widget = new ListWidget();
widget.url = TAP_URL;

if (!cache.data) renderUnavailable(widget, cache.error);
else if (family === "accessoryCircular") renderCircular(widget, cache.data);
else if (isAccessory) renderRectangular(widget, cache.data, cache);
else if (family === "small") renderSmall(widget, cache.data, cache);
else renderMedium(widget, cache.data, cache);

const secs = cache.data ? cache.data.refreshAfterSeconds || 900 : 600;
widget.refreshAfterDate = new Date(Date.now() + secs * 1000);

if (config.runsInWidget) Script.setWidget(widget);
else if (family === "accessoryCircular") widget.presentAccessoryCircular();
else if (isAccessory) widget.presentAccessoryRectangular();
else if (family === "small") widget.presentSmall();
else widget.presentMedium();
Script.complete();
