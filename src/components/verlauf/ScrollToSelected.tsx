'use client';

import { useEffect } from 'react';

/**
 * Schiebt den gewählten Tag im Streifen in den Blick. Der Streifen wird
 * serverseitig gerendert und beginnt sonst am ältesten Tag — gewollt ist
 * aber der gewählte, der meistens ganz rechts liegt.
 */
export function ScrollToSelected({ date }: { date: string }) {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-day="${date}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [date]);

  return null;
}
