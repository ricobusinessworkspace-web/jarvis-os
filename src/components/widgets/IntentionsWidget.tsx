import { RoutineService } from '@/core/services/RoutineService';
import { IntentionsClient } from './client/IntentionsClient';

export default async function IntentionsWidget() {
  const today = new Date();
  const res = await RoutineService.getDashboardTrackers(today);
  
  // Find a tracker named "Ursachen" or "Intentions", if not found create it or just pass null.
  // In a real scenario, the user manages this tracker in settings.
  const trackers = res.trackers || [];
  const intentionsTracker = trackers.find((t: any) => 
    t.name.toLowerCase().includes('ursachen') || 
    t.name.toLowerCase().includes('intention') ||
    t.type === 'intentions'
  );

  return (
    <IntentionsClient initialTracker={intentionsTracker} />
  );
}
