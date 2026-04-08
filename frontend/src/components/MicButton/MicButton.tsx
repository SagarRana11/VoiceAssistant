import styles from './MicButton.module.css';

interface Props {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  isSupported: boolean;
  roleColor: string;
  onClick: () => void;
}

export function MicButton({
  isListening,
  isSpeaking,
  isThinking,
  isSupported,
  roleColor,
  onClick,
}: Props) {
  const isDisabled = isSpeaking || isThinking || !isSupported;

  const label = isListening
    ? 'Stop listening'
    : isSpeaking
    ? 'Speaking...'
    : isThinking
    ? 'Thinking...'
    : 'Talk With Me';

  return (
    <div className={styles.wrapper}>
      {/* Pulse rings — visible when listening */}
      {isListening && (
        <>
          <span
            className={styles.pulseRing}
            style={{ '--color': roleColor, '--delay': '0s' } as React.CSSProperties}
          />
          <span
            className={styles.pulseRing}
            style={{ '--color': roleColor, '--delay': '0.4s' } as React.CSSProperties}
          />
          <span
            className={styles.pulseRing}
            style={{ '--color': roleColor, '--delay': '0.8s' } as React.CSSProperties}
          />
        </>
      )}

      <button
        className={`${styles.button} ${isListening ? styles.listening : ''} ${isDisabled ? styles.disabled : ''}`}
        style={{ '--role-color': roleColor } as React.CSSProperties}
        onClick={onClick}
        disabled={isDisabled && !isListening}
        aria-label={label}
        title={!isSupported ? 'Speech recognition not supported in this browser' : label}
      >
        {/* Mic icon SVG */}
        <MicIcon isListening={isListening} isSpeaking={isSpeaking} isThinking={isThinking} />
        <span className={styles.label}>{label}</span>
      </button>
    </div>
  );
}

function MicIcon({
  isListening,
  isSpeaking,
  isThinking,
}: {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
}) {
  if (isSpeaking) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    );
  }

  if (isThinking) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
    );
  }

  if (isListening) {
    // Stop square icon when listening
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}
