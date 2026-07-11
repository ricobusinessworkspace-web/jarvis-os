'use client';
import { useState, useRef, useEffect } from 'react';
import { useJarvis } from './JarvisContext';
import MessageBubble from './MessageBubble';
import VoiceButton from './VoiceButton';
import { ArrowUp, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initAudio } from '@/lib/voice';

export default function JarvisChat() {
  const { messages, isLoading, isVoiceEnabled, toggleVoice, sendMessage } = useJarvis();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    initAudio(); // Unlock audio context on user interaction
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden rounded-xl border border-border shadow-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-surface/50 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-semibold tracking-wider text-muted uppercase">Jarvis AI</span>
        </div>
        <button 
          onClick={toggleVoice}
          className="text-muted hover:text-accent transition-colors"
          title={isVoiceEnabled ? 'Voice Output: On' : 'Voice Output: Off'}
        >
          {isVoiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center text-center space-y-3"
            >
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-2">
                <Volume2 size={24} />
              </div>
              <h3 className="text-lg font-medium text-foreground">Guten Tag, Sir.</h3>
              <p className="text-sm text-muted max-w-[250px]">
                Ich bin bereit. Wie kann ich Ihnen heute behilflich sein?
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-surface/80 backdrop-blur-md border-t border-border/50">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 relative">
          <VoiceButton />
          
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nachricht eingeben..."
              className="w-full bg-background border border-border rounded-2xl py-3 pl-4 pr-12 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 resize-none max-h-32 min-h-[44px]"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 h-8 w-8 flex items-center justify-center rounded-full bg-accent text-background disabled:opacity-50 disabled:bg-surface disabled:text-muted transition-colors"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}
