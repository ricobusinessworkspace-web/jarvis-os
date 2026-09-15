// Jarvis OS — Calls heute
// Scriptable-Widget. Einrichtung und Fallstricke: docs/ios-widget.md
//
// Aufbau nach dem Vorbild des Apple-Wetter-Widgets: eine Zahl, darunter der
// Zustand im Klartext, darunter die Grenzen. Zwischen Zustand und Grenzen sitzt
// die Schiene — ein Balken von 0 bis zum Tagesziel mit einer Kerbe an der Basis.
//
// Die deutschen Texte und alle Zahlen kommen fertig aus /api/widgets/calls.
// Hier wird nichts gerechnet und nichts formuliert: sonst stünde das Ziel ein
// zweites Mal im Code und wäre beim nächsten Zielwechsel im CRM still falsch.

// ====== KONFIGURATION ======
const HOST = "https://jarvis-os-indol.vercel.app";
const TOKEN = "HIER_DAS_WIDGET_SECRET_TOKEN_EINSETZEN";
// Nur nötig, wenn das Deployment hinter Vercels SSO-Schutz steht. Sonst leer lassen.
const VERCEL_BYPASS = "";
// ===========================

const API_URL = `${HOST}/api/widgets/calls`;
const TAP_URL = `${HOST}/vertrieb`;
const CACHE_FILE = "jarvis-calls.json";

const family = config.runsInWidget ? config.widgetFamily : "small";
const isAccessory = String(family).startsWith("accessory");

// ---------- Farben ----------
// Monochrom wie das Dashboard: der Erfüllungsgrad ist eine Helligkeitsrampe,
// die einzige Farbe im System ist Rot für „unter Basis". Auf dem Sperrbildschirm
// färbt iOS selbst ein, dort ist jede eigene Farbe wirkungslos.
const ink = a =>
  isAccessory
    ? new Color("#ffffff", a)
    : Color.dynamic(new Color("#000000", a), new Color("#ffffff", a));

const INK = ink(1);
const DIM = isAccessory
  ? new Color("#ffffff", 0.7)
  : Color.dynamic(new Color("#3c3c43", 0.6), new Color("#ebebf5", 0.6));
const TRACK = ink(isAccessory ? 0.22 : 0.12);
const RED = isAccessory
  ? new Color("#ffffff", 0.9)
  : Color.dynamic(new Color("#ff3b30"), new Color("#ff453a"));
const BG = Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e"));

/** Füllfarbe der Schiene je Zustand. `zielfehlt` und `ungemessen` füllen nichts. */
const FILL = {
  soll: INK,
  basis: ink(0.55),
  laeuft: ink(0.32),
  unter: RED,
  erfasst: ink(0.32),
  zielfehlt: null,
  ungemessen: null,
  offday: ink(0.1),
};

// ---------- Daten ----------
async function load() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.cacheDirectory(), CACHE_FILE);

  try {
    const req = new Request(API_URL);
    req.headers = VERCEL_BYPASS
      ? { Authorization: `Bearer ${TOKEN}`, "x-vercel-protection-bypass": VERCEL_BYPASS }
      : { Authorization: `Bearer ${TOKEN}` };
    req.timeoutInterval = 12;
    const json = await req.loadJSON();
    if (!json || !json.ok) throw new Error(json && json.error ? json.error : "Antwort ohne ok");
    fm.writeString(path, JSON.stringify({ json, at: Date.now() }));
    return { data: json, stale: false };
  } catch (e) {
    // Lieber die letzte bekannte Zahl mit Zeitstempel als gar nichts — aber nie
    // ohne den Hinweis, dass sie alt ist. Eine stille alte Zahl wäre eine Lüge.
    if (!fm.fileExists(path)) return { data: null, stale: false, error: String(e) };
    try {
      const cached = JSON.parse(fm.readString(path));
      return { data: cached.json, stale: true, at: new Date(cached.at) };
    } catch {
      return { data: null, stale: false, error: String(e) };
    }
  }
}

// ---------- Schiene ----------
/**
 * Balken von 0 bis Tagesziel. Die Basis sitzt als echte Lücke im Balken, nicht
 * als aufgemalter Strich: eine Lücke stimmt auf jedem Hintergrund, ein Strich
 * müsste die Hintergrundfarbe kennen — auf dem Sperrbildschirm ist das das
 * Hintergrundbild.
 */
function rail(width, height, m) {
  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;

  const r = height / 2;
  const pill = (x0, x1, color) => {
    if (x1 - x0 <= 0.5) return;
    dc.setFillColor(color);
    const p = new Path();
    p.addRoundedRect(new Rect(x0, 0, x1 - x0, height), Math.min(r, (x1 - x0) / 2), r);
    dc.addPath(p);
    dc.fillPath();
  };

  pill(0, width, TRACK);

  const fill = FILL[m.verdict];
  if (fill && m.progress !== null) {
    const end = Math.max(m.progress * width, m.progress > 0 ? height * 0.6 : 0);
    const gap = 2;
    const baseX = m.basePoint === null ? null : m.basePoint * width;

    if (baseX !== null && end > baseX + gap / 2) {
      pill(0, baseX - gap / 2, fill);
      pill(baseX + gap / 2, end, fill);
    } else {
      pill(0, end, fill);
      // Basis liegt noch vor dem Füllstand — dann markiert sie ein feiner Strich.
      if (baseX !== null) pill(baseX - 0.75, baseX + 0.75, ink(isAccessory ? 0.55 : 0.35));
    }
  }

  return dc.getImage();
}

function addRail(stack, width, height, m) {
  const img = stack.addImage(rail(width, height, m));
  img.imageSize = new Size(width, height);
}

// ---------- Bausteine ----------
function header(stack, title, size) {
  const row = stack.addStack();
  row.centerAlignContent();
  const sym = SFSymbol.named("phone.arrow.up.right.fill") || SFSymbol.named("phone.fill");
  if (sym) {
    const img = row.addImage(sym.image);
    img.imageSize = new Size(size, size);
    img.tintColor = DIM;
    img.resizable = true;
    row.addSpacer(4);
  }
  const t = row.addText(title);
  t.font = Font.semiboldSystemFont(size);
  t.textColor = DIM;
  row.addSpacer();
}

function line(stack, text, font, color, limit = 1) {
  const t = stack.addText(text);
  t.font = font;
  t.textColor = color;
  t.lineLimit = limit;
  t.minimumScaleFactor = 0.8;
  return t;
}

/**
 * Die untere Zeile — beim Wetter-Widget steht dort „H:24° L:11°".
 *
 * Reihenfolge nach Dringlichkeit: eine alte Zahl muss sich als alt zu erkennen
 * geben, ein kaputter Zielanschluss muss seinen Grund nennen, sonst stehen dort
 * die Grenzen des Tages.
 */
function footText(m, cache) {
  if (cache.stale) {
    const hh = String(cache.at.getHours()).padStart(2, "0");
    const mm = String(cache.at.getMinutes()).padStart(2, "0");
    return `Stand ${hh}:${mm} · offline`;
  }
  return m.targetHint || m.bounds;
}

// ---------- Ansichten ----------
function renderMain(stack, m, cache, sizes) {
  header(stack, "CALLS", sizes.head);
  stack.addSpacer(sizes.gapTop);

  const big = line(stack, m.display, Font.boldSystemFont(sizes.value), INK);
  big.minimumScaleFactor = 0.6;

  line(stack, m.verdictLabel, Font.mediumSystemFont(sizes.state), INK);

  stack.addSpacer(sizes.gapRail);
  addRail(stack, sizes.railWidth, sizes.railHeight, m);
  stack.addSpacer(5);

  line(stack, footText(m, cache), Font.systemFont(sizes.foot), DIM);
}

/** Die Tagesaufteilung — nur auf dem mittleren Widget, dort ist Platz dafür. */
function renderTeile(stack, teile, width) {
  for (const t of teile) {
    const row = stack.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();
    const name = row.addText(t.label);
    name.font = Font.systemFont(11);
    name.textColor = DIM;
    name.lineLimit = 1;
    row.addSpacer();
    const val = row.addText(`${t.display} / ${t.stretch === null ? "–" : t.stretch}`);
    val.font = Font.mediumSystemFont(11);
    val.textColor = INK;

    stack.addSpacer(4);
    addRail(stack, width, 4, t);
    stack.addSpacer(10);
  }
}

function renderAccessory(widget, m, cache) {
  widget.addSpacer(2);
  const top = widget.addStack();
  top.centerAlignContent();
  const label = top.addText("CALLS");
  label.font = Font.semiboldSystemFont(10);
  label.textColor = DIM;
  top.addSpacer();
  const val = top.addText(`${m.display} / ${m.stretch === null ? "–" : m.stretch}`);
  val.font = Font.boldSystemFont(14);
  val.textColor = INK;

  widget.addSpacer(5);
  addRail(widget, 150, 6, m);
  widget.addSpacer(4);

  line(widget, footText(m, cache), Font.systemFont(11), DIM);
}

function renderUnavailable(widget, error) {
  if (!isAccessory) widget.backgroundColor = BG;
  header(widget, "CALLS", 11);
  widget.addSpacer(6);
  line(widget, "–", Font.boldSystemFont(34), DIM);
  line(widget, "nicht erreichbar", Font.mediumSystemFont(13), DIM);
  widget.addSpacer(6);
  line(widget, String(error || "").slice(0, 80), Font.systemFont(10), DIM, 2);
}

// ---------- Zusammenbau ----------
const cache = await load();
const widget = new ListWidget();
widget.url = TAP_URL;

if (!cache.data) {
  renderUnavailable(widget, cache.error);
} else {
  const m = cache.data.calls;

  if (isAccessory) {
    widget.setPadding(0, 2, 0, 2);
    renderAccessory(widget, m, cache);
  } else if (family === "medium") {
    widget.backgroundColor = BG;
    widget.setPadding(14, 16, 14, 16);
    const cols = widget.addStack();
    cols.layoutHorizontally();

    const left = cols.addStack();
    left.layoutVertically();
    renderMain(left, m, cache, {
      head: 11, value: 34, state: 14, foot: 12,
      gapTop: 4, gapRail: 8, railWidth: 128, railHeight: 6,
    });
    left.addSpacer();

    cols.addSpacer(18);

    const right = cols.addStack();
    right.layoutVertically();
    renderTeile(right, cache.data.teile || [], 132);
    right.addSpacer();
  } else {
    widget.backgroundColor = BG;
    widget.setPadding(14, 16, 14, 16);
    renderMain(widget, m, cache, {
      head: 11, value: 38, state: 15, foot: 12,
      gapTop: 6, gapRail: 10, railWidth: 123, railHeight: 7,
    });
    widget.addSpacer();
  }
}

// Wann iOS frühestens neu laden darf. Nur ein Wunsch — das System entscheidet,
// wie oft es ihn erfüllt. Die Serverantwort hält den Takt tagsüber kurz; nach
// einem Fehlschlag wird bewusst früher wieder angeklopft.
const secs = cache.data ? cache.data.refreshAfterSeconds || 900 : 600;
widget.refreshAfterDate = new Date(Date.now() + secs * 1000);

if (config.runsInWidget) Script.setWidget(widget);
else if (isAccessory) widget.presentAccessoryRectangular();
else if (family === "medium") widget.presentMedium();
else widget.presentSmall();
Script.complete();
