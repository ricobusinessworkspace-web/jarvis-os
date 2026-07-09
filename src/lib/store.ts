import { create } from 'zustand';
import type { Task, ContentItem, PersonalLog, TrackerWithItems, TrackerLog } from '@/types';

interface AppState {
  tasks: Task[];
  contentItems: ContentItem[];
  personalLogs: PersonalLog[];
  todayLog: PersonalLog;
  trackers: TrackerWithItems[];
  settings: Record<string, string>;
  crmOverrides: Array<{ leadId: string; title: string | null; status: string; deadline: string | null }>;
  
  // UI State
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  // Actions
  initialize: (data: Partial<AppState>) => void;
  
  addTask: (task: Task) => void;
  updateTaskInStore: (taskId: string, updates: Partial<Task>) => void;
  removeTask: (taskId: string) => void;
  
  addContentItem: (item: ContentItem) => void;
  updateContentItemInStore: (itemId: string, updates: Partial<ContentItem>) => void;
  removeContentItem: (itemId: string) => void;
  
  updateTodayLog: (updates: Partial<PersonalLog>) => void;
  updateTrackerItemLog: (trackerId: string, itemId: string, log: TrackerLog) => void;
  updateTrackerItemTitleInStore: (trackerId: string, itemId: string, title: string) => void;
  updateSettingInStore: (key: string, value: string) => void;
  updateCrmOverrideInStore: (leadId: string, override: { title?: string | null; status?: string; deadline?: string | null }) => void;
}

export const useStore = create<AppState>((set) => ({
  tasks: [],
  contentItems: [],
  personalLogs: [],
  todayLog: {
    date: new Date().toISOString().split('T')[0],
    sleepHours: 0,
    bedTime: '',
    wakeTime: '',
    sleepQuality: 3,
    mood: 3,
    nutritionCalories: 0,
    nutritionWater: 0,
    workoutCompleted: false,
    workoutNotes: '',
    meals: '',
    createdAt: ''
  },
  trackers: [],
  settings: {},
  crmOverrides: [],
  
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  initialize: (data) => set((state) => ({ ...state, ...data })),

  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  
  updateTaskInStore: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
  })),

  removeTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter(t => t.id !== taskId)
  })),

  addContentItem: (item) => set((state) => ({ contentItems: [item, ...state.contentItems] })),
  
  updateContentItemInStore: (itemId, updates) => set((state) => ({
    contentItems: state.contentItems.map(c => c.id === itemId ? { ...c, ...updates } : c)
  })),

  removeContentItem: (itemId) => set((state) => ({
    contentItems: state.contentItems.filter(c => c.id !== itemId)
  })),

  updateTodayLog: (updates) => set((state) => ({
    todayLog: { ...state.todayLog, ...updates }
  })),

  updateTrackerItemLog: (trackerId, itemId, log) => set((state) => ({
    trackers: state.trackers.map(t => {
      if (t.id !== trackerId) return t;
      return {
        ...t,
        items: t.items.map(item => {
          if (item.id !== itemId) return item;
          const existingLogs = item.logs.filter(l => new Date(l.date).toDateString() !== new Date(log.date).toDateString());
          return {
            ...item,
            logs: [...existingLogs, log]
          };
        })
      };
    })
  })),

  updateTrackerItemTitleInStore: (trackerId, itemId, title) => set((state) => ({
    trackers: state.trackers.map(t => {
      if (t.id !== trackerId) return t;
      return {
        ...t,
        items: t.items.map(item => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            title
          };
        })
      };
    })
  })),

  updateSettingInStore: (key, value) => set((state) => ({
    settings: { ...state.settings, [key]: value }
  })),

  updateCrmOverrideInStore: (leadId, override) => set((state) => {
    const existing = state.crmOverrides.find(o => o.leadId === leadId) || { leadId, title: null, status: 'todo', deadline: null };
    const updated = { ...existing, ...override };
    return {
      crmOverrides: [...state.crmOverrides.filter(o => o.leadId !== leadId), updated]
    };
  })
}));
