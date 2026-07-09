/**
 * System Health / Status Endpoint — /api/status
 * -----------------------------------------------
 * Returns the operational status of all Jarvis OS subsystems.
 * No authentication required (acts as a health-check).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface SubsystemStatus {
  status: 'ok' | 'unavailable' | 'not_configured';
  detail?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  subsystems: {
    database: SubsystemStatus;
    gemini: SubsystemStatus;
    openai: SubsystemStatus;
    elevenlabs: SubsystemStatus;
    n8n: SubsystemStatus;
    obsidian: SubsystemStatus;
  };
}

export async function GET() {
  const health: HealthResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    subsystems: {
      database: { status: 'unavailable' },
      gemini: { status: 'not_configured' },
      openai: { status: 'not_configured' },
      elevenlabs: { status: 'not_configured' },
      n8n: { status: 'unavailable' },
      obsidian: { status: 'not_configured' },
    },
  };

  // ── Database check ──────────────────────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.subsystems.database = { status: 'ok', detail: 'PostgreSQL connected' };
  } catch (err) {
    health.subsystems.database = {
      status: 'unavailable',
      detail: err instanceof Error ? err.message : 'Connection failed',
    };
    health.status = 'degraded';
  }

  // ── API key checks ─────────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    health.subsystems.gemini = { status: 'ok', detail: 'API key configured' };
  }

  if (process.env.OPENAI_API_KEY) {
    health.subsystems.openai = { status: 'ok', detail: 'API key configured' };
  }

  if (process.env.ELEVENLABS_API_KEY) {
    health.subsystems.elevenlabs = { status: 'ok', detail: 'API key configured' };
  }

  // ── n8n reachability check ──────────────────────────────────────────────────
  const n8nBaseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678';
  try {
    const n8nResponse = await fetch(n8nBaseUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(3_000),
    });
    if (n8nResponse.ok || n8nResponse.status === 401) {
      // 401 means n8n is running but requires auth — still reachable
      health.subsystems.n8n = { status: 'ok', detail: `Reachable at ${n8nBaseUrl}` };
    } else {
      health.subsystems.n8n = {
        status: 'unavailable',
        detail: `HTTP ${n8nResponse.status} at ${n8nBaseUrl}`,
      };
    }
  } catch {
    health.subsystems.n8n = {
      status: 'unavailable',
      detail: `Not reachable at ${n8nBaseUrl}`,
    };
  }

  // ── Obsidian vault check ────────────────────────────────────────────────────
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (vaultPath) {
    health.subsystems.obsidian = { status: 'ok', detail: `Vault: ${vaultPath}` };
  }

  // If no AI provider is configured, mark as degraded
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    health.status = 'degraded';
  }

  return NextResponse.json(health);
}
