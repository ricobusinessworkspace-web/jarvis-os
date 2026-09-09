import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getBerlinDateStr } from '@/lib/dateUtils';

/**
 * Eingang für die iOS-Kurzbefehle.
 *
 * Apple Erinnerungen und Health haben keine Cloud-API — beides schiebt eine
 * Kurzbefehl-Automation vom iPhone hierher. Beide Blöcke sind optional, ein
 * Kurzbefehl darf also nur Erinnerungen oder nur Health schicken.
 *
 * Der Parser ist bewusst nachsichtig: JSON in Kurzbefehlen zusammenzubauen ist
 * fummelig, deshalb werden mehrere plausible Formen akzeptiert (Zahl als Text,
 * `1`/`true` für erledigt, Titel-Liste als Text). Lieber ein Feld mehr verstehen
 * als den Nutzer eine Fehlermeldung debuggen lassen.
 *
 *   POST /api/ingest/apple
 *   Authorization: Bearer <INGEST_SECRET>
 */

export const dynamic = 'force-dynamic';

interface RawReminder {
  id?: string | number;
  title?: string;
  name?: string;
  list?: string;
  listName?: string;
  dueAt?: string;
  due?: string;
  dueDate?: string;
  completed?: boolean | string | number;
  isCompleted?: boolean | string | number;
  priority?: number | string;
  notes?: string;
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function checkAuth(req: Request): boolean {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return false; // ohne konfiguriertes Secret nimmt der Endpunkt nichts an
  const header = req.headers.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token === secret;
}

const truthy = (v: unknown): boolean =>
  v === true || v === 1 || v === '1' || v === 'true' || v === 'yes' || v === 'ja';

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    // Kurzbefehle liefern gern "1.840,5" oder "1840 kcal"
    const cleaned = v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Fälligkeitstag in Berliner Zeit — danach filtert das Dashboard. */
function berlinDay(value?: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : getBerlinDateStr(d);
}

/**
 * Alle JSON-Objekte aus einem Text ziehen, per Klammerzählung.
 *
 * Kein `JSON.parse` auf den ganzen String und kein Zeilen-Split: Kurzbefehle
 * hängen mehrere Objekte hintereinander (`{…}{…}`) und drucken sie dabei
 * mehrzeilig-eingerückt. Beides bricht die einfacheren Verfahren.
 * Anführungszeichen werden übersprungen, damit eine Klammer *im Titel* nicht
 * mitzählt.
 */
function extractJsonObjects(text: string): unknown[] {
  const found: unknown[] = [];
  let depth = 0, start = -1, inString = false, escaped = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }

    if (c === '"') inString = true;
    else if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}' && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        try { found.push(JSON.parse(text.slice(start, i + 1))); } catch { /* Fragment überspringen */ }
        start = -1;
      }
    }
  }

  return found;
}

/**
 * Die Nutzlast auf eine flache Liste aus Objekten bzw. Titeln bringen.
 *
 * Kurzbefehle liefern je nach Feldtyp drei verschiedene Formen — und welche,
 * sieht man dem Kurzbefehl nicht an:
 *   1. `[{…}, {…}]`   — JSON-Feld vom Typ Array, sauber
 *   2. `[[{…}, {…}]]` — Listen-Variable in ein Array-Feld gelegt, eine Ebene zu tief
 *   3. `"{…}\n{…}"`   — Listen-Variable in ein *Text*-Feld gelegt: Shortcuts
 *                       serialisiert die Objekte zu Text, und ohne Behandlung
 *                       landet dieser JSON-Text als *Titel* einer einzigen
 *                       Erinnerung in der Aufgaben-Karte.
 * Reine Titelzeilen ohne JSON bleiben weiterhin gültig.
 */
function expandRaw(value: unknown): Array<RawReminder | string> {
  if (Array.isArray(value)) return value.flatMap(expandRaw);
  if (value && typeof value === 'object') return [value as RawReminder];
  if (typeof value !== 'string') return [];

  const objects = value.includes('{') ? extractJsonObjects(value) : [];
  if (objects.length > 0) return objects.flatMap(expandRaw);

  return value.split('\n').map(l => l.trim()).filter(Boolean);
}

function parseReminders(input: unknown): Array<{
  id: string; title: string; listName: string; dueAt: Date | null;
  dueDate: string | null; completed: boolean; priority: number; notes: string;
}> {
  return expandRaw(input).flatMap((raw: RawReminder | string, i) => {
    if (typeof raw === 'string') {
      const title = raw.trim();
      if (!title) return [];
      return [{
        id: `text-${i}-${title.slice(0, 40)}`,
        title, listName: '', dueAt: null, dueDate: null,
        completed: false, priority: 0, notes: '',
      }];
    }

    const title = (raw.title ?? raw.name ?? '').toString().trim();
    if (!title) return [];

    const dueRaw = raw.dueAt ?? raw.due ?? raw.dueDate;
    const dueAt = dueRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? new Date(dueRaw) : null;

    return [{
      id: (raw.id ?? `${title}-${dueRaw ?? ''}`).toString(),
      title,
      listName: (raw.listName ?? raw.list ?? '').toString(),
      dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
      dueDate: berlinDay(dueRaw),
      completed: truthy(raw.completed ?? raw.isCompleted),
      priority: toNumber(raw.priority) ?? 0,
      notes: (raw.notes ?? '').toString(),
    }];
  });
}

interface ParsedTarget {
  metricKey: string;
  targetValue: number;
  targetDate: Date | null;
  startValue: number | null;
  startDate: Date | null;
}

/** Nur ein Datum, kein Zeitpunkt — die Spalten sind DATE. */
function dateOrNull(value: unknown): Date | null {
  const day = berlinDay(value === undefined || value === null ? undefined : String(value));
  return day ? new Date(`${day}T00:00:00.000Z`) : null;
}

/**
 * Zielwerte aus dem Kurzbefehl. Wie beim Rest gilt: lieber eine Schreibweise
 * mehr verstehen, als den Nutzer JSON debuggen lassen.
 *
 *   { "calorieTarget": 2100 }
 *   { "weightTarget": 75, "weightTargetDate": "2027-03-01", "weightStart": 80 }
 *   { "targets": [{ "metric": "body.calories", "value": 2100 }, …] }
 */
function parseTargets(body: Record<string, unknown>): ParsedTarget[] {
  const out = new Map<string, ParsedTarget>();

  const add = (t: ParsedTarget) => out.set(t.metricKey, t);

  if (Array.isArray(body.targets)) {
    for (const raw of body.targets as Array<Record<string, unknown>>) {
      const metricKey = String(raw.metric ?? raw.metricKey ?? '').trim();
      const targetValue = toNumber(raw.value ?? raw.target);
      if (!metricKey || targetValue === null) continue;
      add({
        metricKey,
        targetValue,
        targetDate: dateOrNull(raw.targetDate ?? raw.date),
        startValue: toNumber(raw.startValue ?? raw.start),
        startDate: dateOrNull(raw.startDate),
      });
    }
  }

  const calorieTarget = toNumber(body.calorieTarget ?? body.caloriesTarget);
  if (calorieTarget !== null) {
    add({
      metricKey: 'body.calories',
      targetValue: calorieTarget,
      targetDate: null, startValue: null, startDate: null,
    });
  }

  const weightTarget = toNumber(body.weightTarget);
  if (weightTarget !== null) {
    // Ohne Startpunkt gilt schlicht das Endziel — der Semantic Layer
    // interpoliert dann nicht, statt sich einen Startwert auszudenken.
    add({
      metricKey: 'body.weight',
      targetValue: weightTarget,
      targetDate: dateOrNull(body.weightTargetDate),
      startValue: toNumber(body.weightStart),
      startDate: dateOrNull(body.weightStartDate),
    });
  }

  return [...out.values()];
}

export async function POST(req: Request) {
  if (!checkAuth(req)) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body ist kein gültiges JSON' }, { status: 400 });
  }

  const result: Record<string, number> = {};

  try {
    // ── Erinnerungen: vollständig ersetzen, Apple ist die Wahrheit ──
    if (body.reminders !== undefined) {
      const items = parseReminders(body.reminders);
      // Doppelte IDs würden den createMany sprengen.
      const unique = [...new Map(items.map(i => [i.id, i])).values()];

      await prisma.$transaction([
        prisma.ingestReminder.deleteMany({}),
        ...(unique.length ? [prisma.ingestReminder.createMany({ data: unique })] : []),
        prisma.ingestStatus.upsert({
          where: { source: 'reminders' },
          update: { syncedAt: new Date(), itemCount: unique.length },
          create: { source: 'reminders', itemCount: unique.length },
        }),
      ]);

      result.reminders = unique.length;
    }

    // ── Health: pro Tag und Metrik hochzählen bzw. überschreiben ──
    if (body.health !== undefined || body.calories !== undefined) {
      const entries: Array<{ date: string; metricKey: string; value: number }> = [];

      if (Array.isArray(body.health)) {
        for (const raw of body.health as Array<Record<string, unknown>>) {
          const date = berlinDay(String(raw.date ?? '')) ?? getBerlinDateStr();
          const metricKey = String(raw.metric ?? raw.metricKey ?? 'body.calories');
          const value = toNumber(raw.value);
          if (value !== null) entries.push({ date, metricKey, value });
        }
      }

      // Kurzschreibweise für den einfachsten Kurzbefehl: { "calories": 1840 }
      if (body.calories !== undefined) {
        const value = toNumber(body.calories);
        const date = berlinDay(String(body.date ?? '')) ?? getBerlinDateStr();
        if (value !== null) entries.push({ date, metricKey: 'body.calories', value });
      }

      for (const e of entries) {
        await prisma.ingestHealthDaily.upsert({
          where: { date_metricKey: { date: new Date(`${e.date}T00:00:00.000Z`), metricKey: e.metricKey } },
          update: { value: e.value, syncedAt: new Date() },
          create: { date: new Date(`${e.date}T00:00:00.000Z`), metricKey: e.metricKey, value: e.value },
        });
      }

      await prisma.ingestStatus.upsert({
        where: { source: 'health' },
        update: { syncedAt: new Date(), itemCount: entries.length },
        create: { source: 'health', itemCount: entries.length },
      });

      result.health = entries.length;
    }

    // ── Zielwerte: was Cronometer über das Ziel weiß, nicht über den Tag ──
    // Ändern sich selten, kommen deshalb getrennt und bleiben stehen, bis ein
    // neuer Wert kommt. Ohne sie stehen Kalorien und Gewicht bewusst auf
    // „Ziel fehlt", statt gegen eine erfundene Zahl gemessen zu werden.
    const targets = parseTargets(body);
    if (targets.length) {
      for (const t of targets) {
        await prisma.ingestHealthTarget.upsert({
          where: { metricKey: t.metricKey },
          update: { ...t, syncedAt: new Date() },
          create: t,
        });
      }
      result.targets = targets.length;
    }

    if (Object.keys(result).length === 0) {
      return NextResponse.json(
        {
          error:
            'Nichts erkannt. Erwartet wird "reminders", "health"/"calories" ' +
            'und/oder "targets"/"calorieTarget"/"weightTarget".',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[ingest/apple]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unbekannter Fehler' },
      { status: 500 }
    );
  }
}

/** Kleiner Selbsttest für die Einrichtung: sagt, ob Token und Tabellen stimmen. */
export async function GET(req: Request) {
  if (!checkAuth(req)) return unauthorized();

  const status = await prisma.ingestStatus.findMany();
  return NextResponse.json({
    ok: true,
    sources: Object.fromEntries(
      status.map(s => [s.source, { syncedAt: s.syncedAt.toISOString(), itemCount: s.itemCount }])
    ),
  });
}
