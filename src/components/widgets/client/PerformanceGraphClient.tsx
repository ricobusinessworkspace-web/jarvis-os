'use client';

import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface PerformanceData {
  date: string;
  morningPercent: number;
  eveningPercent: number;
  sleepHours: number;
}

export function PerformanceGraphClient({ initialData }: { initialData: PerformanceData[] }) {
  const [showMorning, setShowMorning] = useState(true);
  const [showEvening, setShowEvening] = useState(true);
  const [showSleep, setShowSleep] = useState(true);

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
          <p className="text-muted font-bold tracking-tight mb-2 text-[10px] uppercase">{label}</p>
          {payload.map((entry: any, index: number) => {
            let unit = '';
            if (entry.name.includes('Routine')) unit = '%';
            if (entry.name === 'Schlaf') unit = 'h';
            return (
              <div key={index} className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-foreground text-xs font-medium">{entry.name}:</span>
                <span className="text-accent text-xs font-black">{entry.value}{unit}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-elevated/40 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm space-y-4 h-full flex flex-col min-h-[350px]">
      <div className="flex items-center justify-between border-b border-border/20 pb-3">
        <h3 className="text-sm font-bold tracking-tight flex items-center gap-2.5">
          <TrendingUp className="h-4 w-4 text-accent" /> Performance
        </h3>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <button 
          onClick={() => setShowMorning(!showMorning)}
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${showMorning ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-overlay text-muted border border-border/50'}`}
        >
          Morgenroutine
        </button>
        <button 
          onClick={() => setShowEvening(!showEvening)}
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${showEvening ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-overlay text-muted border border-border/50'}`}
        >
          Abendroutine
        </button>
        <button 
          onClick={() => setShowSleep(!showSleep)}
          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${showSleep ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-overlay text-muted border border-border/50'}`}
        >
          Schlaf
        </button>
      </div>

      <div className="flex-1 w-full h-full min-h-[200px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="formattedDate" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#888888', fontSize: 10, fontWeight: 600 }}
              dy={10}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
            
            {showMorning && (
              <Area 
                type="monotone" 
                dataKey="morningPercent" 
                name="Morgen-Routine" 
                stroke="#f59e0b" 
                fill="#f59e0b" 
                fillOpacity={0.15}
                strokeWidth={2}
                isAnimationActive={true}
              />
            )}

            {showEvening && (
              <Area 
                type="monotone" 
                dataKey="eveningPercent" 
                name="Abend-Routine" 
                stroke="#3b82f6" 
                fill="#3b82f6" 
                fillOpacity={0.15}
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
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
