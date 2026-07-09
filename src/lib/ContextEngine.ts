'use client';

import { useState, useEffect } from 'react';

export type DayPhase = 
  | 'morning' 
  | 'sales_am' 
  | 'admin' 
  | 'sales_pm' 
  | 'deep_work' 
  | 'evening' 
  | 'night';

export interface ContextState {
  phase: DayPhase;
  primaryWidgets: string[];
  secondaryWidgets: string[];
  greeting: string;
}

export function getCurrentPhase(date: Date): DayPhase {
  const hour = date.getHours();
  
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 12) return 'sales_am';
  if (hour >= 12 && hour < 13) return 'admin';
  if (hour >= 13 && hour < 16) return 'sales_pm';
  if (hour >= 16 && hour < 21) return 'deep_work';
  if (hour >= 21 && hour <= 23) return 'evening';
  return 'night';
}

export function getContextForPhase(phase: DayPhase): Omit<ContextState, 'phase'> {
  switch (phase) {
    case 'morning':
      return {
        greeting: 'Guten Morgen, Sir.',
        primaryWidgets: ['routines'], // Morning routine
        secondaryWidgets: ['goals', 'tasks'],
      };
    case 'sales_am':
      return {
        greeting: 'Golden Sales Hours, Sir.',
        primaryWidgets: ['sales'], // CRM
        secondaryWidgets: ['tasks', 'goals'],
      };
    case 'admin':
      return {
        greeting: 'Mittagspause & Admin.',
        primaryWidgets: ['knowledge', 'tasks'], // Knowledge & light tasks
        secondaryWidgets: ['goals'],
      };
    case 'sales_pm':
      return {
        greeting: 'Golden Sales Hours II, Sir.',
        primaryWidgets: ['sales'], // CRM
        secondaryWidgets: ['tasks', 'knowledge'],
      };
    case 'deep_work':
      return {
        greeting: 'Fokuszeit, Sir.',
        primaryWidgets: ['projects', 'tasks'], // Projects & Deep Work
        secondaryWidgets: ['knowledge', 'goals'],
      };
    case 'evening':
      return {
        greeting: 'Guten Abend, Sir.',
        primaryWidgets: ['routines'], // Evening routine
        secondaryWidgets: ['knowledge', 'goals'],
      };
    case 'night':
      return {
        greeting: 'System im Ruhezustand.',
        primaryWidgets: ['knowledge'],
        secondaryWidgets: [],
      };
  }
}

export function useContextEngine() {
  const [context, setContext] = useState<ContextState>({
    phase: 'morning',
    primaryWidgets: [],
    secondaryWidgets: [],
    greeting: 'Initialisiere Jarvis...',
  });

  useEffect(() => {
    const updateContext = () => {
      const now = new Date();
      const phase = getCurrentPhase(now);
      const state = getContextForPhase(phase);
      setContext({ phase, ...state });
    };

    updateContext();
    const interval = setInterval(updateContext, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return context;
}
