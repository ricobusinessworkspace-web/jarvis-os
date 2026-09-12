/**
 * Bindet die Vertriebskennzahlen des CRM an (Lesevertrag vom 12.09.2026).
 *
 *   npx tsx scripts/seed-crm-metrics.mts
 *
 * Idempotent. Was hier passiert und warum:
 *
 * - Die Quelle für `sales.calls_count` wechselt von der Rohtabelle `crm_calls`
 *   auf die Sicht `crm_daily_metrics`. Dort ist die Einordnung beim Wählen
 *   eingefroren, und die Abfrage stößt nicht an das Zeilenlimit von PostgREST.
 * - Die Ziele werden abgeleitet statt fest hinterlegt: `crm_metric_targets` im
 *   CRM ist ab jetzt die Quelle. Vorher stand dort 30/60, im CRM 30/100 — zwei
 *   Wahrheiten für dieselbe Zahl.
 * - Die Tracker-Quelle auf Priorität 90 bleibt: fällt das CRM aus, gilt wieder
 *   der Haken von Hand.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const VALID_FROM = new Date('2026-09-01T00:00:00.000Z');

/**
 * Ab wann „keine Zeile" wirklich null heißt.
 *
 * Anrufe: von Beginn an — das CRM protokolliert jeden gewählten Anruf.
 * Stufenwechsel: erst ab dem Deploy vom 12.09.2026, der sie strukturiert
 * festhält. Davor gab es das Protokoll schlicht nicht; eine Null dort wäre
 * die Behauptung, es sei nichts passiert.
 */
const STUFEN_AB = '2026-09-12';

const DEFINITIONS = [
  { key: 'sales.calls_cold_gross', label: 'Cold Großkunden', unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 11 },
  { key: 'sales.calls_cold_tarif', label: 'Cold Tarif',      unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 12 },
  { key: 'sales.calls_followup',   label: 'Nachgreifen',     unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 13 },
  { key: 'sales.stage_cold_pitch',   label: 'Entscheider gesprochen', unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 14 },
  { key: 'sales.stage_pitch_data',   label: 'Daten bekommen',         unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 15 },
  { key: 'sales.stage_data_offer',   label: 'Angebot raus',           unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 16 },
  { key: 'sales.stage_offer_closed', label: 'Abschluss',              unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 17 },
  { key: 'sales.closed_count',       label: 'Abschlüsse',             unit: 'count', aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 18 },
  { key: 'sales.closed_value_eur',   label: 'Erwartete Provision',    unit: 'eur',   aggregation: 'sum', direction: 'higher_is_better', domain: 'business', sortOrder: 19 },
];

/** Metrik → ab wann implizite Null gilt. */
const QUELLEN: Array<{ metricKey: string; zeroFrom: string }> = [
  { metricKey: 'sales.calls_count',       zeroFrom: '2026-09-01' },
  { metricKey: 'sales.calls_cold_gross',  zeroFrom: '2026-09-01' },
  { metricKey: 'sales.calls_cold_tarif',  zeroFrom: '2026-09-01' },
  { metricKey: 'sales.calls_followup',    zeroFrom: '2026-09-01' },
  { metricKey: 'sales.stage_cold_pitch',   zeroFrom: STUFEN_AB },
  { metricKey: 'sales.stage_pitch_data',   zeroFrom: STUFEN_AB },
  { metricKey: 'sales.stage_data_offer',   zeroFrom: STUFEN_AB },
  { metricKey: 'sales.stage_offer_closed', zeroFrom: STUFEN_AB },
  // Abschlüsse haben ein echtes Datum (closed_at_ms), keine implizite Null:
  // 53 der 55 Altabschlüsse tragen keins und würden sonst als „an keinem Tag
  // passiert" gelten, statt als „nicht datiert".
  { metricKey: 'sales.closed_count',     zeroFrom: '' },
  { metricKey: 'sales.closed_value_eur', zeroFrom: '' },
];

/** Metriken, deren Ziel aus dem CRM kommt. Die Stufenwechsel haben bewusst keins. */
const ZIELE = ['sales.calls_count', 'sales.calls_cold_gross', 'sales.calls_cold_tarif', 'sales.calls_followup'];

async function main() {
  for (const d of DEFINITIONS) {
    await prisma.coreMetricDefinition.upsert({ where: { key: d.key }, update: d, create: d });
  }
  console.log(`✓ ${DEFINITIONS.length} Definitionen`);

  // Die alte Rohtabellen-Quelle weicht der Sicht.
  const weg = await prisma.coreMetricSource.deleteMany({
    where: { kind: { in: ['crm_calls', 'crm_metrics'] } },
  });
  await prisma.coreMetricSource.createMany({
    data: QUELLEN.map(q => ({
      metricKey: q.metricKey,
      kind: 'crm_metrics',
      config: { metric: q.metricKey, zeroFrom: q.zeroFrom },
      priority: 10,
    })),
  });
  console.log(`✓ ${QUELLEN.length} Quellen auf crm_daily_metrics (${weg.count} alte entfernt)`);

  for (const metricKey of ZIELE) {
    const bestand = await prisma.coreIntention.findFirst({ where: { metricKey, validTo: null } });
    const data = {
      metricKey,
      baseValue: null,
      stretchValue: null,
      comparator: '>=',
      derivedKind: 'crm_target',
      derivedConfig: { metric: metricKey },
      validFrom: VALID_FROM,
    };
    if (bestand) await prisma.coreIntention.update({ where: { id: bestand.id }, data });
    else await prisma.coreIntention.create({ data });
  }
  console.log(`✓ ${ZIELE.length} Ziele werden jetzt aus crm_metric_targets gelesen`);
}

main()
  .catch(err => { console.error('✗ Fehlgeschlagen:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
