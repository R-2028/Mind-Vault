/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Speech Recognition & Speech Synthesis Web APIs Wrapper

export interface SpeechRecognitionResultState {
  finalTranscript: string;
  interimTranscript: string;
  isFinal: boolean;
}

export class VoiceDictationService {
  private recognition: any = null;
  private isListening = false;
  private onResultCallback?: (result: SpeechRecognitionResultState) => void;
  private onErrorCallback?: (error: string) => void;
  private onEndCallback?: () => void;

  constructor() {
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        // Iterate strictly from event.resultIndex to event.results.length to avoid duplicate loops
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const resultItem = event.results[i];
          const transcriptChunk = resultItem[0]?.transcript || '';
          if (resultItem.isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        if (this.onResultCallback) {
          this.onResultCallback({
            finalTranscript: finalTranscript.trim(),
            interimTranscript: interimTranscript.trim(),
            isFinal: finalTranscript.length > 0,
          });
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          this.onErrorCallback?.('Microphone access was denied. Please allow microphone permissions.');
        } else if (event.error === 'no-speech') {
          // Normal timeout if user was quiet
        } else {
          this.onErrorCallback?.(`Speech recognition error: ${event.error}`);
        }
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.onEndCallback?.();
      };
    }
  }

  public isSupported(): boolean {
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  public start(
    onResult: (result: SpeechRecognitionResultState) => void,
    onError: (error: string) => void,
    onEnd: () => void
  ): boolean {
    if (!this.recognition) {
      onError('Speech Recognition is not supported by your browser.');
      return false;
    }

    if (this.isListening) {
      this.stop();
      return false;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.onEndCallback = onEnd;

    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err: any) {
      console.warn('Failed to start speech recognition:', err);
      onError(err?.message || 'Failed to start microphone');
      this.isListening = false;
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        // ignore
      }
      this.isListening = false;
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

/**
 * Text-to-Speech playback using window.speechSynthesis
 */
export class TextToSpeechService {
  private isSpeaking = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      volume?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: any) => void;
    }
  ): void {
    if (!this.isSupported()) {
      options?.onError?.('Speech Synthesis is not supported in this browser.');
      return;
    }

    // Cancel ongoing audio speech
    this.cancel();

    if (!text || text.trim().length === 0) return;

    // Filter emojis and symbols for cleaner reading
    const cleanText = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    // Select natural sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))) ||
      voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      options?.onStart?.();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        options?.onError?.(e);
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public pause(): void {
    if (this.isSupported() && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
    }
  }

  public resume(): void {
    if (this.isSupported() && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }

  public cancel(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSupported() && window.speechSynthesis.speaking;
  }
}

export const voiceDictation = new VoiceDictationService();
export const textToSpeech = new TextToSpeechService();
