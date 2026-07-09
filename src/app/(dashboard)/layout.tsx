'use client';

import React, { type ReactNode, useEffect } from 'react';
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { StoreHydrator } from '@/components/layout/StoreHydrator';

function DashboardShell({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar();


  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main
        className="flex flex-1 flex-col transition-[margin-left] duration-250"
        style={{
          marginLeft: isCollapsed ? 72 : 260,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <TopBar />

        <div className="flex-1 overflow-y-auto p-4 select-none">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <StoreHydrator>
      <SidebarProvider>
        <DashboardShell>{children}</DashboardShell>
      </SidebarProvider>
    </StoreHydrator>
  );
}
