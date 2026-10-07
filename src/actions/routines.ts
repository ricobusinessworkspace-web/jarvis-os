'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTracking } from '@/lib/revalidate';
import { invalidateSemanticConfig } from '@/core/services/AnalyticsService';
import { getBerlinDateStr } from '@/lib/dateUtils';

/**
 * Bearbeiten der Routine-Schritte.
 *
 * Schritte haben ein Gültigkeitsfenster (`activeFrom` … `archivedOn`). Ein
 * neuer Schritt zählt ab heute, ein entfernter wird ab heute **archiviert**,
 * nicht gelöscht: ein echtes Löschen nähme per Cascade alle seine Haken mit,
 * und vergangene Tage würden gegen die neue Schrittzahl bewertet. So ist es
 * Ende September passiert (8 → 6 Schritte, Haken verloren).
 *
 * Die Schritte sind Teil des Semantic-Layer-Caches (aus ihnen und `maxSkip`
 * entsteht das Ziel der Routine-Metrik). Jede strukturelle Änderung muss
 * ihn deshalb verwerfen, sonst zeigt das Dashboard bis zu 30 Sekunden lang
 * das alte Ziel.
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

    // Zählt ab heute — vergangene Tage behalten ihr Soll.
    await prisma.trackerItem.create({
      data: {
        trackerId,
        title: clean,
        order: (last?.order ?? 0) + 1,
        activeFrom: new Date(`${getBerlinDateStr()}T00:00:00.000Z`),
      },
    });

    invalidateSemanticConfig(); // ein Schritt mehr = ein höheres Soll ab heute
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

/**
 * Nimmt den Schritt ab heute aus der Routine. Hat er nie einen Haken
 * bekommen, gibt es nichts zu bewahren — dann wird er wirklich gelöscht.
 */
export async function deleteRoutineItem(itemId: string): Promise<Result> {
  try {
    const logs = await prisma.trackerLog.count({ where: { itemId } });
    if (logs === 0) {
      await prisma.trackerItem.delete({ where: { id: itemId } });
    } else {
      await prisma.trackerItem.update({
        where: { id: itemId },
        data: { archivedOn: new Date(`${getBerlinDateStr()}T00:00:00.000Z`) },
      });
    }
    invalidateSemanticConfig(); // ein Schritt weniger = ein niedrigeres Soll ab heute
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
        archivedOn: null,
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

/**
 * Benennt die Routine selbst um (z.B. „Morgenroutine").
 *
 * Der Semantic Layer verweist an zwei Stellen über den **Namen** auf sie: in
 * `core_metric_sources.config.tracker` und in
 * `core_intentions.derived_config.tracker`. Beide werden hier mitgezogen —
 * sonst hätte ein Umbenennen die Metrik still von ihrer Quelle und ihrem Ziel
 * getrennt, ohne dass irgendwo ein Fehler auftaucht.
 */
export async function renameRoutine(trackerId: string, name: string): Promise<Result> {
  try {
    const clean = name.trim();
    if (!clean) return { success: false, error: 'Die Routine braucht einen Namen.' };

    const before = await prisma.tracker.findUnique({
      where: { id: trackerId },
      select: { name: true },
    });
    if (!before) return { success: false, error: 'Routine nicht gefunden.' };
    if (before.name === clean) return { success: true };

    await prisma.tracker.update({ where: { id: trackerId }, data: { name: clean } });
    await retargetTrackerName(before.name, clean);

    invalidateSemanticConfig();
    revalidateTracking();
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

/** Zieht Quellen- und Zielkonfiguration auf den neuen Routinennamen um. */
async function retargetTrackerName(from: string, to: string) {
  const [sources, intentions] = await prisma.$transaction([
    prisma.coreMetricSource.findMany({ where: { kind: 'tracker' } }),
    prisma.coreIntention.findMany({ where: { derivedKind: 'routine_completeness' } }),
  ]);

  const matches = (config: unknown) =>
    typeof config === 'object' && config !== null &&
    String((config as Record<string, unknown>).tracker ?? '').toLowerCase() === from.toLowerCase();

  for (const s of sources) {
    if (!matches(s.config)) continue;
    await prisma.coreMetricSource.update({
      where: { id: s.id },
      data: { config: { ...(s.config as Record<string, unknown>), tracker: to } },
    });
  }

  for (const i of intentions) {
    if (!matches(i.derivedConfig)) continue;
    await prisma.coreIntention.update({
      where: { id: i.id },
      data: { derivedConfig: { ...(i.derivedConfig as Record<string, unknown>), tracker: to } },
    });
  }
}
