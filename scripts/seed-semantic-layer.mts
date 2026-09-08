/**
 * Füllt den Core Semantic Layer mit den Werten aus dem 6-Monats-Plan.
 *
 *   npm run core:seed
 *
 * Idempotent: mehrfach ausführbar, überschreibt Definitionen und Quellen,
 * lässt bestehende Intentionen und Ziele unangetastet (die sind in der UI
 * editierbar und dürfen nicht vom Seed zurückgesetzt werden).
 *
 * Grundsatz: **nur Ziele, die es wirklich gibt.** Der Plan nennt Tagesminima
 * für Calls, Training und Post — mehr nicht. Schlaf, Gewicht und Kalorien
 * bekommen deshalb bewusst kein Soll: sie werden erfasst, nicht bewertet.
 * `revenue.monthly` wird nicht angelegt, solange die Messphase läuft.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

/** Blockstart — muss zu src/lib/blocks.ts passen. */
const VALID_FROM = new Date('2026-09-01T00:00:00.000Z');

/** Name, unter dem das CRM Rico's Calls attribuiert (`crm_calls.by_user_name`). */
const CRM_USER = 'Rico';

const DEFINITIONS = [
  { key: 'sales.calls_count', label: 'Calls',              unit: 'count', aggregation: 'sum',  direction: 'higher_is_better', domain: 'business', sortOrder: 10 },
  { key: 'training.sessions', label: 'Trainingseinheit',   unit: 'count', aggregation: 'sum',  direction: 'higher_is_better', domain: 'body',     sortOrder: 20 },
  { key: 'content.posts',     label: 'Personal Brand Post', unit: 'count', aggregation: 'sum',  direction: 'higher_is_better', domain: 'social',   sortOrder: 30 },
  { key: 'body.sleep_hours',  label: 'Schlaf',             unit: 'hours', aggregation: 'last', direction: 'neutral',          domain: 'body',     sortOrder: 40 },
  { key: 'body.calories',     label: 'Kalorien',           unit: 'kcal',  aggregation: 'sum',  direction: 'neutral',          domain: 'body',     sortOrder: 50 },
  { key: 'body.weight',       label: 'Gewicht',            unit: 'kg',    aggregation: 'last', direction: 'neutral',          domain: 'body',     sortOrder: 60 },
  { key: 'routine.morning',   label: 'Morgenroutine',      unit: 'count', aggregation: 'sum',  direction: 'higher_is_better', domain: 'body',     sortOrder: 70 },
  { key: 'routine.evening',   label: 'Abendroutine',       unit: 'count', aggregation: 'sum',  direction: 'higher_is_better', domain: 'body',     sortOrder: 80 },
];

/**
 * Quellen je Metrik, `priority` aufsteigend = zuerst gefragt.
 * Die manuelle Quelle steht immer zuletzt, damit nichts kaputtgeht,
 * wenn ein System ausfällt.
 */
const SOURCES: Array<{
  metricKey: string;
  kind: string;
  config: Record<string, string | number | boolean>;
  priority: number;
}> = [
  // Calls: echte CRM-Calls, sonst der Tageshaken im Ursachen-Tracker.
  // `impliesZero`: das CRM protokolliert lückenlos, ein Tag ohne Zeile ist
  // deshalb ein Tag mit null Anrufen — nicht ein vergessener Log.
  { metricKey: 'sales.calls_count', kind: 'crm_calls',    config: { userName: CRM_USER, impliesZero: true },         priority: 10 },
  { metricKey: 'sales.calls_count', kind: 'tracker',      config: { tracker: 'Ursachen', item: 'Anrufe' },           priority: 90 },

  // Training: Haken im Tracker, sonst das Workout-Flag im Personal Log.
  { metricKey: 'training.sessions', kind: 'tracker',      config: { tracker: 'Ursachen', item: 'Trainingseinheit' }, priority: 10 },
  { metricKey: 'training.sessions', kind: 'personal_log', config: { field: 'workout_completed' },                    priority: 90 },

  // Post: später zusätzlich das G-Projekt mit priority 5 (Regel „Posting").
  { metricKey: 'content.posts',     kind: 'tracker',      config: { tracker: 'Ursachen', item: 'Personal Brand Post' }, priority: 10 },

  { metricKey: 'body.sleep_hours',  kind: 'personal_log', config: { field: 'sleep_hours' },        priority: 10 },
  { metricKey: 'body.calories',     kind: 'personal_log', config: { field: 'nutrition_calories' }, priority: 90 },
  { metricKey: 'body.weight',       kind: 'weight',       config: {},                              priority: 10 },

  { metricKey: 'routine.morning',   kind: 'tracker',      config: { tracker: 'Morgenroutine' },    priority: 10 },
  { metricKey: 'routine.evening',   kind: 'tracker',      config: { tracker: 'Abendroutine' },     priority: 10 },
];

/**
 * Tagesminima. Nur was im Plan bzw. im CRM steht:
 * 30 Calls Basis (Plan), 60 Soll (user_profiles.daily_call_goal), je 1× Training und Post.
 */
const INTENTIONS = [
  { metricKey: 'sales.calls_count', baseValue: 30, stretchValue: 60 },
  { metricKey: 'training.sessions', baseValue: 1,  stretchValue: null },
  { metricKey: 'content.posts',     baseValue: 1,  stretchValue: null },
];

const GOALS = [
  {
    title: 'Lightning CRM verkauft',
    metricKey: null,
    targetValue: 'sold',
    comparator: '=',
    horizonEnd: new Date('2026-12-31T00:00:00.000Z'),
    status: 'active',
    notes: 'Meilenstein, keine wiederkehrende Metrik. Aktuell ohne UI-Fläche.',
  },
  {
    title: 'Umsatzziel Vertrieb',
    metricKey: null,
    targetValue: null, // bewusst leer, solange die Messphase läuft
    comparator: null,
    horizonEnd: null,
    status: 'pending',
    notes:
      'Baseline wird ermittelt. Kein Zielwert setzen, bis die Conversion aus der Messphase steht. ' +
      'In der UI als „Baseline wird ermittelt" zeigen, niemals als 0 % eines unsichtbaren Ziels.',
  },
];

async function main() {
  for (const def of DEFINITIONS) {
    await prisma.coreMetricDefinition.upsert({ where: { key: def.key }, update: def, create: def });
  }
  console.log(`✓ ${DEFINITIONS.length} Metrik-Definitionen`);

  // Quellen sind reine Konfiguration — komplett ersetzen ist hier korrekt.
  await prisma.coreMetricSource.deleteMany({});
  await prisma.coreMetricSource.createMany({ data: SOURCES });
  console.log(`✓ ${SOURCES.length} Quellen`);

  let created = 0;
  for (const intention of INTENTIONS) {
    const existing = await prisma.coreIntention.findFirst({
      where: { metricKey: intention.metricKey, validTo: null },
    });
    if (existing) continue; // in der UI editierbar — nicht überschreiben
    await prisma.coreIntention.create({ data: { ...intention, validFrom: VALID_FROM } });
    created++;
  }
  console.log(`✓ ${created} Intentionen neu (${INTENTIONS.length - created} bestanden bereits)`);

  for (const goal of GOALS) {
    const existing = await prisma.coreGoal.findUnique({ where: { title: goal.title } });
    if (existing) continue;
    await prisma.coreGoal.create({ data: goal });
  }
  console.log(`✓ ${GOALS.length} Ziele geprüft`);

  // Das Tracker-Item trug das Ziel im Namen ("20 Anrufe") und lief dadurch aus
  // dem Ruder. Der Zielwert lebt jetzt in core_intentions, der Haken heißt neutral.
  const renamed = await prisma.trackerItem.updateMany({
    where: { title: { in: ['20 Anrufe', '30 Anrufe'] } },
    data: { title: 'Anrufe' },
  });
  if (renamed.count) console.log(`✓ Tracker-Item auf "Anrufe" umbenannt (${renamed.count})`);
}

main()
  .catch(err => {
    console.error('✗ Seed fehlgeschlagen:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
