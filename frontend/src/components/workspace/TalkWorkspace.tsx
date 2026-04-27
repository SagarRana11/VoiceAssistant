import { useAppStore } from '../../store/useAppStore';
import { AvatarProvider } from '../../types';
import { ROLES } from '../../constants/roles';
import { Avatar } from '../Avatar/Avatar';
import { MicButton } from '../MicButton/MicButton';
import { SoundWave } from '../SoundWave/SoundWave';
import { useAssistantContext } from '../../context/AssistantContext';
import styles from './TalkWorkspace.module.css';

const PROVIDERS: { id: AvatarProvider; label: string }[] = [
  { id: 'heygen', label: 'HeyGen' },
  { id: 'did',    label: 'D-ID' },
  { id: 'none',   label: 'Animated' },
];

export function TalkWorkspace() {
  const { assistantState, currentRole, avatarProvider, setAvatarProvider } = useAppStore();
  const {
    interimTranscript,
    conversationState,
    isListening,
    isSpeaking,
    isSpeechSupported,
    currentChunk,
    startSession,
    stopSession,
    submitText,
    agentIsSpeaking,
    did,
  } = useAssistantContext();
  const role = ROLES[currentRole];
  const isThinking = assistantState === 'thinking';
  const isSessionActive = isListening || isThinking || isSpeaking;

  const statusLabel = isListening
    ? 'Listening...'
    : isThinking
      ? 'Thinking...'
      : isSpeaking || agentIsSpeaking
        ? 'Speaking...'
        : 'Ready to listen';

  return (
    <div className={styles.workspace}>
      {/* Role badge */}
      <div
        className={styles.roleBadge}
        style={{ '--role-color': role.color } as React.CSSProperties}
      >
        <span aria-hidden="true">{role.icon}</span>
        <span>{role.name}</span>
      </div>

      {/* Avatar */}
      <div className={styles.avatarWrap}>
        <Avatar
          state={assistantState}
          roleColor={role.color}
          currentChunk={currentChunk}
          conversationState={conversationState}
          didVideoRef={did.videoRef}
          didConnected={did.isConnected}
        />
      </div>

      {/* Sound wave */}
      <SoundWave isActive={isSpeaking || agentIsSpeaking} color={role.color} barCount={14} />

      {/* Interim transcript banner */}
      {interimTranscript && (
        <div className={styles.interimBanner} role="status" aria-live="polite">
          <span className={styles.interimDot} aria-hidden="true" />
          &ldquo;{interimTranscript}&rdquo;
        </div>
      )}

      {/* Avatar provider switcher */}
      <div className={styles.providerToggle}>
        {PROVIDERS.map(({ id, label }) => (
          <button
            key={id}
            className={`${styles.providerBtn} ${avatarProvider === id ? styles.providerBtnActive : ''}`}
            onClick={() => setAvatarProvider(id)}
            aria-pressed={avatarProvider === id}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Status label */}
      <p className={styles.statusLabel} aria-live="polite">
        {statusLabel}
      </p>

      {/* Controls */}
      <div className={styles.controls}>
        <MicButton
          isListening={isListening}
          isSpeaking={isSpeaking}
          isThinking={isThinking}
          isSupported={isSpeechSupported}
          roleColor={role.color}
          onClick={() => (isListening ? stopSession() : startSession())}
        />

        {isSessionActive && (
          <button className={styles.stopBtn} onClick={stopSession} aria-label="Stop session">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="3" y="3" width="18" height="18" rx="3" />
            </svg>
            Stop
          </button>
        )}
      </div>

      {/* Speech not supported notice */}
      {!isSpeechSupported && (
        <div className={styles.noticeBox} role="alert">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>
            Speech recognition requires Chrome or Edge.{' '}
            <button
              className={styles.typeLink}
              onClick={() => {
                const text = prompt('Type your message:');
                if (text?.trim()) submitText(text);
              }}
            >
              Type instead
            </button>
          </span>
        </div>
      )}

      <p className={styles.roleTone}>{role.tone}</p>
    </div>
  );
}
