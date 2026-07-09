import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

const crmCredentialsPath = path.join(os.homedir(), 'dev', 'calling-station', 'credentials.json');
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


// Using Next.js local dev server for loopback
const REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

export async function GET() {
  try {
    , { status: 400 });
    }
    const config = getGoogleConfig();
    if (!config) return NextResponse.json({error: 'No Google config'}, {status: 400});
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
