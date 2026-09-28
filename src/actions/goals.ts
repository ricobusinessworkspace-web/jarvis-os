'use server';

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidateTracking } from '@/lib/revalidate';
import { invalidateSemanticConfig } from '@/core/services/AnalyticsService';
import { EDITABLE, REVENUE_METRIC } from '@/core/services/GoalService';
import { getBerlinDateStr } from '@/lib/dateUtils';

/**
 * Ziele bearbeiten — Reiter „Ziele".
 *
 * **Eine Änderung gilt ab heute, nie rückwirkend.** Die laufende Fassung wird
 * am Vortag geschlossen, eine neue beginnt heute; `getMatrix` wählt je Tag
 * die Fassung, die an dem Tag galt. Sonst würde eine Zielerhöhung jeden
 * vergangenen Tag nachträglich schlechter bewerten. Wird am selben Tag
 * mehrmals geändert, wird die heutige Fassung überschrieben, statt Fassungen
 * zu stapeln.
 *
 * Bearbeitet wird nur, was Jarvis gehört (`EDITABLE`). Vertriebsziele gehören
 * dem CRM, Kalorien- und Gewichtsziel kommen aus Apple Health — die Aktionen
 * lehnen alles andere ab, auch wenn es jemand direkt aufruft.
 */

type Result = { success: true } | { success: false; error: string };

const fail = (error: unknown): Result => ({
  success: false,
  error: error instanceof Error ? error.message : 'Unbekannter Fehler',
});

const DAY_MS = 86_400_000;

function done(): Result {
  invalidateSemanticConfig(); // sonst gilt bis zu 30 s das alte Ziel
  revalidateTracking();
  revalidatePath('/ziele');
  return { success: true };
}

/** Neue Fassung ab heute — oder die heutige überschreiben. */
async function revise(
  metricKey: string,
  patch: { baseValue?: number | null; stretchValue?: number | null; derivedConfig?: Record<string, unknown> }
): Promise<Result> {
  const current = await prisma.coreIntention.findFirst({
    where: { metricKey, validTo: null },
    orderBy: { validFrom: 'desc' },
  });
  if (!current) return { success: false, error: `Kein laufendes Ziel für ${metricKey}.` };

  const next = {
    baseValue: patch.baseValue !== undefined ? patch.baseValue : current.baseValue,
    stretchValue: patch.stretchValue !== undefined ? patch.stretchValue : current.stretchValue,
    derivedConfig: (patch.derivedConfig ?? current.derivedConfig) as Prisma.InputJsonValue,
  };

  const unchanged =
    next.baseValue === current.baseValue &&
    next.stretchValue === current.stretchValue &&
    JSON.stringify(next.derivedConfig) === JSON.stringify(current.derivedConfig);
  if (unchanged) return { success: true };

  const today = new Date(`${getBerlinDateStr()}T00:00:00.000Z`);

  if (current.validFrom.getTime() >= today.getTime()) {
    await prisma.coreIntention.update({ where: { id: current.id }, data: next });
  } else {
    await prisma.$transaction([
      prisma.coreIntention.update({
        where: { id: current.id },
        data: { validTo: new Date(today.getTime() - DAY_MS) },
      }),
      prisma.coreIntention.create({
        data: {
          metricKey,
          ...next,
          comparator: current.comparator,
          derivedKind: current.derivedKind,
          activeWeekdays: current.activeWeekdays,
          validFrom: today,
        },
      }),
    ]);
  }
  return done();
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Schlaf, Training, Post: Basis und (optional) Soll. */
export async function saveFixedGoal(metricKey: string, base: number, stretch: number | null): Promise<Result> {
  try {
    if (!(EDITABLE.fixed as readonly string[]).includes(metricKey)) {
      return { success: false, error: 'Dieses Ziel wird hier nicht bearbeitet.' };
    }
    if (!isNum(base) || base <= 0) return { success: false, error: 'Die Basis muss größer als 0 sein.' };
    if (stretch !== null && (!isNum(stretch) || stretch < base)) {
      return { success: false, error: 'Das Soll darf nicht unter der Basis liegen.' };
    }
    if (metricKey === 'body.sleep_hours' && (base > 24 || (stretch ?? 0) > 24)) {
      return { success: false, error: 'Mehr als 24 Stunden Schlaf gibt es nicht.' };
    }
    return await revise(metricKey, { baseValue: base, stretchValue: stretch });
  } catch (error) {
    return fail(error);
  }
}

/** Routine: wie viele Schritte höchstens fehlen dürfen, damit die Basis gilt. */
export async function saveRoutineMaxSkip(metricKey: string, maxSkip: number): Promise<Result> {
  try {
    if (!(EDITABLE.routine as readonly string[]).includes(metricKey)) {
      return { success: false, error: 'Dieses Ziel wird hier nicht bearbeitet.' };
    }
    if (!Number.isInteger(maxSkip) || maxSkip < 0 || maxSkip > 50) {
      return { success: false, error: 'Bitte eine ganze Zahl ab 0.' };
    }
    const current = await prisma.coreIntention.findFirst({ where: { metricKey, validTo: null } });
    const config = (current?.derivedConfig ?? {}) as Record<string, unknown>;
    return await revise(metricKey, { derivedConfig: { ...config, maxSkip } });
  } catch (error) {
    return fail(error);
  }
}

/**
 * Toleranz um das Health-Ziel. Kalorien in Prozent (0,1 = 10 %), Gewicht in
 * Kilogramm. Das Ziel selbst kommt aus Apple Health und bleibt dort.
 */
export async function saveHealthTolerance(metricKey: 'body.calories' | 'body.weight', value: number): Promise<Result> {
  try {
    const field = EDITABLE.tolerance[metricKey];
    if (!field) return { success: false, error: 'Dieses Ziel wird hier nicht bearbeitet.' };
    const max = metricKey === 'body.calories' ? 0.5 : 10;
    if (!isNum(value) || value < 0 || value > max) {
      return {
        success: false,
        error: metricKey === 'body.calories' ? 'Toleranz zwischen 0 und 50 %.' : 'Toleranz zwischen 0 und 10 kg.',
      };
    }
    const current = await prisma.coreIntention.findFirst({ where: { metricKey, validTo: null } });
    const config = (current?.derivedConfig ?? {}) as Record<string, unknown>;
    return await revise(metricKey, { derivedConfig: { ...config, [field]: value } });
  } catch (error) {
    return fail(error);
  }
}

/**
 * Umsatzziel: Betrag und Stichtag. Ein Ergebnis-Ziel über den ganzen Plan,
 * kein Tagesziel — es wird deshalb überschrieben, nicht historisiert.
 */
export async function saveRevenueGoal(amount: number, until: string): Promise<Result> {
  try {
    if (!isNum(amount) || amount <= 0) return { success: false, error: 'Der Betrag muss größer als 0 sein.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(Date.parse(`${until}T00:00:00Z`))) {
      return { success: false, error: 'Bitte ein gültiges Datum.' };
    }
    const updated = await prisma.coreGoal.updateMany({
      where: { metricKey: REVENUE_METRIC },
      data: {
        targetValue: String(amount),
        horizonEnd: new Date(`${until}T00:00:00.000Z`),
        status: 'active',
      },
    });
    if (updated.count === 0) return { success: false, error: 'Kein Umsatzziel in der Datenbank angelegt.' };
    revalidatePath('/vertrieb');
    revalidatePath('/ziele');
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}
