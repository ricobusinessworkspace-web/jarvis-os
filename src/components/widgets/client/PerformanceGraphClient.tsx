'use client';

import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface PerformanceData {
  date: string;
  routinePercent: number;
  sleepHours: number;
  netWorth: number | null;
  crmCalls: number;
}

export function PerformanceGraphClient({ initialData }: { initialData: PerformanceData[] }) {
  const [showRoutine, setShowRoutine] = useState(true);
  const [showSleep, setShowSleep] = useState(true);
  const [showNetWorth, setShowNetWorth] = useState(false);
  const [showCRM, setShowCRM] = useState(false);

  // Format date to DD.MM
  const data = initialData.map(item => {
    const parts = item.date.split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}` : item.date;
    return { ...item, formattedDate };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-elevated/90 border border-border/50 rounded-xl p-3 shadow-xl backdrop-blur-md text-sm">
          <p className="text-muted font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            let unit = '';
            if (entry.name === 'Routine') unit = '%';
            if (entry.name === 'Schlaf') unit = 'h';
            if (entry.name === 'Net Worth') unit = '€'; // Or $ depending on user context, omitting for now
            return (
              <div key={index} className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-foreground">{entry.name}:</span>
                <span className="text-accent font-semibold">{entry.value}{unit}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-elevated/30 border border-border/30 rounded-3xl p-5 shadow-sm flex flex-col h-full min-h-[350px]"
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="text-accent w-5 h-5" />
        <h3 className="font-semibold text-foreground text-lg">Performance</h3>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-6">
        <button 
          onClick={() => setShowRoutine(!showRoutine)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${showRoutine ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-overlay text-muted border border-border/50'}`}
        >
          Routine
        </button>
        <button 
          onClick={() => setShowSleep(!showSleep)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${showSleep ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-overlay text-muted border border-border/50'}`}
        >
          Schlaf
        </button>
        <button 
          onClick={() => setShowNetWorth(!showNetWorth)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${showNetWorth ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-overlay text-muted border border-border/50'}`}
        >
          Net Worth
        </button>
        <button 
          onClick={() => setShowCRM(!showCRM)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${showCRM ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-overlay text-muted border border-border/50'}`}
        >
          CRM
        </button>
      </div>

      <div className="flex-1 w-full h-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="formattedDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888888', fontSize: 12 }}
              dy={10}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
            
            {showRoutine && (
              <Area 
                type="monotone" 
                dataKey="routinePercent" 
                name="Routine" 
                stroke="#f59e0b" 
                fill="#f59e0b" 
                fillOpacity={0.1}
                strokeWidth={2}
                isAnimationActive={true}
              />
            )}
            
            {showSleep && (
              <Area 
                type="monotone" 
                dataKey="sleepHours" 
                name="Schlaf" 
                stroke="#a855f7" 
                fill="none" 
                strokeWidth={2}
                isAnimationActive={true}
              />
            )}
            
            {showNetWorth && (
              <Area 
                type="monotone" 
                dataKey="netWorth" 
                name="Net Worth" 
                stroke="#10b981" 
                fill="none"
                strokeWidth={2}
                isAnimationActive={true}
                connectNulls
              />
            )}
            
            {showCRM && (
              <Area 
                type="step" 
                dataKey="crmCalls" 
                name="CRM" 
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.2}
                strokeWidth={2}
                isAnimationActive={true}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
