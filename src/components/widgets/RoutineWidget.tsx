import { RoutineService } from '@/core/services/RoutineService';
import { RoutineClient } from './client/RoutineClient';

export default async function RoutineWidget() {
  const today = new Date();
  const res = await RoutineService.getDashboardTrackers(today);
  const trackers = res.trackers || [];

  return (
    <RoutineClient initialTrackers={trackers} />
  );
}
