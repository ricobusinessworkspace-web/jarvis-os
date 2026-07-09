/**
 * Knowledge Webhook Route — /api/webhooks/knowledge
 * ---------------------------------------------------
 * Manage knowledge items via n8n or any authenticated client.
 *
 * POST — Create a KnowledgeItem
 * GET  — List knowledge items (optionally filtered by ?type=idea)
 */
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { validateWebhookAuth, unauthorizedResponse } from '@/lib/webhook-auth';

// ─── POST: Create a knowledge item ───────────────────────────────────────────
export async function POST(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { title, content, type, tags, projectId } = body as {
      title?: string;
      content?: string;
      type?: string;
      tags?: string[];
      projectId?: string;
    };

    if (!title) {
      return NextResponse.json(
        { error: 'Field "title" is required' },
        { status: 400 },
      );
    }

    const item = await prisma.knowledgeItem.create({
      data: {
        title,
        content: content ?? '',
        type: type ?? 'note',
        tags: tags ?? [],
        projectId: projectId || null,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'note_created',
        title: `Wissenseintrag erstellt: ${title}`,
        description: `Typ: ${type ?? 'note'}`,
      },
    });

    revalidatePath('/');

    return NextResponse.json({ success: true, item, action: 'created' }, { status: 201 });
  } catch (error) {
    console.error('[webhooks/knowledge] POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ─── GET: List knowledge items (optional filter: ?type=idea) ──────────────────
export async function GET(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const items = await prisma.knowledgeItem.findMany({
      where: {
        ...(type && { type }),
      },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, count: items.length, items });
  } catch (error) {
    console.error('[webhooks/knowledge] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
