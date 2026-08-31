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
    <div className="crm-card h-full justify-between">
      <div className="crm-header">
        <h3 className="crm-title">
          <ListTodo className="h-4 w-4 text-blue-400" /> Google Tasks
        </h3>
        <span className="crm-badge !bg-overlay/50 !text-muted">
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
