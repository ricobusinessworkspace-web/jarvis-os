'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ─── INIT DATA ───
export async function getDashboardData() {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const trackers = await prisma.tracker.findMany({
      include: {
        items: {
          include: {
            logs: {
              where: {
                date: {
                  gte: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
                }
              }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      include: { project: true, goal: true }
    });

    const personalLogs = await prisma.personalLog.findMany({
      where: {
        date: {
          gte: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      }
    });

    let todayLog = personalLogs.find(l => l.date === todayStr);
    if (!todayLog) {
      todayLog = await prisma.personalLog.create({
        data: { date: todayStr }
      });
      personalLogs.push(todayLog);
    }

    const contentItems = await prisma.contentItem.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, data: { trackers, tasks, personalLogs, todayLog, contentItems } };
  } catch (error: any) {
    console.error('getDashboardData error:', error);
    return { success: false, error: error.message };
  }
}

// ─── CRM ───
export async function getCrmMetrics() {
  try {
    // Need to aggregate data from crm_leads and crm_events
    // We do raw queries or Prisma queries if possible
    const nowMs = Date.now();
    const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    
    // Simplistic aggregations using raw since crm_* tables use BigInt IDs
    const totalLeadsRow = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM crm_leads`;
    const calledTodayRow = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM crm_events WHERE type='call' AND created_at_ms >= ${nowMs - 24 * 60 * 60 * 1000}`;
    const calledWeekRow = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM crm_events WHERE type='call' AND created_at_ms >= ${weekAgoMs}`;
    const pipelineRow = await prisma.$queryRaw<any[]>`SELECT SUM(umsatz) as sum FROM crm_leads WHERE status NOT IN ('TerminGeplatzt', 'TerminAbgesagt')`;
    
    const countTotal = Number(totalLeadsRow[0]?.count || 0);
    const todayCalls = Number(calledTodayRow[0]?.count || 0);
    const weeklyCalls = Number(calledWeekRow[0]?.count || 0);
    const monthlyRevenue = Number(pipelineRow[0]?.sum || 0);

    return { 
      success: true, 
      data: {
        totalLeads: countTotal,
        todayCalls,
        weeklyCalls,
        monthlyRevenue,
        priorityLeads: []
      } 
    };
  } catch (error: any) {
    console.error('getCrmMetrics error:', error);
    return { success: false, error: error.message };
  }
}

// ─── TASKS ───
export async function updateTask(id: string, data: any) {
  try {
    const updated = await prisma.task.update({ where: { id }, data });
    revalidatePath('/');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createTask(data: any) {
  try {
    const created = await prisma.task.create({ data });
    revalidatePath('/');
    return { success: true, data: created };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteTask(id: string) {
  try {
    await prisma.task.delete({ where: { id } });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── CONTENT ───
export async function createContentItem(data: any) {
  try {
    const created = await prisma.contentItem.create({ data });
    revalidatePath('/content');
    return { success: true, data: created };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateContentItem(id: string, data: any) {
  try {
    const updated = await prisma.contentItem.update({ where: { id }, data });
    revalidatePath('/content');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteContentItem(id: string) {
  try {
    await prisma.contentItem.delete({ where: { id } });
    revalidatePath('/content');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── SETTINGS ───
export async function updateSetting(key: string, value: string) {
  try {
    const updated = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
    revalidatePath('/content');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── LOGS & TRACKING ───
export async function savePersonalLog(data: any) {
  try {
    const { date, ...rest } = data;
    
    // Auto calculate sleep hours if bed and wake time are present
    let sleepHours = rest.sleepHours;
    let bedTime = rest.bedTime;
    let wakeTime = rest.wakeTime;

    const existing = await prisma.personalLog.findUnique({ where: { date } });
    
    if (bedTime === undefined) bedTime = existing?.bedTime;
    if (wakeTime === undefined) wakeTime = existing?.wakeTime;

    if (bedTime && wakeTime) {
      const bed = new Date(`1970-01-01T${bedTime}:00`);
      const wake = new Date(`1970-01-01T${wakeTime}:00`);
      if (wake < bed) wake.setDate(wake.getDate() + 1);
      sleepHours = Number(((wake.getTime() - bed.getTime()) / (1000 * 60 * 60)).toFixed(1));
    }

    const updated = await prisma.personalLog.upsert({
      where: { date },
      update: { ...rest, sleepHours },
      create: { date, ...rest, sleepHours }
    });

    revalidatePath('/');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function logTrackerItem(itemId: string, status: string, dateStr: string) {
  try {
    const date = new Date(dateStr);
    date.setHours(0,0,0,0);
    const log = await prisma.trackerLog.upsert({
      where: { itemId_date: { itemId, date } },
      update: { status, completedAt: status === 'completed' ? new Date() : null },
      create: { itemId, date, status, completedAt: status === 'completed' ? new Date() : null }
    });
    revalidatePath('/');
    return { success: true, data: log };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateTrackerItem(id: string, data: any) {
  try {
    const updated = await prisma.trackerItem.update({ where: { id }, data });
    revalidatePath('/');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
