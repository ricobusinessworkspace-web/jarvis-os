/**
 * 12-Wochen-Block-Logik des 6-Monats-Plans.
 *
 * Block 1 startet am 01.09.2026 — einem Dienstag. Die Blockwochen sind am
 * Startdatum verankert und laufen deshalb Di→Mo, nicht Mo→So. Nur so ist am
 * 08.09. die erste Woche abgeschlossen.
 *
 * Sonntag ist fixer Off-Day: er zählt weder in Adherence noch in Coverage.
 */
import { getBerlinDateStr } from './dateUtils';

export const BLOCK_START = '2026-09-01';
export const BLOCK_WEEKS = 12;
export const TRACKED_WEEKDAYS = [1, 2, 3, 4, 5, 6]; // ISO: 1=Mo … 6=Sa
export const OFF_WEEKDAY = 7; // Sonntag

const DAY_MS = 24 * 60 * 60 * 1000;
const BLOCK_DAYS = BLOCK_WEEKS * 7;

/** Kalendertag als UTC-Mitternacht — frei von Zeitzonen-Drift beim Rechnen. */
function toUtcDay(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** ISO-Wochentag (1=Mo … 7=So) eines `YYYY-MM-DD`-Strings. */
export function isoWeekday(dateStr: string): number {
  return toUtcDay(dateStr).getUTCDay() || 7;
}

export function isOffDay(dateStr: string): boolean {
  return isoWeekday(dateStr) === OFF_WEEKDAY;
}

export function addDays(dateStr: string, days: number): string {
  return new Date(toUtcDay(dateStr).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDay(to).getTime() - toUtcDay(from).getTime()) / DAY_MS);
}

/** Alle Kalendertage von `from` bis `to`, beide inklusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export interface BlockInfo {
  /** 1-basiert. 0 heißt: liegt vor dem Blockstart. */
  blockNumber: number;
  /** 1-basiert, 1…12. */
  weekOfBlock: number;
  /** 1-basiert innerhalb der Blockwoche (Tag 1 = derselbe Wochentag wie der Blockstart). */
  dayOfWeek: number;
  /** 1-basiert innerhalb des Blocks, 1…84. */
  dayOfBlock: number;
  blockStart: string;
  /** Letzter Tag des Blocks, inklusive. */
  blockEnd: string;
  /** Verbleibende Tage bis Blockende, den heutigen Tag mitgezählt. */
  daysRemaining: number;
  isOffDay: boolean;
  /** Vor dem Blockstart gibt es keine Blockposition. */
  beforeStart: boolean;
}

export function blockInfo(dateStr: string = getBerlinDateStr()): BlockInfo {
  const offset = daysBetween(BLOCK_START, dateStr);

  if (offset < 0) {
    return {
      blockNumber: 0,
      weekOfBlock: 0,
      dayOfWeek: 0,
      dayOfBlock: 0,
      blockStart: BLOCK_START,
      blockEnd: addDays(BLOCK_START, BLOCK_DAYS - 1),
      daysRemaining: 0,
      isOffDay: isOffDay(dateStr),
      beforeStart: true,
    };
  }

  const blockIndex = Math.floor(offset / BLOCK_DAYS);
  const dayOfBlock = offset - blockIndex * BLOCK_DAYS;
  const blockStart = addDays(BLOCK_START, blockIndex * BLOCK_DAYS);
  const blockEnd = addDays(blockStart, BLOCK_DAYS - 1);

  return {
    blockNumber: blockIndex + 1,
    weekOfBlock: Math.floor(dayOfBlock / 7) + 1,
    dayOfWeek: (dayOfBlock % 7) + 1,
    dayOfBlock: dayOfBlock + 1,
    blockStart,
    blockEnd,
    daysRemaining: daysBetween(dateStr, blockEnd) + 1,
    isOffDay: isOffDay(dateStr),
    beforeStart: false,
  };
}

/** Die Blockwoche, in der `dateStr` liegt — als [von, bis]. */
export function blockWeekRange(dateStr: string = getBerlinDateStr()): [string, string] {
  const info = blockInfo(dateStr);
  if (info.beforeStart) return [dateStr, dateStr];
  const start = addDays(dateStr, -(info.dayOfWeek - 1));
  return [start, addDays(start, 6)];
}

/** Nur die getrackten Tage (Mo–Sa) eines Zeitraums — der Nenner für Adherence und Coverage. */
export function trackedDays(from: string, to: string): string[] {
  return dateRange(from, to).filter(d => !isOffDay(d));
}
