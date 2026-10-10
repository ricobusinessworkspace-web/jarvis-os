'use client';

import { useSyncExternalStore } from 'react';
import { setToene, toeneAn, TOENE_EVENT } from '@/lib/sound';

const abonnieren = (melden: () => void) => {
  window.addEventListener(TOENE_EVENT, melden);
  window.addEventListener('storage', melden); // anderer Tab
  return () => {
    window.removeEventListener(TOENE_EVENT, melden);
    window.removeEventListener('storage', melden);
  };
};

/** Schalter „Töne" — je Gerät, Standard an. Server und erstes Bild: an. */
export function useToene(): [boolean, (an: boolean) => void] {
  const an = useSyncExternalStore(abonnieren, toeneAn, () => true);
  return [an, setToene];
}
