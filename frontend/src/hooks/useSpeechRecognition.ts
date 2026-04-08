import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  onFinalResult: (transcript: string) => void;
  onInterimResult?: (transcript: string) => void;
  onError?: (code: string) => void;
}

interface Return {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
}

/**
 * Wraps the browser Web Speech API (SpeechRecognition).
 * Keeps callback refs in sync so callers never deal with stale closures.
 */
export function useSpeechRecognition({
  onFinalResult,
  onInterimResult,
  onError,
}: Options): Return {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);

  // Live callback refs — updated every render, never trigger re-init
  const finalRef = useRef(onFinalResult);
  const interimRef = useRef(onInterimResult);
  const errorRef = useRef(onError);
  useEffect(() => { finalRef.current = onFinalResult; });
  useEffect(() => { interimRef.current = onInterimResult; });
  useEffect(() => { errorRef.current = onError; });

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onerror = (e) => {
      isListeningRef.current = false;
      setIsListening(false);
      // 'no-speech' is not a real error — user just paused
      if (e.error !== 'no-speech') {
        errorRef.current?.(e.error);
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (interim) interimRef.current?.(interim);
      if (final) finalRef.current(final.trim());
    };

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Speech recognition failed to start:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListeningRef.current) return;
    recognitionRef.current.stop();
  }, []);

  return { isListening, isSupported, startListening, stopListening };
}
