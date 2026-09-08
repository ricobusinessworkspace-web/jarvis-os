/**
 * Legt die Tabellen des Core Semantic Layer an (idempotent).
 *
 *   npm run core:migrate
 *
 * Bewusst rohes SQL statt `prisma db push`: die Datenbank enthält
 * Tabellen fremder Apps (crm_*, g_*, lead_*, user_profiles), die nicht
 * in schema.prisma stehen. `db push` würde sie löschen.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import 'dotenv/config';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DIRECT_URL / DATABASE_URL fehlt in .env');

  const sql = readFileSync(join(here, 'core-layer.sql'), 'utf8');
  const client = new Client({ connectionString });

  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name LIKE 'core_%'
        ORDER BY table_name`
    );
    console.log('✓ Core Layer migriert:', rows.map(r => r.table_name).join(', '));
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('✗ Migration fehlgeschlagen:', err.message);
  process.exit(1);
});
