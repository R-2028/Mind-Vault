/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSpeechRecognitionOptions {
  onFinalResult?: (finalText: string) => void;
  lang?: string;
  continuous?: boolean;
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  isSupported: boolean;
}

export function useSpeechRecognition({
  onFinalResult,
  lang = 'en-US',
  continuous = true,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const onFinalResultRef = useRef(onFinalResult);

  // Keep latest callback ref to prevent stale closures
  useEffect(() => {
    onFinalResultRef.current = onFinalResult;
  }, [onFinalResult]);

  const isSupported =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Ignore errors when already stopped
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setInterimTranscript('');

    if (!isSupported) {
      setError('Speech Recognition is not supported by your browser.');
      return;
    }

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    // Clean up previous instance if any
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalChunk = '';
      let interimChunk = '';

      // CRITICAL FIX: Iterate strictly from event.resultIndex to avoid duplicate iterations
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          finalChunk += (finalChunk ? ' ' : '') + text;
        } else {
          interimChunk += (interimChunk ? ' ' : '') + text;
        }
      }

      // If final transcript is present, commit permanently and clear interim buffer
      if (finalChunk.trim()) {
        if (onFinalResultRef.current) {
          onFinalResultRef.current(finalChunk.trim());
        }
        setInterimTranscript('');
      } else {
        // Keep interim text in separate temporary state
        setInterimTranscript(interimChunk.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('[useSpeechRecognition] Error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone permission was denied. Please allow microphone access.');
      } else if (event.error === 'no-speech') {
        // Normal timeout on silence - do not error out permanently
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err: any) {
      console.warn('Failed to start SpeechRecognition:', err);
      setError(err?.message || 'Failed to start microphone');
      setIsListening(false);
    }
  }, [continuous, isSupported, lang]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    interimTranscript,
    error,
    startListening,
    stopListening,
    toggleListening,
    isSupported,
  };
}
