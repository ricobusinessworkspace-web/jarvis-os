'use server';

import { prisma } from '@/lib/prisma';
import { revalidateTracking } from '@/lib/revalidate';
import { TrackingService } from '@/core/services/TrackingService';

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
 * Korrektur von Hand für genau einen Tag.
 *
 * Gedacht für Werte, die sonst nur aus einer Verbindung kommen — Kalorien vor
 * allem: wer einen Tag in Cronometer durchtrackt, ohne dass der Kurzbefehl je
 * lief, muss ihn hier nachtragen können, ohne die Quell-App zu öffnen.
 *
 * Die Korrektur **schlägt jede Automatik**, auch einen späteren Sync. Das ist
 * Absicht — sonst würde der nächste Lauf die Nacharbeit stillschweigend
 * überschreiben. Damit beides nicht unbemerkt auseinanderläuft, zeigt die
 * Oberfläche solche Tage als „von Hand" und bietet `clearManualValue` an, um
 * wieder auf den Wert der Verbindung zurückzufallen.
 *
 * `value === null` speichert bewusst „an diesem Tag nicht gemessen" — etwas
 * anderes als gar keine Korrektur.
 */
export async function setManualValue(metricKey: string, dateStr: string, value: number | null) {
  try {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    await prisma.coreManualValue.upsert({
      where: { date_metricKey: { date, metricKey } },
      update: { value },
      create: { date, metricKey, value },
    });

    revalidateTracking();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
  }
}

/** Nimmt die Korrektur zurück — ab dann gilt wieder, was die Verbindung liefert. */
export async function clearManualValue(metricKey: string, dateStr: string) {
  try {
    await prisma.coreManualValue.deleteMany({
      where: { metricKey, date: new Date(`${dateStr}T00:00:00.000Z`) },
    });

    revalidateTracking();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' };
  }
}

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
