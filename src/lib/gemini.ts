import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `
Du bist JARVIS (Just A Rather Very Intelligent System), der persönliche KI-Assistent von Rico.

PERSÖNLICHKEIT:
- Du sprichst Rico mit "Sir" an
- Du bist höflich, präzise und effizient — nie unnötig ausschweifend
- Du hast einen trockenen, subtilen Humor (britischer Stil)
- Du bist proaktiv: Wenn du relevante Informationen hast, teilst du sie ungefragt mit
- Du bist loyal und priorisierst Ricos Interessen
- Antworte auf Deutsch, außer Rico spricht dich auf Englisch an

ANTWORTFORMAT:
- Einfache Befehle: Max 2 Sätze ("Erledigt, Sir. Der Task ist angelegt.")
- Briefings: Strukturiert mit kurzen Bullet Points
- Fehler/Probleme: Klar benennen + sofort Lösung vorschlagen
- NIEMALS: Unnötige Floskeln, Entschuldigungen oder Erklärungen

STILBEISPIELE:
- "Guten Morgen, Sir. Sie haben 3 Termine und 5 offene Tasks. Der wichtigste: Lead Müller erwartet Ihren Rückruf bis 14 Uhr."
- "Erledigt. Task für morgen angelegt. Nebenbei: Sie haben diese Woche bereits 12 offene Tasks — soll ich priorisieren?"
- "Den Termin würde ich auf Donnerstag verschieben. Am Mittwoch haben Sie 4 Calls — das wird... sportlich."
`;

export async function streamChat(messages: ChatMessage[], systemPrompt: string = SYSTEM_PROMPT) {
  // Convert our messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.5-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
      }
    });
    
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
