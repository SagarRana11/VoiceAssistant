import { useCallback, useEffect, useRef, useState } from 'react';

interface Return {
  isSpeaking: boolean;
  isSupported: boolean;
  speak: (text: string, onEnd?: () => void) => void;
  cancel: () => void;
}

/**
 * Wraps the browser SpeechSynthesis API for text-to-speech.
 * Automatically selects the best available voice.
 */
export function useSpeechSynthesis(): Return {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load best voice once voices are available
  useEffect(() => {
    if (!isSupported) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Preference order: Samantha (macOS), Google US English, any en-US local
      const preferred = voices.find(
        (v) =>
          v.name === 'Samantha' ||
          v.name === 'Alex' ||
          v.name.includes('Google US English') ||
          v.name.includes('Microsoft Aria')
      );
      const fallback = voices.find(
        (v) => v.lang === 'en-US' && v.localService
      );
      voiceRef.current = preferred ?? fallback ?? voices[0] ?? null;
    };

    pickVoice();
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', pickVoice);
    };
  }, [isSupported]);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!isSupported || !text.trim()) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (voiceRef.current) {
        utterance.voice = voiceRef.current;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { isSpeaking, isSupported, speak, cancel };
}
