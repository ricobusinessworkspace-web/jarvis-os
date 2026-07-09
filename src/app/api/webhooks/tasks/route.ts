/**
 * Tasks Webhook Route — /api/webhooks/tasks
 * ------------------------------------------
 * CRUD operations on tasks, callable from n8n or any authenticated client.
 *
 * POST   — Create or update a task
 * GET    — List tasks (optionally filtered by status / area)
 * DELETE — Delete a task by ID
 */
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { validateWebhookAuth, unauthorizedResponse } from '@/lib/webhook-auth';

// ─── POST: Create or update a task ────────────────────────────────────────────
export async function POST(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { id, title, description, priority, dueDate, projectId, status, area, isRevenueGenerating, projectTags, notes } = body as {
      id?: string;
      title?: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      projectId?: string;
      status?: string;
      area?: string;
      isRevenueGenerating?: boolean;
      projectTags?: any;
      notes?: string;
    };

    // Update existing task
    if (id) {
      const existing = await prisma.task.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: `Task with id "${id}" not found` }, { status: 404 });
      }

      const updated = await prisma.task.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(priority !== undefined && { priority }),
          ...(status !== undefined && { status }),
          ...(area !== undefined && { area }),
          ...(isRevenueGenerating !== undefined && { isRevenueGenerating }),
          ...(projectTags !== undefined && { projectTags }),
          ...(notes !== undefined && { notes }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(projectId !== undefined && { projectId: projectId || null }),
          // Auto-set completedAt when task is marked done
          ...(status === 'done' && { completedAt: new Date() }),
        },
      });

      revalidatePath('/');
      revalidatePath('/tasks');

      return NextResponse.json({ success: true, task: updated, action: 'updated' });
    }

    // Create new task — title is required
    if (!title) {
      return NextResponse.json({ error: 'Field "title" is required for task creation' }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? '',
        priority: priority ?? 'normal',
        status: status ?? 'todo',
        area: area ?? 'personal',
        isRevenueGenerating: isRevenueGenerating ?? false,
        projectTags: projectTags ?? [],
        notes: notes ?? '',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId: projectId || null,
      },
    });

    // Log the activity
    await prisma.activity.create({
      data: {
        type: 'task_created',
        title: `Task erstellt: ${title}`,
        description: description ?? '',
      },
    });

    revalidatePath('/');
    revalidatePath('/tasks');

    return NextResponse.json({ success: true, task, action: 'created' }, { status: 201 });
  } catch (error) {
    console.error('[webhooks/tasks] POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ─── GET: List tasks (optional filters: ?status=todo&area=business) ───────────
export async function GET(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const area = searchParams.get('area');

    const tasks = await prisma.task.findMany({
      where: {
        ...(status && { status }),
        ...(area && { area }),
      },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ success: true, count: tasks.length, tasks });
  } catch (error) {
    console.error('[webhooks/tasks] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ─── DELETE: Remove a task by ID (?id=xxx) ────────────────────────────────────
export async function DELETE(req: Request) {
  if (!validateWebhookAuth(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Query parameter "id" is required' }, { status: 400 });
    }

    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: `Task with id "${id}" not found` }, { status: 404 });
    }

    await prisma.task.delete({ where: { id } });

    revalidatePath('/');
    revalidatePath('/tasks');

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('[webhooks/tasks] DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
