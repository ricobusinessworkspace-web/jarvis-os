'use client';

import { useRef } from 'react';
import { useStore } from '@/lib/store';

export function StoreHydrator({ children, initialData }: { children: React.ReactNode, initialData: any }) {
  const initialize = useStore((state) => state.initialize);
  const initialized = useRef(false);

  if (!initialized.current) {
    initialize(initialData);
    initialized.current = true;
  }

  return <>{children}</>;
}
