'use client';

import { useState, useEffect } from 'react';
import { getCrmMetrics } from '@/actions/dashboard';
import { motion } from 'framer-motion';
import { Phone, TrendingUp, Star, PhoneCall } from 'lucide-react';
import { type CrmMetrics } from '@/types';
import { cn } from '@/lib/utils';

export default function SalesEngineWidget() {
  const [metrics, setMetrics] = useState<CrmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const result = await getCrmMetrics();
        if (result.success) {
          setMetrics(result.data as any);
        } else {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 300000); // refresh every 5m
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-card p-8 h-[240px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center h-[240px]">
        <p className="text-sm text-destructive font-medium mb-2">CRM Offline</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" /> Sales Engine
        </h3>
        <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded-full">Calling Station</span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col p-3 rounded-lg bg-secondary/40 border border-border/50">
          <span className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" /> Calls Today
          </span>
          <span className="text-2xl font-bold">{metrics.todayCalls}</span>
        </div>
        
        <div className="flex flex-col p-3 rounded-lg bg-secondary/40 border border-border/50">
          <span className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
            <PhoneCall className="h-3.5 w-3.5" /> Calls (7d)
          </span>
          <span className="text-2xl font-bold">{metrics.weeklyCalls}</span>
        </div>
        
        <div className="col-span-2 flex flex-col p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <span className="text-xs text-green-600/80 dark:text-green-400/80 font-medium mb-1 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> Total Pipeline Revenue
          </span>
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">
            {metrics.monthlyRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </span>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Priority Leads</h4>
        {metrics.priorityLeads.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
            {metrics.priorityLeads.map((lead, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-2 rounded-md bg-background border text-sm"
              >
                <span className="font-medium flex items-center gap-2">
                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> 
                  {lead.name}
                </span>
                {lead.umsatz > 0 && (
                  <span className="text-muted-foreground">€{lead.umsatz}</span>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No starred leads right now.</p>
        )}
      </div>
    </div>
  );
}
