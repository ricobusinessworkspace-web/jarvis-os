import { FinanceService } from '@/core/services/FinanceService';
import { NetWorthClient } from './client/NetWorthClient';

export default async function NetWorthWidget() {
  const { history, current } = await FinanceService.getNetWorthHistory();
  
  return (
    <NetWorthClient 
      initialHistory={history || []} 
      initialCurrent={current || null} 
    />
  );
}
