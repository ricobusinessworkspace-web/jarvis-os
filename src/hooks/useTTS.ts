'use client';

import { useState, useCallback, useRef } from 'react';
import { speakText, stopAudio, type TTSProvider } from '@/lib/voice';

export type TTSStatus = 'idle' | 'loading' | 'speaking';

export interface UseTTSReturn {
  status: TTSStatus;
  /** Enqueue text to be spoken. Sentences are spoken sequentially. */
  speak: (text: string) => void;
  /** Stop all current and queued audio playback. */
  stop: () => void;
  /** Chain a speak call onto the current playback queue (returns a promise). */
  enqueue: (text: string) => Promise<void>;
}

export function useTTS(provider?: TTSProvider): UseTTSReturn {
  const [status, setStatus] = useState<TTSStatus>('idle');
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const abortRef = useRef(false);

  const stop = useCallback(() => {
    abortRef.current = true;
    stopAudio();
    queueRef.current = Promise.resolve();
    setStatus('idle');
    setTimeout(() => { abortRef.current = false; }, 0);
  }, []);

  const enqueue = useCallback((text: string): Promise<void> => {
    const promise = queueRef.current.then(async () => {
      if (abortRef.current) return;
      setStatus('speaking');
      try {
        await speakText(text, provider ? { provider } : undefined);
      } catch (e) {
        console.error('[useTTS] Speech failed:', e);
      }
    });
    
    queueRef.current = promise.then(() => {
      if (queueRef.current === promise) {
        setStatus('idle');
      }
    }).catch(() => {
      setStatus('idle');
    });

    return promise;
  }, [provider]);

  const speak = useCallback((text: string) => {
    setStatus('loading');
    enqueue(text);
  }, [enqueue]);

  return { status, speak, stop, enqueue };
}
