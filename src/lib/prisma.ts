import { PrismaClient } from '@prisma/client';

/**
 * Der eine Prisma-Client der App.
 *
 * Wichtig: **nicht** pro Modul einen eigenen anlegen. Die Datenbank läuft über
 * den Supabase-Pooler mit `connection_limit=1` pro Instanz — zwei Clients
 * bedeuten zwei Pools, die sich gegenseitig die Verbindung wegnehmen und in
 * den Timeout laufen.
 *
 * Auch in Produktion auf `globalThis` gecacht: Serverless-Instanzen werten
 * Module mehrfach aus, und jede Auswertung würde sonst einen weiteren Client
 * erzeugen.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

globalForPrisma.prisma = prisma;
