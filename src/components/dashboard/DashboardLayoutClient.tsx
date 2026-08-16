'use client';

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '@/lib/store';
import { saveDashboardLayout } from '@/actions/dashboard';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';

import CalendarWidget from '@/components/widgets/CalendarWidget';
import TaskWidget from '@/components/widgets/TaskWidget';
import RoutineWidget from '@/components/widgets/RoutineWidget';
import SleepWidget from '@/components/widgets/SleepWidget';
import FiveAmStreakWidget from '@/components/widgets/FiveAmStreakWidget';
import ContentWidget from '@/components/widgets/ContentWidget';
import NetWorthWidget from '@/components/widgets/NetWorthWidget';
import WeightWidget from '@/components/widgets/WeightWidget';
import IntentionsWidget from '@/components/widgets/IntentionsWidget'; // to be created

const WIDGETS = {
  routine: { id: 'routine', component: RoutineWidget, className: 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-3' },
  intentions: { id: 'intentions', component: IntentionsWidget, className: 'col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-3' },
  tasks: { id: 'tasks', component: TaskWidget, className: 'col-span-1 lg:col-span-1 h-[400px]' },
  calendar: { id: 'calendar', component: CalendarWidget, className: 'col-span-1 lg:col-span-1 h-[400px]' },
  networth: { id: 'networth', component: NetWorthWidget, className: 'col-span-1 md:col-span-2 lg:col-span-2 min-h-[350px]' },
  content: { id: 'content', component: ContentWidget, className: 'col-span-1 lg:col-span-1 h-[400px]' },
  health: { id: 'health', component: () => (
    <div className="flex flex-col gap-6 h-full">
      <div className="h-auto"><FiveAmStreakWidget /></div>
      <div className="h-auto"><SleepWidget /></div>
      <div className="h-auto"><WeightWidget /></div>
    </div>
  ), className: 'col-span-1 lg:col-span-1' },
};

const DEFAULT_LAYOUT = ['routine', 'intentions', 'tasks', 'calendar', 'networth', 'content', 'health'];

function SortableItem({ id, isEditing, children, className }: { id: string, isEditing: boolean, children: React.ReactNode, className?: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${className || ''} ${isDragging ? 'opacity-50' : ''}`}>
      {isEditing && (
        <div 
          {...attributes} 
          {...listeners}
          className="absolute inset-0 z-50 bg-black/10 dark:bg-white/10 backdrop-blur-[1px] border-2 border-dashed border-accent/50 rounded-2xl flex items-center justify-center cursor-grab active:cursor-grabbing"
        >
          <div className="bg-background/90 px-4 py-2 rounded-full font-medium shadow-xl">
            Drag to move
          </div>
        </div>
      )}
      <div className={isEditing ? 'opacity-40 pointer-events-none' : ''}>
        {children}
      </div>
    </div>
  );
}

export default function DashboardLayoutClient() {
  const { dashboardLayout, updateDashboardLayout } = useStore();
  const [items, setItems] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  
  useEffect(() => {
    if (dashboardLayout && dashboardLayout.length > 0) {
      // Ensure all current widgets are in layout, removing unknown ones
      const validLayout = dashboardLayout.filter(id => WIDGETS[id as keyof typeof WIDGETS]);
      const missing = Object.keys(WIDGETS).filter(id => !validLayout.includes(id));
      setItems([...validLayout, ...missing]);
    } else {
      setItems(DEFAULT_LAYOUT);
    }
  }, [dashboardLayout]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        
        const newItems = arrayMove(items, oldIndex, newIndex);
        updateDashboardLayout(newItems);
        // Save to DB in background
        saveDashboardLayout(newItems).catch(console.error);
        return newItems;
      });
    }
  };

  if (!items.length) return null;

  return (
    <div className="flex flex-col pb-16 px-4 md:px-8 pt-6 max-w-7xl mx-auto w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <Button 
          variant={isEditing ? "default" : "ghost"} 
          size="sm" 
          onClick={() => setIsEditing(!isEditing)}
          className={isEditing ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}
        >
          <Settings2 className="w-4 h-4 mr-2" />
          {isEditing ? "Done Editing" : "Edit Layout"}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-min">
          <SortableContext
            items={items}
            strategy={rectSortingStrategy}
          >
            {items.map((id) => {
              const widgetConfig = WIDGETS[id as keyof typeof WIDGETS];
              if (!widgetConfig) return null;
              const WidgetComponent = widgetConfig.component;
              
              return (
                <SortableItem key={id} id={id} isEditing={isEditing} className={widgetConfig.className}>
                  <WidgetComponent />
                </SortableItem>
              );
            })}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
}
