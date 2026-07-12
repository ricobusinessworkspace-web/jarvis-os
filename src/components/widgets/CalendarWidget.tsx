import { getCalendarStatus, fetchCalendarEvents } from '@/actions/google-calendar';
import { CalendarClient } from './client/CalendarClient';
import type { GoogleCalendarEvent } from '@/types';

export default async function CalendarWidget() {
  const status = await getCalendarStatus();
  let events: GoogleCalendarEvent[] = [];

  if (status.success && status.connected) {
    const eventsRes = await fetchCalendarEvents();
    if (eventsRes.success && eventsRes.data) {
      const now = new Date();
      events = eventsRes.data.filter((ev: GoogleCalendarEvent) => {
        if (!ev.end?.dateTime) return true; // all day event
        return new Date(ev.end.dateTime) > now;
      });
    }
  }

  return (
    <CalendarClient 
      initialConnected={status.connected} 
      initialEvents={events} 
    />
  );
}
