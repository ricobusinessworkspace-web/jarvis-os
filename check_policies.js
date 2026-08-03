const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.duzmanqvyhqurxlpxrrg:tuCruv-5pudda-sibdur@aws-1-eu-west-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE tablename IN ('crm_leads', 'crm_events', 'user_profiles');
    `);
    
    console.log("Policies for reference tables:");
    result.rows.forEach(r => console.log(r));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

main();
