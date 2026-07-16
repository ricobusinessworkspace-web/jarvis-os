import { FinanceService } from '@/core/services/FinanceService';
import { NetWorthClient } from './client/NetWorthClient';

export default async function NetWorthWidget() {
  const { history, current, transactions } = await FinanceService.getNetWorthData();
  
  return (
    <NetWorthClient 
      initialHistory={history || []} 
      initialCurrent={current || null}
      initialTransactions={transactions || []}
    />
  );
}
