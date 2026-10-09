'use server';

import { TrackingService } from '@/core/services/TrackingService';
import { revalidateTracking } from '@/lib/revalidate';

/**
 * Hakt eine Ursache (oder Regel) für einen Tag ab — oder wieder ab.
 *
 * Dünne Hülle um `TrackingService.setzeUrsache`: derselbe Schreibweg wie für
 * ChatGPT. In welchen Tracker geschrieben wird, steht in `core_metric_sources`.
 *
 * `not_done` ist ein bewusst gesetzter Zustand und etwas anderes als eine
 * fehlende Zeile: abgehakt-und-wieder-abgewählt heißt „heute nicht geschafft",
 * gar kein Eintrag heißt „nicht gemessen".
 */
export async function toggleCause(metricKey: string, dateStr: string, done: boolean) {
  try {
    await TrackingService.setzeUrsache(metricKey, dateStr, done);
    revalidateTracking();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
  }
}
