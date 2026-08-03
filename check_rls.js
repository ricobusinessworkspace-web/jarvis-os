const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.duzmanqvyhqurxlpxrrg:tuCruv-5pudda-sibdur@aws-1-eu-west-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT relname 
      FROM pg_class 
      WHERE relkind = 'r' 
        AND relnamespace = 'public'::regnamespace 
        AND NOT relrowsecurity;
    `);
    
    console.log("Tables without RLS:");
    result.rows.forEach(r => console.log("-", r.relname));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

main();
