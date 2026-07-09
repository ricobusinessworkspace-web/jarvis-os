'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Loader2 } from 'lucide-react';
import { getDashboardData } from '@/actions/dashboard';

export function StoreHydrator({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const initialize = useStore((state) => state.initialize);

  useEffect(() => {
    async function loadData() {
      const result = await getDashboardData();
      if (result.success && result.data) {
        initialize(result.data as any);
      }
      setLoading(false);
    }
    
    // Initial load
    loadData();

    // Since we are cloud-native now, real-time updates could use Supabase Realtime
    // For now, we rely on Server Actions triggering revalidations and hydration.
  }, [initialize]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return <>{children}</>;
}
