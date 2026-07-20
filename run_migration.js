const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function main() {
  const prisma = new PrismaClient();
  try {
    const sqlPath = path.join(__dirname, '../Lightning CRM/core/migrations_crm_calls.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolons for basic execution (Prisma $executeRawUnsafe sometimes struggles with multiple statements in one call)
    // Wait, DO $$ ... END $$; has semicolons inside.
    // Let's just pass the whole string. Prisma's driver usually handles it.
    await prisma.$executeRawUnsafe(sql);
    console.log("Migration executed successfully via Prisma.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
