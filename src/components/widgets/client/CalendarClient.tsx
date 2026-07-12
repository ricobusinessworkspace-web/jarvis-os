'use client';

import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { getCalendarAuthUrl, disconnectCalendar } from '@/actions/google-calendar';
import type { GoogleCalendarEvent } from '@/types';

interface Props {
  initialConnected: boolean;
  initialEvents: GoogleCalendarEvent[];
}

export function CalendarClient({ initialConnected, initialEvents }: Props) {
  const [connected, setConnected] = useState(initialConnected);
  const [events, setEvents] = useState(initialEvents);

  const handleConnect = async () => {
    const res = await getCalendarAuthUrl();
    if (res.success && res.url) window.location.href = res.url;
  };

  const handleDisconnect = async () => {
    if (!confirm('Google Kalender Verbindung trennen?')) return;
    const res = await disconnectCalendar();
    if (res.success) {
      setConnected(false);
      setEvents([]);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <Calendar className="h-4 w-4 text-accent" /> Heute
        </h3>
        {connected && (
          <button onClick={handleDisconnect} className="text-muted hover:text-red-400 p-1 transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {!connected ? (
        <div className="text-center p-6 space-y-4">
          <button onClick={handleConnect} className="text-xs font-bold bg-accent text-white px-5 py-2.5 rounded-xl hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all">
            Kalender verbinden
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1 flex-1">
          {events.length > 0 ? (
            events.map((event) => (
              <div key={event.id} className="p-3 rounded-xl bg-background/60 border border-border/40 flex flex-col gap-1 hover:bg-overlay/5 transition-colors">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">Termin</span>
                  <span className="text-[11px] text-muted font-medium">{formatTime(event.start?.dateTime)}</span>
                </div>
                <h4 className="text-xs font-semibold text-foreground truncate">{event.summary}</h4>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted italic text-center p-4">Keine weiteren Termine.</p>
          )}
        </div>
      )}
    </div>
  );
}
