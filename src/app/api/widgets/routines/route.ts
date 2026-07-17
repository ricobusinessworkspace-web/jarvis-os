import { NextResponse } from 'next/server';
import { RoutineService } from '@/core/services/RoutineService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    // Simple security: The token should match the one defined in env, 
    // or we use a hardcoded default for the widget to start with.
    // In production, users should set WIDGET_SECRET_TOKEN in .env
    const validToken = process.env.WIDGET_SECRET_TOKEN || 'jarvis-scriptable-secret-123';

    if (token !== validToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { routines, error } = await RoutineService.getTodayRoutines();

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    // Group routines by status to display nicely in the widget
    const completed = routines?.filter(r => r.status === 'completed') || [];
    const pending = routines?.filter(r => r.status !== 'completed' && r.status !== 'skipped') || [];

    return NextResponse.json({
      success: true,
      data: {
        total: routines?.length || 0,
        completed: completed.length,
        pending: pending.length,
        items: routines
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
