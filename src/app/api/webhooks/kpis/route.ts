/**
 * KPIs Webhook Route — /api/webhooks/kpis
 * -----------------------------------------
 * Manage KPI metrics via n8n or any authenticated client.
 *
 * POST — Create or upsert a KPI (matched by name)
 * GET  — List all KPIs
 */
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { validateWebhookAuth, unauthorizedResponse } from '@/lib/webhook-auth';

// ─── POST: Create or upsert a KPI ────────────────────────────────────────────
export async function POST(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { name, value, target, unit, category } = body as {
      name?: string;
      value?: number;
      target?: number;
      unit?: string;
      category?: string;
    };

    if (!name || value === undefined) {
      return NextResponse.json(
        { error: 'Fields "name" and "value" are required' },
        { status: 400 },
      );
    }

    // Try to find an existing KPI with the same name for upsert behaviour
    const existing = await prisma.kPI.findFirst({ where: { name } });

    let kpi;
    let action: 'created' | 'updated';

    if (existing) {
      kpi = await prisma.kPI.update({
        where: { id: existing.id },
        data: {
          value,
          ...(target !== undefined && { target }),
          ...(unit !== undefined && { unit }),
          ...(category !== undefined && { category }),
          trackedAt: new Date(),
        },
      });
      action = 'updated';
    } else {
      kpi = await prisma.kPI.create({
        data: {
          name,
          value,
          target: target ?? 0,
          unit: unit ?? '',
          category: category ?? 'general',
        },
      });
      action = 'created';
    }

    revalidatePath('/');

    return NextResponse.json(
      { success: true, kpi, action },
      { status: action === 'created' ? 201 : 200 },
    );
  } catch (error) {
    console.error('[webhooks/kpis] POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ─── GET: List all KPIs ───────────────────────────────────────────────────────
export async function GET(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const kpis = await prisma.kPI.findMany({
      orderBy: { trackedAt: 'desc' },
    });

    return NextResponse.json({ success: true, count: kpis.length, kpis });
  } catch (error) {
    console.error('[webhooks/kpis] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
