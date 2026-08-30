import { TaskService } from '@/core/services/TaskService';
import { ContentService } from '@/core/services/ContentService';
import { fetchCalendarEvents, getCalendarStatus } from '@/actions/google-calendar';
import { UnifiedTaskClient } from './client/UnifiedTaskClient';
import type { GoogleCalendarEvent } from '@/types';

export default async function UnifiedTaskWidget() {
  const taskRes = await TaskService.getDashboardTasks();
  const contentRes = await ContentService.getContentPipeline();
  
  const calStatus = await getCalendarStatus();
  let calendarEvents: GoogleCalendarEvent[] = [];
  if (calStatus.success && calStatus.connected) {
    const eventsRes = await fetchCalendarEvents();
    if (eventsRes.success && eventsRes.data) {
      const now = new Date();
      calendarEvents = eventsRes.data.filter((ev: GoogleCalendarEvent) => {
        if (!ev.end?.dateTime) return true;
        return new Date(ev.end.dateTime) > now;
      });
    }
  }

  return (
    <UnifiedTaskClient 
      initialTasks={taskRes.tasks || []} 
      initialContent={contentRes.items || []}
      initialEvents={calendarEvents}
    />
  );
}
