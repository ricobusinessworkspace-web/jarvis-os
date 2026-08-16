import React, { type ReactNode } from 'react';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { StoreHydrator } from '@/components/layout/StoreHydrator';
import { DashboardService } from '@/core/services/DashboardService';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const result = await DashboardService.fetchDashboardData();
  const initialData = result.success ? result.data : {};

  return (
    <StoreHydrator initialData={initialData}>
      <SidebarProvider>
        <DashboardShell>{children}</DashboardShell>
      </SidebarProvider>
    </StoreHydrator>
  );
}
