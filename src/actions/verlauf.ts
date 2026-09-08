'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTracking } from '@/lib/revalidate';

/**
 * Werte eines einzelnen Tages nachtragen oder korrigieren.
 *
 * Ein leeres Feld heißt „nicht gemessen" und wird als solches gespeichert —
 * niemals als 0. Deshalb löscht `null` den Wert, statt ihn zu nullen.
 *
 * Bewusst nicht über `savePersonalLog`: das rechnet Schlafstunden aus Bett-
 * und Aufwachzeit und setzt sie sonst auf 0 — hier trägst du die Stunden
 * direkt ein.
 */
export async function saveDayValues(
  dateStr: string,
  values: { sleepHours?: number | null; weight?: number | null }
) {
  try {
    if (values.sleepHours !== undefined) {
      const hours = values.sleepHours ?? 0; // Spalte ist NOT NULL; 0 gilt als „nicht ausgefüllt"
      await prisma.personalLog.upsert({
        where: { date: dateStr },
        update: { sleepHours: hours },
        create: { date: dateStr, sleepHours: hours },
      });
    }

    if (values.weight !== undefined) {
      const from = new Date(`${dateStr}T00:00:00.000Z`);
      const to = new Date(`${dateStr}T23:59:59.999Z`);
      const existing = await prisma.weightEntry.findFirst({
        where: { date: { gte: from, lte: to } },
        orderBy: { date: 'desc' },
      });

      if (values.weight === null) {
        if (existing) await prisma.weightEntry.delete({ where: { id: existing.id } });
      } else if (existing) {
        await prisma.weightEntry.update({ where: { id: existing.id }, data: { weight: values.weight } });
      } else {
        await prisma.weightEntry.create({ data: { weight: values.weight, date: from } });
      }
    }

    revalidateTracking();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
  }
}

/**
 * Entfernt den Tageseintrag einer Ursache komplett — der Tag steht danach
 * wieder auf „nicht gemessen" statt auf „nicht geschafft".
 */
export async function clearCause(metricKey: string, dateStr: string) {
  try {
    const source = await prisma.coreMetricSource.findFirst({
      where: { metricKey, kind: 'tracker', isActive: true },
      orderBy: { priority: 'desc' },
    });
    const config = (source?.config ?? {}) as Record<string, unknown>;
    const trackerName = typeof config.tracker === 'string' ? config.tracker : '';
    const itemTitle = typeof config.item === 'string' ? config.item : '';
    if (!trackerName || !itemTitle) return { success: false, error: 'Keine manuelle Quelle hinterlegt.' };

    const item = await prisma.trackerItem.findFirst({
      where: { title: itemTitle, tracker: { name: trackerName } },
      select: { id: true },
    });
    if (!item) return { success: false, error: 'Tracker-Eintrag fehlt.' };

    await prisma.trackerLog.deleteMany({
      where: { itemId: item.id, date: new Date(`${dateStr}T00:00:00.000Z`) },
    });

    revalidateTracking();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
  }
}
