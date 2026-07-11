import { NextRequest } from 'next/server';
import { streamChat, ChatMessage } from '@/lib/gemini';
import { getCrmMetrics } from '@/actions/dashboard';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch live CRM Context
    const crmRes = await getCrmMetrics();
    let dynamicSystemPrompt = systemPrompt;
    
    if (crmRes.success && crmRes.data) {
      const data = crmRes.data;
      const contextString = `
AKTUELLER SYSTEM-KONTEXT (LIVE DATEN):
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
Erfinde keine Namen oder Zahlen. Beziehe dich strikt auf diesen Live-Kontext.
`;
      dynamicSystemPrompt = systemPrompt + '\n' + contextString;
    }

    const responseStream = await streamChat(messages as ChatMessage[], dynamicSystemPrompt);
    
    // Create a ReadableStream from the Gemini AsyncGenerator
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          console.error('Error while streaming:', err);
          controller.error(err);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
