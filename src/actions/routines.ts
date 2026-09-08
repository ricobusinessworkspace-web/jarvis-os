'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTracking } from '@/lib/revalidate';

/**
 * Bearbeiten der Routine-Schritte.
 *
 * Ein Schritt zu löschen nimmt seine Logs mit (Cascade in der Datenbank) —
 * die Historie dieses Schritts ist damit weg. Deshalb verlangt die Oberfläche
 * dafür einen zweiten Klick.
 */

type Result = { success: true } | { success: false; error: string };

const fail = (error: unknown): Result => ({
  success: false,
  error: error instanceof Error ? error.message : 'Unbekannter Fehler',
});

export async function addRoutineItem(trackerId: string, title: string): Promise<Result> {
  try {
    const clean = title.trim();
    if (!clean) return { success: false, error: 'Der Schritt braucht einen Namen.' };

    const last = await prisma.trackerItem.findFirst({
      where: { trackerId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    await prisma.trackerItem.create({
      data: { trackerId, title: clean, order: (last?.order ?? 0) + 1 },
    });

    revalidateTracking();
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function renameRoutineItem(itemId: string, title: string): Promise<Result> {
  try {
    const clean = title.trim();
    if (!clean) return { success: false, error: 'Der Schritt braucht einen Namen.' };

    await prisma.trackerItem.update({ where: { id: itemId }, data: { title: clean } });
    revalidateTracking();
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

/** Löscht den Schritt samt seiner bisherigen Logs. */
export async function deleteRoutineItem(itemId: string): Promise<Result> {
  try {
    await prisma.trackerItem.delete({ where: { id: itemId } });
    revalidateTracking();
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

/** Tauscht den Schritt mit seinem Nachbarn. */
export async function moveRoutineItem(itemId: string, direction: 'up' | 'down'): Promise<Result> {
  try {
    const item = await prisma.trackerItem.findUnique({
      where: { id: itemId },
      select: { id: true, order: true, trackerId: true },
    });
    if (!item) return { success: false, error: 'Schritt nicht gefunden.' };

    const neighbour = await prisma.trackerItem.findFirst({
      where: {
        trackerId: item.trackerId,
        order: direction === 'up' ? { lt: item.order } : { gt: item.order },
      },
      orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
      select: { id: true, order: true },
    });
    if (!neighbour) return { success: true }; // schon ganz oben bzw. unten

    // Über einen freien Zwischenwert, damit der Unique-Verbund nicht kollidiert.
    await prisma.trackerItem.update({ where: { id: item.id }, data: { order: -1 } });
    await prisma.trackerItem.update({ where: { id: neighbour.id }, data: { order: item.order } });
    await prisma.trackerItem.update({ where: { id: item.id }, data: { order: neighbour.order } });

    revalidateTracking();
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

/** Benennt die Routine selbst um (z.B. „Morgenroutine"). */
export async function renameRoutine(trackerId: string, name: string): Promise<Result> {
  try {
    const clean = name.trim();
    if (!clean) return { success: false, error: 'Die Routine braucht einen Namen.' };

    await prisma.tracker.update({ where: { id: trackerId }, data: { name: clean } });
    revalidateTracking();
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}
