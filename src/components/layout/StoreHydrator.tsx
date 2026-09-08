'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { ContentItem } from '@/types';

export interface StoreInitialData {
  contentItems?: ContentItem[];
  settings?: Record<string, string>;
}

/**
 * Füllt den Zustand-Store einmal mit den serverseitig geladenen Daten.
 *
 * Der Ref-Trick davor las `ref.current` während des Renders — laut React
 * unzuverlässig, weil ein verworfener Render den Ref trotzdem setzt. `useState`
 * mit Initialisierungsfunktion läuft garantiert genau einmal.
 */
export function StoreHydrator({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData: StoreInitialData;
}) {
  const initialize = useStore(state => state.initialize);

  useState(() => {
    initialize(initialData);
    return true;
  });

  return <>{children}</>;
}
