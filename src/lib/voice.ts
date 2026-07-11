// ============================================================================
// Voice Engine — Audio Playback & TTS Client
// ============================================================================
// Handles audio context management, TTS API calls, and audio playback.
// Speech Recognition (STT) is in src/hooks/useSpeechRecognition.ts
// ============================================================================

// ---------------------------------------------------------------------------
// AudioContext Singleton
// ---------------------------------------------------------------------------
let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

export function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext is not available in SSR');
  }
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio API is not supported');
    audioCtx = new Ctor();
  }
  return audioCtx;
}

/**
 * Must be called from a user-gesture event handler to unlock audio on iOS/Safari.
 */
export function initAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(console.error);
    }
    // Play a silent buffer to unlock audio on iOS
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  } catch (e) {
    console.error('[VoiceEngine] Failed to init audio:', e);
  }
}

// ---------------------------------------------------------------------------
// Audio Playback
// ---------------------------------------------------------------------------

/**
 * Play raw audio data (ArrayBuffer) through the Web Audio API.
 * Returns a promise that resolves when playback finishes.
 */
export async function playAudio(audioData: ArrayBuffer): Promise<void> {
  if (typeof window === 'undefined') return;

  const ctx = getAudioContext();

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  // Clone buffer since decodeAudioData detaches the original
  const audioBuffer = await ctx.decodeAudioData(audioData.slice(0));

  // Stop any currently playing audio
  stopAudio();

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  currentSource = source;

  return new Promise<void>((resolve) => {
    source.onended = () => {
      if (currentSource === source) currentSource = null;
      resolve();
    };
    source.start();
  });
}

/**
 * Stop currently playing audio immediately.
 */
export function stopAudio(): void {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch { /* already stopped */ }
    currentSource = null;
  }
}

// ---------------------------------------------------------------------------
// TTS Client — Calls the /api/jarvis/tts route
// ---------------------------------------------------------------------------

export type TTSProvider = 'elevenlabs' | 'gemini';

export interface SpeakOptions {
  provider?: TTSProvider;
}

/**
 * Send text to the TTS API route and play the returned audio.
 * Falls back to native browser TTS if the API call fails entirely.
 */
export async function speakText(text: string, options?: SpeakOptions): Promise<void> {
  if (!text?.trim()) return;

  try {
    const params = options?.provider ? `?provider=${options.provider}` : '';
    const response = await fetch(`/api/jarvis/tts${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      console.error(`[VoiceEngine] TTS API error (${response.status}):`, errorBody);
      throw new Error(`TTS API returned ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('TTS API returned empty audio');
    }
    await playAudio(arrayBuffer);
  } catch (error) {
    console.warn('[VoiceEngine] TTS API failed, falling back to browser TTS:', error);
    fallbackBrowserTTS(text);
  }
}

// ---------------------------------------------------------------------------
// Browser TTS Fallback (SpeechSynthesis API)
// ---------------------------------------------------------------------------

export function fallbackBrowserTTS(text: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 1.0;
  utterance.pitch = 0.95;
  window.speechSynthesis.speak(utterance);
}

// ---------------------------------------------------------------------------
// Sentence Boundary Detection
// ---------------------------------------------------------------------------

// Common German abbreviations that should NOT trigger a sentence break
const ABBREVIATIONS = new Set([
  'z.b.', 'bzw.', 'nr.', 'dr.', 'hr.', 'fr.', 'prof.', 'ca.', 'etc.',
  'inkl.', 'exkl.', 'ggf.', 'evtl.', 'usw.', 'u.a.', 'o.ä.', 'd.h.',
  'str.', 'tel.', 'max.', 'min.', 'abs.', 'zzgl.', 'mwst.'
]);

/**
 * Splits accumulated text into complete sentences and a remainder.
 * Handles German abbreviations correctly to avoid false splits.
 *
 * @returns [completeSentences, remainder]
 */
export function extractSentences(text: string): [string[], string] {
  const sentences: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    current += text[i];

    if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
      // Check if this period is part of an abbreviation
      const lowerCurrent = current.toLowerCase().trimStart();
      const isAbbreviation = Array.from(ABBREVIATIONS).some(abbr =>
        lowerCurrent.endsWith(abbr)
      );

      if (!isAbbreviation) {
        // Check if next char is whitespace or end of text (sentence boundary)
        const nextChar = text[i + 1];
        if (!nextChar || nextChar === ' ' || nextChar === '\n') {
          const sentence = current.trim();
          if (sentence.length > 0) {
            sentences.push(sentence);
          }
          current = '';
        }
      }
    }
  }

  return [sentences, current];
}
