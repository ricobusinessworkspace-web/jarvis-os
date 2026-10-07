/**
 * Phase 2 (ab 07.10.2026): Regeln statt Körperwerte.
 *
 *   npx tsx scripts/phase-2.mts
 *
 * Idempotent. Löscht nichts — es **schließt** und **ergänzt**:
 * - Tracker „Regeln" (Typ `rules`) mit drei Haken, gültig ab Phasenstart.
 * - Je Regel eine Metrik (Domäne `rules`), Quelle = der Haken, Ziel = 1 an
 *   allen sieben Tagen (`active_weekdays` 1–7: auch sonntags).
 * - Schlaf, Kalorien und Gewicht: das laufende Ziel endet am Vortag des
 *   Phasenstarts. Vergangene Tage behalten ihre Bewertung, die Werte bleiben,
 *   ab Phase 2 stehen sie als „erfasst" ohne Ziel da.
 *
 * Bewusst nicht über `core:seed`: der Seed ersetzt alle Quellen und kennt die
 * CRM-Quellen (`crm_metrics`) nicht mehr — er würde die Vertriebsmetriken
 * abklemmen.
 *
 * Geteilte Datenbank: Dev = Production. Zusammen mit dem Code veröffentlichen.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { PHASE_2_START } from '../src/lib/phases';
import { addDays } from '../src/lib/blocks';

const prisma = new PrismaClient();

const TRACKER = 'Regeln';
const START = new Date(`${PHASE_2_START}T00:00:00.000Z`);
const END_PHASE_1 = new Date(`${addDays(PHASE_2_START, -1)}T00:00:00.000Z`);

const RULES = [
  { key: 'rule.nofap', label: 'NoFap', sortOrder: 90 },
  { key: 'rule.substances', label: 'Kein Alkohol & Cannabis', sortOrder: 91 },
  { key: 'rule.scrolling', label: 'Kein Scrolling', sortOrder: 92 },
];

const BODY = ['body.sleep_hours', 'body.calories', 'body.weight'];

async function main() {
  // 1. Tracker und Haken
  let tracker = await prisma.tracker.findFirst({ where: { name: TRACKER } });
  if (!tracker) {
    tracker = await prisma.tracker.create({
      data: { name: TRACKER, type: 'rules', description: 'Was ich jeden Tag nicht tue — ab Phase 2.' },
    });
    console.log(`✓ Tracker „${TRACKER}" angelegt`);
  }

  for (const [i, rule] of RULES.entries()) {
    const exists = await prisma.trackerItem.findFirst({ where: { trackerId: tracker.id, title: rule.label } });
    if (!exists) {
      await prisma.trackerItem.create({
        data: { trackerId: tracker.id, title: rule.label, order: i + 1, activeFrom: START },
      });
      console.log(`✓ Haken „${rule.label}"`);
    }
  }

  // 2. Metriken, Quellen, Ziele
  for (const rule of RULES) {
    const def = {
      key: rule.key,
      label: rule.label,
      unit: 'count',
      aggregation: 'sum',
      direction: 'higher_is_better',
      domain: 'rules',
      sortOrder: rule.sortOrder,
    };
    await prisma.coreMetricDefinition.upsert({ where: { key: rule.key }, update: def, create: def });

    const source = await prisma.coreMetricSource.findFirst({ where: { metricKey: rule.key, kind: 'tracker' } });
    if (!source) {
      await prisma.coreMetricSource.create({
        data: { metricKey: rule.key, kind: 'tracker', config: { tracker: TRACKER, item: rule.label }, priority: 10 },
      });
    }

    const intention = await prisma.coreIntention.findFirst({ where: { metricKey: rule.key } });
    if (!intention) {
      await prisma.coreIntention.create({
        data: {
          metricKey: rule.key,
          baseValue: 1,
          stretchValue: null,
          comparator: '>=',
          activeWeekdays: [1, 2, 3, 4, 5, 6, 7],
          validFrom: START,
        },
      });
    }
  }
  console.log(`✓ ${RULES.length} Regeln als Metriken (Ziel: täglich gehalten, ab ${PHASE_2_START})`);

  // 3. Körperziele schließen — nur Fassungen, die vor Phase 2 begannen.
  const closed = await prisma.coreIntention.updateMany({
    where: { metricKey: { in: BODY }, validTo: null, validFrom: { lt: START } },
    data: { validTo: END_PHASE_1 },
  });
  const later = await prisma.coreIntention.count({
    where: { metricKey: { in: BODY }, validFrom: { gte: START } },
  });
  console.log(`✓ ${closed.count} Körperziele zum ${addDays(PHASE_2_START, -1)} geschlossen`);
  if (later) console.warn(`! ${later} Körperziel(e) beginnen erst in Phase 2 — bitte von Hand prüfen.`);
}

main()
  .catch(err => {
    console.error('✗ Phase 2 fehlgeschlagen:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
