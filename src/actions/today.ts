'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * Hakt eine Ursache für einen Tag ab — oder wieder ab.
 *
 * Geschrieben wird in den Tracker, den die Metrik als manuelle Quelle in
 * `core_metric_sources` führt. Welcher Tracker das ist, steht also in der
 * Konfiguration und nicht hier im Code.
 *
 * `not_done` ist ein bewusst gesetzter Zustand und etwas anderes als eine
 * fehlende Zeile: abgehakt-und-wieder-abgewählt heißt „heute nicht geschafft",
 * gar kein Eintrag heißt „nicht gemessen".
 */
export async function toggleCause(metricKey: string, dateStr: string, done: boolean) {
  try {
    const source = await prisma.coreMetricSource.findFirst({
      where: { metricKey, kind: 'tracker', isActive: true },
      orderBy: { priority: 'desc' },
    });

    const config = (source?.config ?? {}) as Record<string, unknown>;
    const trackerName = typeof config.tracker === 'string' ? config.tracker : '';
    const itemTitle = typeof config.item === 'string' ? config.item : '';

    if (!trackerName || !itemTitle) {
      return { success: false, error: `Für ${metricKey} ist keine manuelle Quelle hinterlegt.` };
    }

    const item = await prisma.trackerItem.findFirst({
      where: { title: itemTitle, tracker: { name: trackerName } },
      select: { id: true },
    });

    if (!item) {
      return { success: false, error: `Tracker-Eintrag „${trackerName} / ${itemTitle}" fehlt.` };
    }

    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const status = done ? 'completed' : 'not_done';

    await prisma.trackerLog.upsert({
      where: { itemId_date: { itemId: item.id, date } },
      update: { status, completedAt: done ? new Date() : null },
      create: { itemId: item.id, date, status, completedAt: done ? new Date() : null },
    });

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
  }
}

/** Ändert Basis- und Soll-Wert einer laufenden Intention. */
export async function updateIntention(metricKey: string, baseValue: number, stretchValue: number | null) {
  try {
    const current = await prisma.coreIntention.findFirst({ where: { metricKey, validTo: null } });
    if (!current) return { success: false, error: `Keine laufende Intention für ${metricKey}.` };

    await prisma.coreIntention.update({
      where: { id: current.id },
      data: { baseValue, stretchValue },
    });

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
  }
}
