'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Flame, Calendar, Activity } from 'lucide-react';
import { createPortal } from 'react-dom';

interface StreakStatsPopoverProps {
  logs: any[];
  title: string;
  children: React.ReactNode;
}

export default function StreakStatsPopover({ logs, title, children }: StreakStatsPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, bottom: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const togglePopover = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        bottom: rect.bottom + window.scrollY,
      });
    }
    setIsOpen(!isOpen);
  };

  // Stats calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calculateDaysCompleted = (days: number) => {
    let completed = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const log = logs.find((l: any) => {
        const lDate = typeof l.date === 'string' ? l.date.split('T')[0] : new Date(l.date).toISOString().split('T')[0];
        return lDate === dateStr;
      });
      if (log && log.status === 'completed') {
        completed++;
      }
    }
    return completed;
  };

  const last7 = calculateDaysCompleted(7);
  const last30 = calculateDaysCompleted(30);

  return (
    <>
      <div ref={triggerRef} onClick={togglePopover}>
        {children}
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          ref={popoverRef}
          className="absolute z-50 animate-in fade-in zoom-in-95 duration-200"
          style={{
            top: coords.bottom + 8,
            right: typeof window !== 'undefined' ? window.innerWidth - coords.left - (triggerRef.current?.offsetWidth || 0) : 0,
          }}
        >
          <div className="bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-xl w-64 p-4 flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-foreground truncate border-b border-border/50 pb-2">
              {title}
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center justify-center bg-elevated rounded-xl p-3">
                <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> 7 Tage
                </span>
                <span className="text-lg font-bold text-accent">{last7}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{Math.round((last7/7)*100)}%</span>
              </div>
              
              <div className="flex flex-col items-center justify-center bg-elevated rounded-xl p-3">
                <span className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> 30 Tage
                </span>
                <span className="text-lg font-bold text-orange-500">{last30}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{Math.round((last30/30)*100)}%</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
