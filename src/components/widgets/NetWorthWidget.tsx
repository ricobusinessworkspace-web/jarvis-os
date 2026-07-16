import { FinanceService } from '@/core/services/FinanceService';
import { NetWorthClient } from './client/NetWorthClient';

export default async function NetWorthWidget() {
  const { history, current, buckets, pipeline } = await FinanceService.getNetWorthData();
  
  return (
    <NetWorthClient 
      initialHistory={history || []} 
      initialCurrent={current || null}
      initialBuckets={buckets || { liquid: 0, depot: 0, assets: 0, debt: 0 }}
      initialPipeline={pipeline || []}
    />
  );
}
