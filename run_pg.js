const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.duzmanqvyhqurxlpxrrg:tuCruv-5pudda-sibdur@aws-1-eu-west-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const sqlPath = path.join(__dirname, 'rename_jarvis_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log("Migration executed successfully via pg.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

main();
