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

// ─── Transaction Edit Action ──────────────────────────────────────────────────
export async function updateTransaction(
  id: string, 
  data: { category?: string; notes?: string; taxRelevant?: boolean }
) {
  try {
    await prisma.transaction.update({
      where: { id },
      data
    });
    return { success: true };
  } catch (error: any) {
    console.error('updateTransaction error:', error);
    return { success: false, error: error.message };
  }
}

// ─── CSV Upload Action (with Auto-Categorization) ───────────────────────────
export async function uploadTransactions(transactions: any[]) {
  try {
    let created = 0;
    let skipped = 0;

    for (const tx of transactions) {
      // Auto-Categorize if category is "Unbekannt" or missing
      let finalCategory = tx.category || 'Sonstiges';
      if (finalCategory === 'Sonstiges' || finalCategory === 'Unbekannt') {
        finalCategory = autoCategorize(tx.description || '', tx.amount);
      }

      try {
        await prisma.transaction.upsert({
          where: { bankTransactionId: tx.bankTransactionId },
          update: {}, // Don't overwrite manually edited transactions
          create: {
            bankTransactionId: tx.bankTransactionId,
            amount: tx.amount,
            type: tx.amount >= 0 ? 'income' : 'expense',
            status: 'cleared',
            category: finalCategory,
            description: tx.description || 'Unbekannt',
            date: new Date(tx.date),
          }
        });
        created++;
      } catch (err: any) {
        // If bankTransactionId collision during parallel upsert, skip
        skipped++;
      }
    }

    return { success: true, created, skipped };
  } catch (error: any) {
    console.error('uploadTransactions error:', error);
    return { success: false, error: error.message };
  }
}

function autoCategorize(desc: string, amount: number): string {
  const d = desc.toLowerCase();
  
  if (d.includes('miete') || d.includes('rundfunk') || d.includes('nebenkosten')) return 'Wohnen';
  if (d.includes('rewe') || d.includes('edeka') || d.includes('aldi') || d.includes('lidl') || d.includes('kaufland') || d.includes('netto') || d.includes('penny') || d.includes('dm drogerie') || d.includes('rossmann')) return 'Lebensmittel';
  if (d.includes('tankstelle') || d.includes('aral') || d.includes('shell') || d.includes('esso') || d.includes('db vertrieb') || d.includes('bvg') || d.includes('uber') || d.includes('lime') || d.includes('tier')) return 'Mobilität';
  if (d.includes('paypal') || d.includes('amazon') || d.includes('klarna') || d.includes('zalando') || d.includes('mediamarkt')) return 'Shopping';
  if (d.includes('apple') || d.includes('google') || d.includes('spotify') || d.includes('netflix') || d.includes('adobe') || d.includes('openai') || d.includes('github') || d.includes('vercel')) return 'Abo/Software';
  if (d.includes('finanzamt') || d.includes('steuer')) return 'Steuer';
  if (d.includes('versicherung') || d.includes('huk') || d.includes('allianz') || d.includes('tk') || d.includes('techniker')) return 'Versicherung';
  if (d.includes('apotheke') || d.includes('arzt') || d.includes('zahnarzt')) return 'Gesundheit';
  if (d.includes('restaurant') || d.includes('cafe') || d.includes('lieferando') || d.includes('wolt') || d.includes('mcdonalds') || d.includes('burger king')) return 'Restaurant/Ausgehen';
  if (d.includes('fitness') || d.includes('mcfit') || d.includes('clever fit') || d.includes('john reed')) return 'Fitness';
  if (d.includes('gehalt') || d.includes('lohn') || d.includes('gmbh') || d.includes('provision')) {
    return amount > 0 ? 'Einkommen' : 'Sonstiges';
  }
  
  return 'Sonstiges';
}
