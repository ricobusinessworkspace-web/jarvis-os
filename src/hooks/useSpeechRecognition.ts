'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface UseSpeechRecognitionOptions {
  /** BCP-47 language tag. Defaults to 'de-DE'. */
  lang?: string;
  /** If true, recognition continues until explicitly stopped. */
  continuous?: boolean;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: (onResult: (transcript: string) => void) => void;
  stopListening: () => void;
}

export function useSpeechRecognition(
  options?: UseSpeechRecognitionOptions
): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const onResultRef = useRef<((transcript: string) => void) | null>(null);

  const lang = options?.lang ?? 'de-DE';
  const continuous = options?.continuous ?? false;

  const isSupported = typeof window !== 'undefined' && 
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback((onResult: (transcript: string) => void) => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.error('[SpeechRecognition] Not supported in this browser.');
      return;
    }

    stopListening();
    onResultRef.current = onResult;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResultRef.current?.(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('[SpeechRecognition] Error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setIsListening(true);

    try {
      recognition.start();
    } catch (e) {
      console.error('[SpeechRecognition] Failed to start:', e);
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [lang, continuous, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
    };
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}
