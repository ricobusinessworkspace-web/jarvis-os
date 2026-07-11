// Extend window interface to include speech recognition types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

let recognition: any = null;

export function startListening(onResult: (text: string) => void, onEnd: () => void): void {
  if (typeof window === 'undefined') return;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.error('Speech recognition is not supported in this browser.');
    onEnd();
    return;
  }

  if (recognition) {
    recognition.stop();
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'de-DE';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error:', event.error);
    onEnd();
  };

  recognition.onend = () => {
    onEnd();
    recognition = null;
  };

  try {
    recognition.start();
  } catch (e) {
    console.error('Failed to start speech recognition:', e);
    onEnd();
  }
}

export function stopListening(): void {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}

// Convert Base64 string to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function playAudio(audioData: ArrayBuffer): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) {
    console.error('Web Audio API is not supported in this browser.');
    return;
  }

  const audioContext = new AudioContext();
  
  try {
    const audioBuffer = await audioContext.decodeAudioData(audioData);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    return new Promise((resolve) => {
      source.onended = () => {
        resolve();
      };
      source.start();
    });
  } catch (error) {
    console.error('Error playing audio:', error);
  }
}

export async function speakText(text: string): Promise<void> {
  try {
    const response = await fetch('/api/jarvis/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate speech');
    }

    const arrayBuffer = await response.arrayBuffer();
    await playAudio(arrayBuffer);
  } catch (error) {
    console.error('Error speaking text:', error);
  }
}
