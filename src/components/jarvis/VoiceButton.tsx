'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initAudio, startListening, stopListening } from '@/lib/voice';
import { useJarvis } from './JarvisContext';

export default function VoiceButton() {
  const { isListening, startListening, stopListening } = useJarvis();

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const toggleListening = () => {
    initAudio(); // Unlock audio context on user interaction
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Ripple effect when listening */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.5, 2] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-accent/20"
          />
        )}
      </AnimatePresence>

      <button
        onClick={toggleListening}
        className={cn(
          "relative z-10 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
          isListening 
            ? "bg-accent text-background shadow-lg shadow-accent/40" 
            : "bg-surface border border-border text-muted hover:text-accent hover:border-accent/40"
        )}
      >
        <Mic size={18} className={cn(isListening && "animate-pulse")} />
      </button>
    </div>
  );
}
