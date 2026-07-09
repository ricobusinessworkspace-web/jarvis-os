/**
 * Activity Webhook Route — /api/webhooks/activity
 * -------------------------------------------------
 * Log and retrieve system activities via n8n or any authenticated client.
 *
 * POST — Log a new activity
 * GET  — Retrieve recent activities (last 50)
 */
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { validateWebhookAuth, unauthorizedResponse } from '@/lib/webhook-auth';

// ─── POST: Log an activity ───────────────────────────────────────────────────
export async function POST(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { type, title, description, projectName } = body as {
      type?: string;
      title?: string;
      description?: string;
      projectName?: string;
    };

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Fields "type" and "title" are required' },
        { status: 400 },
      );
    }

    const activity = await prisma.activity.create({
      data: {
        type,
        title,
        description: description ?? '',
        projectName: projectName || null,
      },
    });

    revalidatePath('/');

    return NextResponse.json({ success: true, activity }, { status: 201 });
  } catch (error) {
    console.error('[webhooks/activity] POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ─── GET: Retrieve recent activities (last 50) ───────────────────────────────
export async function GET(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const activities = await prisma.activity.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return NextResponse.json({ success: true, count: activities.length, activities });
  } catch (error) {
    console.error('[webhooks/activity] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
