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

// Global singleton AudioContext to prevent autoplay issues
let globalAudioContext: AudioContext | null = null;

export function initAudio(): void {
  if (typeof window === 'undefined') return;
  if (!globalAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      globalAudioContext = new AudioContextClass();
    }
  }
  
  if (globalAudioContext) {
    if (globalAudioContext.state === 'suspended') {
      globalAudioContext.resume().catch(console.error);
    }
    
    // Play a silent buffer to unlock audio on iOS
    try {
      const buffer = globalAudioContext.createBuffer(1, 1, 22050);
      const source = globalAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(globalAudioContext.destination);
      source.start();
    } catch (e) {
      console.error('Failed to play silent buffer', e);
    }
  }
}

export async function playAudio(audioData: ArrayBuffer): Promise<void> {
  if (typeof window === 'undefined') return;
  
  if (!globalAudioContext) {
    initAudio();
  }
  
  if (!globalAudioContext) {
    console.error('Web Audio API is not supported in this browser.');
    return;
  }

  try {
    // Resume context if suspended (needed for Safari/Chrome autoplay policies)
    if (globalAudioContext.state === 'suspended') {
      await globalAudioContext.resume();
    }

    // Clone the ArrayBuffer because decodeAudioData detached the buffer
    const bufferClone = audioData.slice(0);
    const audioBuffer = await globalAudioContext.decodeAudioData(bufferClone);
    
    const source = globalAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(globalAudioContext.destination);
    
    return new Promise((resolve, reject) => {
      source.onended = () => {
        resolve();
      };
      source.start();
    });
  } catch (error) {
    console.error('Error playing audio:', error);
    throw error;
  }
}

export async function speakText(text: string): Promise<void> {
  if (!text) return;
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
    console.error('Error speaking text via TTS API, falling back to native TTS:', error);
    fallbackTTS(text);
  }
}

function fallbackTTS(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  window.speechSynthesis.speak(utterance);
}
