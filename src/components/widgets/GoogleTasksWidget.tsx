import { getCalendarStatus, fetchGoogleTasks } from '@/actions/google-calendar';
import { ListTodo, CheckSquare, Square } from 'lucide-react';

export default async function GoogleTasksWidget() {
  const status = await getCalendarStatus();
  let tasks: any[] = [];

  if (status.success && status.connected) {
    const res = await fetchGoogleTasks();
    if (res.success && res.data) {
      tasks = res.data;
    }
  }

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-3 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <ListTodo className="h-4 w-4 text-blue-400" /> Google Tasks
        </h3>
        <span className="text-[11px] font-semibold text-muted bg-overlay/50 px-2.5 py-0.5 rounded-full">
          {tasks.filter((t: any) => t.status !== 'completed').length} offen
        </span>
      </div>
      
      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 max-h-[250px] pr-1">
        {tasks.length > 0 ? (
          tasks.map((task: any) => (
            <div key={task.id} className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-overlay/5 transition-colors">
              {task.status === 'completed' ? (
                <CheckSquare className="h-4 w-4 text-accent mt-0.5 shrink-0" />
              ) : (
                <Square className="h-4 w-4 text-muted/40 mt-0.5 shrink-0" />
              )}
              <span className={`text-xs font-medium leading-snug ${task.status === 'completed' ? 'line-through text-muted' : 'text-foreground'}`}>
                {task.title}
              </span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted italic text-center p-4">
            {status.connected ? 'Keine Tasks für heute.' : 'Google nicht verbunden.'}
          </p>
        )}
      </div>
    </div>
  );
}
