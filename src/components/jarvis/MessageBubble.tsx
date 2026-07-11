'use client';
import { motion } from 'framer-motion';
import { Message } from './JarvisContext';
import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const timeString = message.timestamp.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm relative group',
        isUser 
          ? 'bg-accent/15 text-foreground rounded-br-none border border-accent/20' 
          : 'bg-overlay/60 backdrop-blur-md border border-border/50 text-foreground rounded-bl-none'
      )}>
        {!isUser && (
          <div className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface border border-border shadow-sm">
            <Bot size={12} className="text-accent" />
          </div>
        )}
        
        <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && (
            <motion.span 
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="inline-block w-1.5 h-3.5 bg-accent ml-1 align-middle"
            />
          )}
        </div>
        
        <div className={cn(
          'text-[9px] mt-1.5 font-medium',
          isUser ? 'text-accent/60 text-right' : 'text-muted/60 text-left'
        )}>
          {timeString}
        </div>
      </div>
    </motion.div>
  );
}
