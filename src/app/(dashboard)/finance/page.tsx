import { getFinanceDashboardData } from '@/actions/finance';
import FinanceClient from './FinanceClient';

export const dynamic = 'force-dynamic';

export default async function FinancePage() {
  const res = await getFinanceDashboardData();
  
  if (!res.success || !res.data) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="text-red-500">Fehler beim Laden der Finanzdaten: {res.error}</div>
      </div>
    );
  }
  
  return <FinanceClient initialData={res.data} />;
}
