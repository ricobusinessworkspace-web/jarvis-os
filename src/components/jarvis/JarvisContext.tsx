'use client';
import { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { speakText, extractSentences } from '@/lib/voice';
import { runAgent, type AgentMessage } from '@/lib/jarvis-agent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  isSpeaking: boolean;
  sendMessage: (text: string) => Promise<void>;
  toggleVoice: () => void;
  startListening: () => void;
  stopListening: () => void;
  clearMessages: () => void;
}

const JarvisContext = createContext<JarvisContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Use refs for values accessed inside the agent callbacks to avoid stale closures
  const isVoiceEnabledRef = useRef(isVoiceEnabled);
  isVoiceEnabledRef.current = isVoiceEnabled;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Abort controller for cancelling in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  // Speech recognition instance
  const recognitionRef = useRef<any>(null);

  // ----------------------------------------------------------------
  // Send Message → Client-Side Agent Loop → Streaming TTS
  // ----------------------------------------------------------------
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

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
      // Build conversation history for the agent
      const currentMessages = messagesRef.current;
      const agentMessages: AgentMessage[] = [...currentMessages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Sentence-by-sentence TTS state
      let sentenceBuffer = '';
      let ttsPromise: Promise<void> = Promise.resolve();
      let loadingCleared = false;

      await runAgent({
        messages: agentMessages,
        callbacks: {
          // ── Streaming text chunks ──
          onTextChunk: (chunk: string, accumulated: string) => {
            // Clear "thinking" state on first text chunk
            if (!loadingCleared) {
              setIsLoading(false);
              loadingCleared = true;
            }

            // Update displayed message
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: accumulated }
                : msg
            ));

            // Sentence-by-sentence TTS
            sentenceBuffer += chunk;
            const [completeSentences, remainder] = extractSentences(sentenceBuffer);
            sentenceBuffer = remainder;

            if (isVoiceEnabledRef.current && completeSentences.length > 0) {
              setIsSpeaking(true);
              for (const sentence of completeSentences) {
                const textToSpeak = sentence;
                ttsPromise = ttsPromise
                  .then(() => speakText(textToSpeak))
                  .catch(console.error);
              }
            }
          },

          // ── Tool calls (optional: could show UI feedback) ──
          onToolCall: (toolName: string) => {
            console.log(`[Jarvis] 🔧 Tool aufgerufen: ${toolName}`);
          },

          // ── Agent finished ──
          onComplete: (fullText: string) => {
            // Speak any remaining buffered text
            if (isVoiceEnabledRef.current && sentenceBuffer.trim().length > 0) {
              const textToSpeak = sentenceBuffer.trim();
              setIsSpeaking(true);
              ttsPromise = ttsPromise
                .then(() => speakText(textToSpeak))
                .catch(console.error);
            }

            // Wait for all TTS to finish
            ttsPromise
              .then(() => setIsSpeaking(false))
              .catch(() => setIsSpeaking(false));

            // Finalize message
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullText, isStreaming: false }
                : msg
            ));
          },

          // ── Error ──
          onError: (error: Error) => {
            console.error('[Jarvis] Agent error:', error);
          },
        },
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') return;

      console.error('[Jarvis] Failed to send message:', error);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: 'Entschuldigung, Sir. Es gab ein Kommunikationsproblem.', isStreaming: false }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies — we use refs for mutable values

  // ----------------------------------------------------------------
  // Auto Morning Briefing
  // ----------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Slight delay to ensure the UI is loaded before Jarvis starts talking
    const timer = setTimeout(() => {
      const today = new Date().toISOString().split('T')[0];
      const lastBriefing = localStorage.getItem('jarvis_last_briefing_date');
      
      if (lastBriefing !== today) {
        localStorage.setItem('jarvis_last_briefing_date', today);
        sendMessage("Guten Morgen Jarvis, bitte gib mir mein tägliches Morning Briefing.");
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [sendMessage]);

  // ----------------------------------------------------------------
  // Speech Recognition
  // ----------------------------------------------------------------
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('[Jarvis] Speech recognition not supported');
      return;
    }

    // Stop existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('[Jarvis] Speech recognition error:', event.error);
      setIsListening(false);
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
      console.error('[Jarvis] Failed to start speech recognition:', e);
      setIsListening(false);
    }
  }, [sendMessage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
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
      isSpeaking,
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
