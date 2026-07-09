'use server';

import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import os from 'os';

const crmCredentialsPath = path.join(os.homedir(), 'dev', 'calling-station', 'credentials.json');



function getGoogleConfig() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return { client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET };
  }
  if (fs.existsSync(crmCredentialsPath)) {
    return JSON.parse(fs.readFileSync(crmCredentialsPath, 'utf8')).installed;
  }
  return null;
}


async function getStoredToken() {
  const setting = await prisma.setting.findUnique({ where: { key: 'google_calendar_token' } });
  if (!setting || !setting.value) return null;
  try {
    return JSON.parse(setting.value);
  } catch {
    return null;
  }
}

async function saveToken(token: any) {
  await prisma.setting.upsert({
    where: { key: 'google_calendar_token' },
    update: { value: JSON.stringify(token) },
    create: { key: 'google_calendar_token', value: JSON.stringify(token) }
  });
}

export async function getCalendarStatus() {
  try {
    const token = await getStoredToken();
    return { success: true, connected: !!token };
  } catch (e: any) {
    return { success: false, connected: false };
  }
}

export async function getCalendarAuthUrl() {
  return { success: true, url: 'http://localhost:3000/api/auth/google' };
}

export async function disconnectCalendar() {
  try {
    await prisma.setting.delete({ where: { key: 'google_calendar_token' } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchCalendarEvents() {
  try {
    let token = await getStoredToken();
    if (!token) return { success: false, error: 'Not connected' };

    const isExpired = Date.now() >= (token.created_at + (token.expires_in * 1000) - 60000);
    if (isExpired) {
      const config = getGoogleConfig();
      if (!config) return { success: false, error: 'CRM credentials missing' };

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.client_id,
          client_secret: config.client_secret,
          refresh_token: token.refresh_token,
          grant_type: 'refresh_token'
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error_description || 'Failed to refresh token');
      }

      token = {
        ...token,
        access_token: data.access_token,
        expires_in: data.expires_in,
        created_at: Date.now()
      };
      await saveToken(token);
    }

    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(start.toISOString())}&timeMax=${encodeURIComponent(end.toISOString())}&singleEvents=true&orderBy=startTime`;

    const eventsRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token.access_token}` }
    });

    if (!eventsRes.ok) {
      return { success: false, error: 'Failed to fetch events' };
    }

    const data = await eventsRes.json();
    return { success: true, data: data.items || [] };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
