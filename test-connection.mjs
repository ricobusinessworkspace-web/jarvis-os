import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Versuche mit Supabase zu verbinden...");
    const projects = await prisma.project.findMany({ take: 1 });
    console.log("✅ VERBINDUNG ERFOLGREICH!");
    console.log("Gefundene Projekte:", projects);
  } catch (error) {
    console.error("❌ VERBINDUNG FEHLGESCHLAGEN:");
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
