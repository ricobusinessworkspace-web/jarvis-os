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
      todayLog = await prisma.personalLog.upsert({
        where: { date: todayStr },
        update: {},
        create: { date: todayStr }
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
    const nowMs = Date.now();
    const weekAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    
    // Simplistic aggregations using raw since crm_* tables use BigInt IDs
    const totalLeadsRow = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM crm_leads`;
    const calledTodayRow = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM crm_events WHERE type='call' AND created_at_ms >= ${nowMs - 24 * 60 * 60 * 1000}`;
    const calledWeekRow = await prisma.$queryRaw<any[]>`SELECT COUNT(*) as count FROM crm_events WHERE type='call' AND created_at_ms >= ${weekAgoMs}`;
    
    // New Pipeline Query
    const pipelineRow = await prisma.$queryRaw<any[]>`
      SELECT 
        COUNT(CASE WHEN entscheider = 1 THEN 1 END)::int as entscheider,
        COUNT(CASE WHEN termin = 1 THEN 1 END)::int as kontakt,
        COUNT(CASE WHEN rechnung = 1 THEN 1 END)::int as rechnung,
        COUNT(CASE WHEN status = 'Kunde' THEN 1 END)::int as kunden
      FROM crm_leads
      WHERE status != 'Uninteressant'
    `;

    const prioLeadsRow = await prisma.$queryRaw<any[]>`
      SELECT COUNT(CASE WHEN starred = 1 THEN 1 END)::int as count FROM crm_leads WHERE status != 'Uninteressant'
    `;
    
    const countTotal = Number(totalLeadsRow[0]?.count || 0);
    const todayCalls = Number(calledTodayRow[0]?.count || 0);
    const weeklyCalls = Number(calledWeekRow[0]?.count || 0);
    
    const pipeline = {
      entscheider: Number(pipelineRow[0]?.entscheider || 0),
      kontakt: Number(pipelineRow[0]?.kontakt || 0),
      rechnung: Number(pipelineRow[0]?.rechnung || 0),
      kunden: Number(pipelineRow[0]?.kunden || 0),
    };
    
    const prioLeads = Number(prioLeadsRow[0]?.count || 0);

    return { 
      success: true, 
      data: {
        totalLeads: countTotal,
        todayCalls,
        weeklyCalls,
        pipeline,
        prioLeads,
        priorityLeads: [] // Keeping for backward compatibility if needed, or remove later
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
    revalidatePath('/', 'layout');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createTask(data: any) {
  try {
    const created = await prisma.task.create({ data });
    revalidatePath('/', 'layout');
    return { success: true, data: created };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteTask(id: string) {
  try {
    await prisma.task.delete({ where: { id } });
    revalidatePath('/', 'layout');
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
    revalidatePath('/', 'layout');
    return { success: true, data: created };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateContentItem(id: string, data: any) {
  try {
    const updated = await prisma.contentItem.update({ where: { id }, data });
    revalidatePath('/content');
    revalidatePath('/', 'layout');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteContentItem(id: string) {
  try {
    await prisma.contentItem.delete({ where: { id } });
    revalidatePath('/content');
    revalidatePath('/', 'layout');
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
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const log = await prisma.trackerLog.upsert({
      where: { itemId_date: { itemId, date } },
      update: { status, completedAt: status === 'completed' ? new Date() : null },
      create: { itemId, date, status, completedAt: status === 'completed' ? new Date() : null }
    });
    revalidatePath('/', 'layout');
    return { success: true, data: log };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateTrackerItem(id: string, data: any) {
  try {
    const updated = await prisma.trackerItem.update({ where: { id }, data });
    revalidatePath('/', 'layout');
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── FINANCE ───
export async function logNetWorth(value: number, target: number) {
  try {
    const created = await prisma.kPI.create({
      data: {
        name: 'Net Worth',
        value,
        target,
        category: 'finance',
        unit: '€'
      }
    });
    revalidatePath('/', 'layout');
    return { success: true, data: created };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
