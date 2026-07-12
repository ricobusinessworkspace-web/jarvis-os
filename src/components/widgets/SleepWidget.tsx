import { RoutineService } from '@/core/services/RoutineService';
import { SleepClient } from './client/SleepClient';

export default async function SleepWidget() {
  const today = new Date();
  const res = await RoutineService.getPersonalLogs(today);
  const personalLogs: any[] = res.personalLogs || [];
  const todayLog: any = res.todayLog || null;

  return (
    <SleepClient 
      initialPersonalLogs={personalLogs} 
      initialTodayLog={todayLog} 
    />
  );
}
