'use server';

import { prisma } from '@/lib/prisma';

export async function getFinanceDashboardData() {
  try {
    // Fetch Buckets
    const bucketSetting = await prisma.setting.findUnique({ where: { key: 'finance_buckets' } });
    const buckets = bucketSetting?.value 
      ? JSON.parse(bucketSetting.value) 
      : { liquid: 0, depot: 0, assets: 0, debt: 0 };

    // Fetch All Transactions
    const transactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' }
    });

    // Compute current Net Worth based on buckets
    const netWorth = buckets.liquid + buckets.depot + buckets.assets - buckets.debt;

    return { 
      success: true, 
      data: { 
        buckets, 
        netWorth, 
        transactions 
      } 
    };
  } catch (error: any) {
    console.error('getFinanceDashboardData error:', error);
    return { success: false, error: error.message };
  }
}
