import { PerformanceService } from '@/core/services/PerformanceService';
import { PerformanceGraphClient } from './client/PerformanceGraphClient';

export default async function PerformanceGraphWidget() {
  const data = await PerformanceService.getPerformanceData(14);
  return <PerformanceGraphClient initialData={data} />;
}
