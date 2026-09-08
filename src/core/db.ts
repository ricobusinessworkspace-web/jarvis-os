/**
 * Historischer Einstiegspunkt. Reicht bewusst denselben Client durch wie
 * `@/lib/prisma` — zwei Clients teilen sich sonst eine Pooler-Verbindung.
 */
export { prisma } from '@/lib/prisma';
