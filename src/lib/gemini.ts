import { GoogleGenAI } from '@google/genai';
import { jarvisTools } from './jarvis-tools';

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const GEMINI_MODEL = 'gemini-3.5-flash';

export const SYSTEM_PROMPT = `
Du bist JARVIS (Just A Rather Very Intelligent System), der persönliche KI-Assistent von Rico.
Du hast nun vollen Zugriff auf Ricos System über "Function Calling Tools". Nutze sie proaktiv!

DEINE FÄHIGKEITEN & TOOLS:
1. CRM & Tasks: Nutze getCrmOverview und getTasks, wenn Rico nach seiner Arbeit fragt.
2. Accountability: Nutze getGProjectScore, um Ricos Accountability-Punkte abzufragen.
3. Web Recherche: Nutze googleSearch für aktuelles (Wetter, News, Feiertage).
4. Memory (WICHTIG!): Nutze updateMemory IMMER DANN, wenn Rico neue Interessen, Vorlieben oder private Fakten erwähnt (z.B. "Ich interessiere mich jetzt für KI Aktien"). Speichere diese proaktiv ab. Nutze readMemory, um sein Profil abzurufen.

PERSÖNLICHKEIT:
- Du sprichst Rico mit "Sir" an.
- Höflich, präzise, effizient — nie unnötig ausschweifend.
- Trockener, subtiler Humor (britischer Stil).
- Antworte auf Deutsch, außer Rico spricht dich auf Englisch an.
- Vermeide Floskeln, Entschuldigungen oder Erklärungen. Max 2-3 Sätze pro Antwort.
`;

// Default Gemini config with tools
export const GEMINI_CONFIG = {
  systemInstruction: SYSTEM_PROMPT,
  tools: [{ functionDeclarations: jarvisTools }, { googleSearch: {} }]
};

// ---------------------------------------------------------------------------
// callGeminiStream — Thin wrapper, NO retry logic (client handles retries)
// ---------------------------------------------------------------------------

/**
 * Calls Gemini with streaming and returns the raw async iterable.
 * No retry logic — the calling layer (client-side agent) handles retries.
 */
export async function callGeminiStream(contents: any[], config?: any) {
  return ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents,
    config: config || GEMINI_CONFIG
  });
}

// ---------------------------------------------------------------------------
// Gemini TTS — Unchanged
// ---------------------------------------------------------------------------

export async function generateTTS(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        systemInstruction: 'Speak in a calm, confident, and slightly formal male voice. Your tone should convey intelligence and subtle warmth — like a trusted advisor. Moderate pace, clear diction. German language.',
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Aoede", // Aoede or another suitable voice
            }
          }
        }
      }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const mimeType = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';
    
    if (!audioData) {
      throw new Error('No audio data received from Gemini');
    }

    return { audioData, mimeType };
  } catch (error) {
    console.error('Gemini TTS Error:', error);
    throw error;
  }
}
