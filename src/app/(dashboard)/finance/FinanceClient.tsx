'use client';

import { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  Wallet, TrendingUp, PiggyBank, Landmark, 
  ArrowUpRight, ArrowDownRight, CircleDollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Transaction } from '@prisma/client';

interface FinanceData {
  buckets: { liquid: number, depot: number, assets: number, debt: number };
  netWorth: number;
  transactions: Transaction[];
}

export default function FinanceClient({ initialData }: { initialData: FinanceData }) {
  const [data] = useState<FinanceData>(initialData);

  // --- Calculations for Chart ---
  const monthlyStats = useMemo(() => {
    const stats: Record<string, { month: string, income: number, expense: number }> = {};
    
    data.transactions.forEach(tx => {
      if (tx.status !== 'cleared') return; // Only count cleared
      const d = new Date(tx.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      
      if (!stats[monthKey]) {
        stats[monthKey] = { month: monthKey, income: 0, expense: 0 };
      }
      
      if (tx.type === 'income') {
        stats[monthKey].income += tx.amount;
      } else {
        stats[monthKey].expense += tx.amount;
      }
    });

    return Object.values(stats)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6); // Last 6 months
  }, [data.transactions]);

  const formatEuro = (val: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 animate-fade-in pb-32">
      {/* HEADER */}
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-xl text-accent"><Wallet className="h-6 w-6" /></div>
          Finanzen
        </h1>
      </header>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="glass p-6 rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity"><TrendingUp className="h-20 w-20 text-accent" /></div>
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">Net Worth</p>
          <p className="text-4xl font-black text-foreground">{formatEuro(data.netWorth)}</p>
        </div>

        {/* Liquid */}
        <div className="glass p-5 rounded-2xl border border-border">
          <div className="flex items-center gap-3 mb-3 text-muted-foreground">
            <CircleDollarSign className="h-5 w-5 text-emerald-500" />
            <p className="text-sm font-medium">Girokonten (Liquid)</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatEuro(data.buckets.liquid)}</p>
        </div>

        {/* Depot */}
        <div className="glass p-5 rounded-2xl border border-border">
          <div className="flex items-center gap-3 mb-3 text-muted-foreground">
            <PiggyBank className="h-5 w-5 text-blue-500" />
            <p className="text-sm font-medium">Depots & Krypto</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatEuro(data.buckets.depot)}</p>
        </div>

        {/* Assets */}
        <div className="glass p-5 rounded-2xl border border-border">
          <div className="flex items-center gap-3 mb-3 text-muted-foreground">
            <Landmark className="h-5 w-5 text-purple-500" />
            <p className="text-sm font-medium">Feste Assets</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatEuro(data.buckets.assets)}</p>
        </div>
      </div>

      {/* CHARTS */}
      <div className="glass p-6 rounded-2xl border border-border">
        <h2 className="text-lg font-bold text-foreground mb-6">Cashflow (Letzte 6 Monate)</h2>
        <div className="h-[250px] w-full">
          {monthlyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  hide 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: '#1C1C1E', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                  formatter={(value: any) => formatEuro(Number(value))}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}
                />
                <Bar dataKey="income" name="Einnahmen" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="expense" name="Ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-muted">
              Keine ausreichenden Transaktionsdaten für Charts.
            </div>
          )}
        </div>
      </div>

      {/* TRANSACTION LIST */}
      <div className="glass rounded-2xl border border-border overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Kürzliche Transaktionen</h2>
        </div>
        <div className="divide-y divide-border">
          {data.transactions.length === 0 ? (
            <div className="p-8 text-center text-muted">Keine Transaktionen gefunden.</div>
          ) : (
            data.transactions.map(tx => (
              <div key={tx.id} className="p-4 px-5 flex items-center justify-between hover:bg-overlay/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-2.5 rounded-full",
                    tx.type === 'income' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {tx.type === 'income' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{tx.description || 'Unbekannt'}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-medium">
                      <span>{formatDate(tx.date)}</span>
                      <span className="w-1 h-1 rounded-full bg-border"></span>
                      <span>{tx.category}</span>
                      {tx.status === 'pending' && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-border"></span>
                          <span className="text-accent">Geplant</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "font-bold text-base",
                  tx.type === 'income' ? "text-emerald-500" : "text-foreground"
                )}>
                  {tx.type === 'income' ? '+' : '-'}{formatEuro(Math.abs(tx.amount))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
