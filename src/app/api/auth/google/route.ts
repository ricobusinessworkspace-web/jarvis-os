import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

const crmCredentialsPath = path.join(os.homedir(), 'dev', 'calling-station', 'credentials.json');

// Using Next.js local dev server for loopback
const REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

export async function GET() {
  try {
    if (!fs.existsSync(crmCredentialsPath)) {
      return NextResponse.json({ error: 'Google OAuth credentials not found in CRM directory' }, { status: 400 });
    }
    const creds = JSON.parse(fs.readFileSync(crmCredentialsPath, 'utf8'));
    const config = creds.installed;
    if (!config) {
      return NextResponse.json({ error: 'Invalid credentials format' }, { status: 400 });
    }

    const SCOPES = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ].join(' ');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${encodeURIComponent(config.client_id)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&access_type=offline` +
      `&prompt=consent`;

    return NextResponse.redirect(url);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
