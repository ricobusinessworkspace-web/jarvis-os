'use server';

import { revalidateTracking } from '@/lib/revalidate';
import { TrackingService } from '@/core/services/TrackingService';

/**
 * Entfernt den Tageseintrag einer Ursache komplett — der Tag steht danach
 * wieder auf „nicht gemessen" statt auf „nicht geschafft". Bei Regeln: der
 * Rückfall ist zurückgenommen.
 */
export async function clearCause(metricKey: string, dateStr: string) {
  try {
    await TrackingService.loescheUrsache(metricKey, dateStr);
    revalidateTracking();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
  }
}
