/**
 * Prüft den Semantic Layer gegen echte Daten.
 *
 *   npm run core:check            # laufender Block bis heute
 *   npm run core:check 2026-09-08 # Stichtag setzen
 *
 * Zeigt die Blockposition, die Matrix der Ursachen-Metriken und die Kennzahlen.
 * Gedacht zum Nachrechnen von Hand — bewusst ohne UI dazwischen.
 */
import 'dotenv/config';
import { AnalyticsService } from '../src/core/services/AnalyticsService';
import { blockInfo, dateRange } from '../src/lib/blocks';
import { getBerlinDateStr } from '../src/lib/dateUtils';

const URSACHEN = ['sales.calls_count', 'training.sessions', 'content.posts'];

const SYMBOL: Record<string, string> = {
  soll: '██', basis: '▓▓', unter: '░░', erfasst: '▒▒', ungemessen: ' ·', offday: '  ',
};

async function main() {
  const today = process.argv[2] || getBerlinDateStr();
  const block = blockInfo(today);
  const from = block.beforeStart ? today : block.blockStart;

  console.log(`\nStichtag ${today}`);
  console.log(
    `Block ${block.blockNumber} · Woche ${block.weekOfBlock}/12 · Tag ${block.dayOfWeek} der Woche · ` +
    `Tag ${block.dayOfBlock}/84 · noch ${block.daysRemaining} Tage (bis ${block.blockEnd})` +
    `${block.isOffDay ? ' · OFF-DAY' : ''}`
  );

  const matrix = await AnalyticsService.getMatrix(from, today);
  const days = dateRange(from, today);

  console.log(`\n${'Metrik'.padEnd(20)}${days.map(d => d.slice(8)).join(' ')}`);
  for (const key of URSACHEN) {
    const row = days.map(d => SYMBOL[matrix[d]?.[key]?.state ?? 'ungemessen']).join(' ');
    console.log(`${key.padEnd(20)}${row}`);
  }

  console.log('\nWerte & Quellen:');
  for (const key of URSACHEN) {
    const cells = days
      .map(d => ({ d, c: matrix[d][key] }))
      .filter(x => x.c.value !== null)
      .map(x => `${x.d.slice(8)}.=${x.c.value}${x.c.source ? `(${x.c.source})` : ''}`);
    console.log(`  ${key.padEnd(20)} ${cells.join('  ') || '— nichts gemessen'}`);
  }

  console.log('\nKennzahlen über den Block:');
  for (const key of URSACHEN) {
    const s = AnalyticsService.summarize(matrix, key, from, today);
    const pct = (v: number | null) => (v === null ? '  –' : `${String(Math.round(v * 100)).padStart(3)}%`);
    console.log(
      `  ${key.padEnd(20)} erfüllt ${String(s.met).padStart(2)}/${s.tracked}` +
      `  Adherence ${pct(s.adherence)}  Coverage ${pct(s.coverage)}  Streak ${s.streak}`
    );
  }

  const goals = await AnalyticsService.getGoals();
  console.log('\nZiele:');
  for (const g of goals) {
    console.log(`  ${g.title.padEnd(26)} status=${g.status.padEnd(8)} target=${g.targetValue ?? '— bewusst keiner'}`);
  }

  const intentions = await AnalyticsService.getIntentions();
  console.log('\nSoll-Werte:');
  for (const i of intentions) {
    console.log(`  ${i.metricKey.padEnd(20)} Basis ${i.baseValue}${i.stretchValue ? ` · Soll ${i.stretchValue}` : ''}`);
  }
  console.log();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
