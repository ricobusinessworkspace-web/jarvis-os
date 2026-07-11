'use client';
import { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { speakText, extractSentences } from '@/lib/voice';
import { getCrmMetrics } from '@/actions/dashboard';

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
// System Prompt Builder
// ---------------------------------------------------------------------------

const BASE_SYSTEM_PROMPT = "Du bist Jarvis, der persönliche KI-Assistent von Rico. Antworte stets präzise, professionell und auf Deutsch. WICHTIG: Halte deine Antworten extrem kurz und prägnant (maximal 1-2 kurze Sätze), um Zeichen zu sparen.";

async function buildSystemPrompt(): Promise<string> {
  let systemPrompt = BASE_SYSTEM_PROMPT;

  try {
    const crmRes = await getCrmMetrics();
    if (crmRes.success && crmRes.data) {
      const data = crmRes.data;
      systemPrompt += `\n\nAKTUELLER SYSTEM-KONTEXT (LIVE DATEN):
Du hast Zugriff auf Ricos CRM-Daten. Hier sind die aktuellen Metriken:
- Heutige Anrufe: ${data.todayCalls}
- Anrufe (letzte 7 Tage): ${data.weeklyCalls}
- Sales Pipeline:
  - Entscheider: ${data.pipeline.entscheider} Leads
  - Kontakt: ${data.pipeline.kontakt} Leads
  - Rechnung: ${data.pipeline.rechnung} Leads
  - Bestandskunden: ${data.pipeline.kunden} Leads
- Priorisierte Leads: ${data.prioLeads} Stück

Nutze dieses Wissen proaktiv, wenn Rico nach seiner Pipeline, seinen Leads oder seiner Performance fragt.
Erfinde keine Namen oder Zahlen. Beziehe dich strikt auf diesen Live-Kontext.`;
    }
  } catch (err) {
    console.error('[Jarvis] Failed to fetch CRM metrics for context:', err);
  }

  return systemPrompt;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function JarvisProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Use refs for values accessed inside the streaming loop to avoid stale closures
  const isVoiceEnabledRef = useRef(isVoiceEnabled);
  isVoiceEnabledRef.current = isVoiceEnabled;

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Speech recognition instance
  const recognitionRef = useRef<any>(null);

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
      // Build system prompt with live CRM data
      const systemPrompt = await buildSystemPrompt();

      // Use the ref to get the latest messages (avoids stale closure)
      const currentMessages = messagesRef.current;

      const response = await fetch('/api/jarvis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...currentMessages, userMessage].map(m => ({ role: m.role, content: m.content })),
          systemPrompt,
        }),
      });

      if (!response.ok) throw new Error('Chat API failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();
      let fullContent = '';
      let pendingText = '';

      // Sequential TTS playback queue
      let ttsPromise: Promise<void> = Promise.resolve();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Speak any remaining text
          if (isVoiceEnabledRef.current && pendingText.trim().length > 0) {
            const textToSpeak = pendingText.trim();
            setIsSpeaking(true);
            ttsPromise = ttsPromise
              .then(() => speakText(textToSpeak))
              .catch(console.error);
          }
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        pendingText += chunk;

        // Use the improved sentence boundary detection
        const [completeSentences, remainder] = extractSentences(pendingText);
        pendingText = remainder;

        // Queue each complete sentence for TTS
        if (isVoiceEnabledRef.current && completeSentences.length > 0) {
          setIsSpeaking(true);
          for (const sentence of completeSentences) {
            const textToSpeak = sentence;
            ttsPromise = ttsPromise
              .then(() => speakText(textToSpeak))
              .catch(console.error);
          }
        }

        // Update the displayed message content
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: fullContent }
            : msg
        ));
      }

      // Wait for all TTS to finish, then clear speaking state
      ttsPromise.then(() => setIsSpeaking(false)).catch(() => setIsSpeaking(false));

      // Mark message as done streaming
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, isStreaming: false }
          : msg
      ));

    } catch (error) {
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
