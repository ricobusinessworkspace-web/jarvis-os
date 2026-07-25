const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.duzmanqvyhqurxlpxrrg:tuCruv-5pudda-sibdur@aws-1-eu-west-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sql = `
      CREATE TABLE IF NOT EXISTS public.jarvis_weight_entries (
        id TEXT PRIMARY KEY,
        weight DOUBLE PRECISION NOT NULL,
        date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await client.query(sql);
    console.log("Table jarvis_weight_entries created successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

main();
