'use client';

import React, { type ReactNode, useEffect } from 'react';
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { StoreHydrator } from '@/components/layout/StoreHydrator';
import PullToRefresh from '@/components/PullToRefresh';
import { cn } from '@/lib/utils';
import { getDashboardData } from '@/actions/dashboard';

function DashboardShell({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar();


  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <main
        className={cn(
          "flex flex-1 flex-col transition-[margin-left] duration-250 w-full md:w-auto",
          isCollapsed ? "md:ml-[72px]" : "md:ml-[260px]"
        )}
      >
        <TopBar />

        <div className="flex-1 overflow-y-auto p-4 select-none">
          <PullToRefresh>
            {children}
          </PullToRefresh>
        </div>
      </main>
    </div>
  );
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const result = await getDashboardData();
  const initialData = result.success ? result.data : {};

  return (
    <StoreHydrator initialData={initialData}>
      <SidebarProvider>
        <DashboardShell>{children}</DashboardShell>
      </SidebarProvider>
    </StoreHydrator>
  );
}
