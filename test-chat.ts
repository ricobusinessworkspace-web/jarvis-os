import { streamChat } from './src/lib/gemini.ts';

async function testChat() {
  try {
    const messages = [
      { role: 'user', content: 'Guten Morgen Jarvis, bitte gib mir mein tägliches Morning Briefing.' }
    ];
    
    console.log('Sending message to streamChat...');
    // We cast messages because ChatMessage type is defined in gemini.ts
    const stream = await streamChat(messages as any);
    
    for await (const chunk of stream) {
      console.log('Chunk:', chunk.text);
    }
  } catch (error) {
    console.error('Error occurred:', error);
  }
}

testChat();
