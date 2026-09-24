/**
 * Legt die Tabellen von Jarvis an (idempotent): Core Semantic Layer
 * (core-layer.sql) und Mail-Layer (mail-layer.sql).
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

  // Reihenfolge zählt: mail-layer.sql verweist nicht auf core_*, aber neue
  // Dateien könnten es. Immer von unten nach oben anlegen.
  const files = ['core-layer.sql', 'mail-layer.sql'];
  const client = new Client({ connectionString });

  await client.connect();
  try {
    for (const file of files) {
      await client.query(readFileSync(join(here, file), 'utf8'));
    }
    const { rows } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND (table_name LIKE 'core_%' OR table_name LIKE 'mail_%')
        ORDER BY table_name`
    );
    console.log('✓ Migriert:', rows.map(r => r.table_name).join(', '));
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('✗ Migration fehlgeschlagen:', err.message);
  process.exit(1);
});
