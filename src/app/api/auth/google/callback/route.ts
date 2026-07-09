import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import os from 'os';

const crmCredentialsPath = path.join(os.homedir(), 'dev', 'calling-station', 'credentials.json');
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL ? (process.env.NEXT_PUBLIC_APP_URL + '/api/auth/google/callback') : 'http://localhost:3000/api/auth/google/callback';
export const dynamic = 'force-dynamic';

function getGoogleConfig() {
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return { client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET };
  }
  if (fs.existsSync(crmCredentialsPath)) {
    return JSON.parse(fs.readFileSync(crmCredentialsPath, 'utf8')).installed;
  }
  return null;
}


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return new NextResponse('<html><body style="background:#000;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h1 style="color:#ff9f0a;font-size:36px;margin:0">Abgebrochen</h1><p style="color:#8e8e93;margin-top:12px">Der OAuth-Flow wurde abgebrochen oder kein Code empfangen.</p></div></body></html>', { headers: { 'Content-Type': 'text/html' }});
    }

    const config = getGoogleConfig();
    if (!config) throw new Error('No Google config');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'Failed to exchange token');
    }

    data.created_at = Date.now();
    
    // Store in Postgres via Prisma
    await prisma.setting.upsert({
      where: { key: 'google_calendar_token' },
      update: { value: JSON.stringify(data) },
      create: { key: 'google_calendar_token', value: JSON.stringify(data) }
    });

    return new NextResponse('<html><body style="background:#000;color:#fff;font-family:system-ui,-apple-system;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h1 style="color:#30d158;font-size:36px;margin:0">✓ Verbunden</h1><p style="color:#8e8e93;margin-top:12px;font-size:16px">Google Calendar wurde erfolgreich mit Jarvis OS verknüpft.</p><p style="color:#636366;font-size:13px;margin-top:24px">Du kannst dieses Browserfenster jetzt schließen und zu Jarvis OS zurückkehren.</p></div></body></html>', { headers: { 'Content-Type': 'text/html' }});

  } catch (error: any) {
    return new NextResponse(`<html><body style="background:#000;color:#fff;font-family:system-ui,-apple-system;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h1 style="color:#ff453a;font-size:36px;margin:0">⚠️ Fehler</h1><p style="color:#8e8e93;margin-top:12px;font-size:16px">Fehler beim Verbinden mit Google Calendar.</p><p style="color:#636366;font-size:13px;margin-top:12px">${error.message}</p></div></body></html>`, { headers: { 'Content-Type': 'text/html' }});
  }
}
