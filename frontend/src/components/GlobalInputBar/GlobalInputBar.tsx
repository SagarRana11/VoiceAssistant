import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import styles from './GlobalInputBar.module.css';

interface Props {
  onSubmit: (message: string, mode: 'voice' | 'text') => void;
}

const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

const StopIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

export const GlobalInputBar: React.FC<Props> = ({ onSubmit }) => {
  const [text, setText]       = useState('');
  const [listening, setListening] = useState(false);
  const inputRef        = useRef<HTMLInputElement>(null);
  const recognitionRef  = useRef<SpeechRecognition | null>(null);
  const assistantState  = useAppStore(s => s.assistantState);
  const voiceEnabled    = useAppStore(s => s.voiceEnabled);
  const isSpeaking      = assistantState === 'speaking';
  const isThinking      = assistantState === 'thinking';
  const locked          = isSpeaking || isThinking;

  // ── Speech recognition setup ────────────────────────────────────────────────
  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;
    // Mirror the pattern used by useSpeechRecognition.ts
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new (SpeechRecognitionAPI as any)();
    r.continuous      = false;
    r.interimResults  = true;
    r.lang            = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      if (interim) setText(interim);
      if (final) {
        setText('');
        setListening(false);
        if (final.trim()) onSubmit(final.trim(), 'voice');
      }
    };

    r.onend  = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => {
      if (e.error !== 'no-speech') setListening(false);
    };

    recognitionRef.current = r;
    return () => r.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || locked) return;
    setText('');
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch { /* already started */ }
  }, [locked]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const handleMicClick = useCallback(() => {
    if (locked) return;
    listening ? stopListening() : startListening();
  }, [locked, listening, startListening, stopListening]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || locked) return;
    onSubmit(trimmed, 'text');
    setText('');
    inputRef.current?.focus();
  }, [text, locked, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const barClass = [
    styles.bar,
    listening ? styles.listening : '',
    locked    ? styles.locked    : '',
  ].filter(Boolean).join(' ');

  const micClass = [
    styles.micBtn,
    listening ? styles.micActive   : '',
    locked    ? styles.micDisabled : '',
  ].filter(Boolean).join(' ');

  const placeholder = locked
    ? isSpeaking ? 'Assistant is responding...' : 'Thinking...'
    : listening
    ? 'Listening...'
    : voiceEnabled
    ? 'Ask me anything — workout plan, health questions, profile updates...'
    : 'Chat mode — type your message here...';

  return (
    <div className={barClass} role="search" aria-label="Health agent input">

      {/* Listening animation */}
      {listening && (
        <div className={styles.wave} aria-hidden="true">
          <span className={styles.waveBar} />
          <span className={styles.waveBar} />
          <span className={styles.waveBar} />
          <span className={styles.waveBar} />
          <span className={styles.waveBar} />
        </div>
      )}

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className={styles.speakingPill} aria-live="polite">
          <span className={styles.speakingDot} />
          Speaking
        </div>
      )}

      {/* Mic button — only show when voice is enabled and not speaking */}
      {voiceEnabled && !isSpeaking && isSupported && (
        <button
          className={micClass}
          onClick={handleMicClick}
          aria-label={listening ? 'Stop listening' : 'Start voice input'}
          title={locked ? 'Wait for assistant' : listening ? 'Stop' : 'Speak'}
        >
          {listening ? <StopIcon /> : <MicIcon />}
        </button>
      )}

      {/* Text input */}
      <input
        ref={inputRef}
        className={styles.input}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={locked || listening}
        aria-label="Message input"
        autoComplete="off"
      />

      {/* Send button */}
      <button
        className={styles.sendBtn}
        onClick={handleSend}
        disabled={!text.trim() || locked}
        aria-label="Send message"
      >
        <SendIcon />
      </button>
    </div>
  );
};
