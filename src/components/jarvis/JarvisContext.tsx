'use client';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { startListening as startVoiceListening, stopListening as stopVoiceListening, speakText } from '@/lib/voice';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface JarvisContextType {
  messages: Message[];
  isLoading: boolean;
  isListening: boolean;
  isVoiceEnabled: boolean;
  sendMessage: (text: string) => Promise<void>;
  toggleVoice: () => void;
  startListening: () => void;
  stopListening: () => void;
  clearMessages: () => void;
}

const JarvisContext = createContext<JarvisContextType | undefined>(undefined);

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    const assistantMessageId = uuidv4();
    setMessages(prev => [
      ...prev,
      { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date(), isStreaming: true }
    ]);

    try {
      // Send the request
      const response = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Pass the previous messages for context
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error('Chat API failed');
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: fullContent } 
            : msg
        ));
      }

      // Mark as done streaming
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, isStreaming: false } 
          : msg
      ));

      // Speak if enabled
      if (isVoiceEnabled) {
        speakText(fullContent).catch(console.error);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { ...msg, content: 'Entschuldigung, Sir. Es gab ein Kommunikationsproblem.', isStreaming: false } 
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [messages, isVoiceEnabled]);

  const startListening = useCallback(() => {
    setIsListening(true);
    startVoiceListening(
      (transcript) => {
        sendMessage(transcript);
        setIsListening(false);
      },
      () => {
        setIsListening(false);
      }
    );
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    stopVoiceListening();
    setIsListening(false);
  }, []);

  const toggleVoice = useCallback(() => setIsVoiceEnabled(v => !v), []);
  const clearMessages = useCallback(() => setMessages([]), []);

  return (
    <JarvisContext.Provider value={{
      messages,
      isLoading,
      isListening,
      isVoiceEnabled,
      sendMessage,
      toggleVoice,
      startListening,
      stopListening,
      clearMessages
    }}>
      {children}
    </JarvisContext.Provider>
  );
}

export function useJarvis() {
  const context = useContext(JarvisContext);
  if (context === undefined) {
    throw new Error('useJarvis must be used within a JarvisProvider');
  }
  return context;
}
