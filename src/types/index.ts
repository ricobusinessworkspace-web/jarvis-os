// ============================================
// Jarvis OS — Core Type Definitions
// ============================================

export interface Task {
  id: string;
  title: string;
  description: string;
  notes?: string;
  status: 'todo' | 'done';
  priority: 'normal' | 'high';
  isRevenueGenerating: boolean;
  dueDate: string | null;
  completedAt: string | null;
  projectTags: string[]; // e.g. ['Personal Brand', 'Podcast']
  createdAt: string;
  updatedAt: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  status: 'idee' | 'in_arbeit' | 'geplant' | 'veroeffentlicht';
  publishDate: string | null;
  category: string;
  subtasks: Subtask[];
  projectTags: string[];
  priority: 'normal' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface PersonalLog {
  date: string; // YYYY-MM-DD
  sleepHours: number;
  bedTime?: string;
  wakeTime?: string;
  sleepQuality: number; // 1-5
  mood: number; // 1-5
  nutritionCalories: number;
  nutritionWater: number; // Liters
  workoutCompleted: boolean;
  workoutNotes: string;
  meals?: string;
  createdAt: string;
}

export interface Tracker {
  id: string;
  name: string;
  type: string; // "routine", "fitness", "learning"
  description: string;
}

export interface TrackerItem {
  id: string;
  trackerId: string;
  title: string;
  icon: string | null;
  order: number;
  expectedDuration: number | null;
  startWindow: string | null;
}

export interface TrackerLog {
  id: string;
  itemId: string;
  date: Date;
  status: 'completed' | 'skipped' | 'not_done';
}

export interface TrackerItemWithLogs extends TrackerItem {
  logs: TrackerLog[];
}

export interface TrackerWithItems extends Tracker {
  items: TrackerItemWithLogs[];
}

export interface CrmMetrics {
  todayCalls: number;
  weeklyCalls: number;
  pipeline: {
    entscheider: number;
    kontakt: number;
    rechnung: number;
    kunden: number;
  };
  prioLeads: number;
  priorityLeads: Array<{ name: string; umsatz: number }>;
}

export interface CrmTask {
  id: string;
  leadId: number;
  leadName: string;
  leadStatus: string;
  taskText: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: string;
}

declare global {
  interface Window {
    electronAPI: {
      isElectron: boolean;
      getAppInfo: () => Promise<any>;
      execCommand: (command: string) => Promise<{ success: boolean; stdout?: string; error?: string }>;
      getCrmMetrics: () => Promise<{ success: boolean; data?: CrmMetrics; error?: string }>;
      getCrmTasks: () => Promise<{ success: boolean; data?: CrmTask[]; error?: string }>;
      
      // SQLite Direct CRUD
      getDashboardData: () => Promise<{
        success: boolean;
        data?: {
          tasks: Task[];
          contentItems: ContentItem[];
          personalLogs: PersonalLog[];
          todayLog: PersonalLog;
          trackers: TrackerWithItems[];
          settings: Record<string, string>;
          crmOverrides: Array<{ leadId: string; title: string | null; status: string; deadline: string | null }>;
        };
        error?: string;
      }>;
      
      createTask: (data: Partial<Task>) => Promise<{ success: boolean; data?: Task; error?: string }>;
      updateTask: (id: string, data: Partial<Task>) => Promise<{ success: boolean; data?: Task; error?: string }>;
      deleteTask: (id: string) => Promise<{ success: boolean; error?: string }>;
      
      createContentItem: (data: Partial<ContentItem>) => Promise<{ success: boolean; data?: ContentItem; error?: string }>;
      updateContentItem: (id: string, data: Partial<ContentItem>) => Promise<{ success: boolean; data?: ContentItem; error?: string }>;
      deleteContentItem: (id: string) => Promise<{ success: boolean; error?: string }>;
      
      savePersonalLog: (data: Partial<PersonalLog>) => Promise<{ success: boolean; data?: PersonalLog; error?: string }>;
      getPersonalLogHistory: (days?: number) => Promise<{ success: boolean; data?: PersonalLog[]; error?: string }>;
      
      logTrackerItem: (itemId: string, status: string, customDateStr?: string | null) => Promise<{ success: boolean; data?: TrackerLog; error?: string }>;
      
      createTrackerItem: (data: { trackerId: string; title: string; startWindow?: string }) => Promise<{ success: boolean; data?: TrackerItem; error?: string }>;
      updateTrackerItem: (id: string, data: Partial<TrackerItem>) => Promise<{ success: boolean; data?: TrackerItem; error?: string }>;
      deleteTrackerItem: (id: string) => Promise<{ success: boolean; error?: string }>;
      
      getTrackerLogHistory: (days?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;

      updateSetting: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;
      updateCrmTaskOverride: (leadId: string, data: { title?: string; status?: string; deadline?: string }) => Promise<{ success: boolean; data?: any; error?: string }>;
      
      // Google Calendar
      googleCalendar: {
        getAuthUrl: () => Promise<{ success: boolean; url?: string; error?: string }>;
        getStatus: () => Promise<{ success: boolean; connected: boolean; error?: string }>;
        disconnect: () => Promise<{ success: boolean; error?: string }>;
        fetchEvents: () => Promise<{ success: boolean; data?: GoogleCalendarEvent[]; error?: string }>;
      };
      
      // Events
      onGoogleCalendarAuthSuccess: (callback: () => void) => void;
      removeGoogleCalendarAuthSuccessListeners: () => void;
      
      onFocusSearchInput: (callback: () => void) => void;
      removeFocusSearchInputListeners: () => void;
      
      onDashboardDataUpdated: (callback: () => void) => void;
      removeDashboardDataUpdatedListeners: () => void;
    };
  }
}
