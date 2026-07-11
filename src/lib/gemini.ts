import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `
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

MORNING BRIEFING:
Wenn Rico dich nach dem "Morning Briefing" fragt, gehst du wie folgt vor:
1. Rufe das Memory ab (readMemory) für seine Interessen.
2. Recherchiere via googleSearch nach aktuellen News zu seinen Interessen und dem Wetter.
3. Hole die CRM-Daten und den G-Project Score.
4. Fasse alles in einem kompakten, flüssigen "Guten Morgen, Sir"-Monolog zusammen. Keine endlosen Listen, sondern prägnant.
`;

import { jarvisTools } from './jarvis-tools';
import { executeJarvisTool } from './jarvis-tool-executor';

// Retry logic wrapper
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1) throw err;
      if (err?.status === 429 || err?.status >= 500) {
        console.warn(`[Gemini] Error ${err.status}, retrying in ${Math.pow(2, i)}s...`);
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Unreachable');
}

export async function streamChat(messages: ChatMessage[], systemPrompt: string = SYSTEM_PROMPT) {
  // Only keep the last 10 messages to save context limit (rate limits)
  const recentMessages = messages.slice(-10);

  const contents: any[] = recentMessages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  try {
    const config: any = {
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: jarvisTools }, { googleSearch: {} }]
    };

    let responseStream = await fetchWithRetry(() => ai.models.generateContentStream({
      model: 'gemini-3.5-flash',
      contents,
      config
    }));

    // Read first chunk to see if it's a tool call
    const firstChunk = await responseStream.next();
    
    if (!firstChunk.done) {
      const calls = firstChunk.value.functionCalls;
      if (calls && calls.length > 0) {
        console.log(`[Gemini] Function calls detected:`, calls.map(c => c.name));
        
        // Execute all requested tools in parallel
        const functionResponses = await Promise.all(
          calls.map(async (call) => {
            const result = await executeJarvisTool(call);
            return { name: call.name, response: { result } };
          })
        );

        // Append the model's call and the results to the conversation
        contents.push({ role: 'model', parts: calls.map(c => ({ functionCall: c })) });
        contents.push({ role: 'user', parts: functionResponses.map(r => ({ functionResponse: r })) });

        // Call again for the final text response
        const finalStream = await fetchWithRetry(() => ai.models.generateContentStream({
          model: 'gemini-3.5-flash',
          contents,
          config
        }));
        
        return finalStream;
      } else {
        // No function call, yield the first chunk and then the rest of the stream
        async function* combined() {
          yield firstChunk.value;
          yield* responseStream;
        }
        return combined();
      }
    }
    
    return responseStream;
  } catch (error) {
    console.error('Gemini Chat Error:', error);
    throw error;
  }
}

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
