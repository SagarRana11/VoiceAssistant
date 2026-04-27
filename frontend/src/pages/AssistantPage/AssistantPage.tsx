import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useConversation } from '../../hooks/useConversation';
import { useAgentConversation } from '../../hooks/useAgentConversation';
import { useDIDStream } from '../../hooks/useDIDStream';
import { useHeyGenStream } from '../../hooks/useHeyGenStream';
import { useAssessment } from '../../hooks/useAssessment';
import { AssistantContext } from '../../context/AssistantContext';
import { AppLayout } from '../../components/AppLayout/AppLayout';
import styles from './AssistantPage.module.css';

export function AssistantPage() {
  const { error, setError, avatarProvider } = useAppStore();

  // ── Avatar streaming (D-ID or HeyGen, selected by avatarProvider) ─────
  const did    = useDIDStream();
  const heygen = useHeyGenStream();
  const avatar = avatarProvider === 'heygen' ? heygen
               : avatarProvider === 'did'    ? did
               : null;

  useEffect(() => {
    if (!avatar) return;
    avatar.connect();
    return () => avatar.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarProvider]);

  // ── Standard role-based conversation ──────────────────────────────────
  const {
    interimTranscript,
    streamingResponse,
    conversationState,
    isListening,
    isSpeaking,
    isSpeechSupported,
    currentChunk,
    startSession,
    stopSession,
    submitText,
  } = useConversation({
    externalSpeak:    avatar?.isConnected ? avatar.speak    : undefined,
    isExternalActive: avatar?.isConnected ?? false,
  });

  // ── Agent conversation (health intents → plans) ────────────────────────
  const agent = useAgentConversation();

  // ── Well-Being Assessment ──────────────────────────────────────────────
  const assessment = useAssessment();

  /**
   * Global input bar handler — routes to agent (plan generation / health Q&A).
   * If a standard session is active, stop it first.
   */
  const handleGlobalSubmit = async (message: string, mode: 'voice' | 'text') => {
    if (isListening) stopSession();
    await agent.submitMessage(message, mode);
  };

  // ── Context value ──────────────────────────────────────────────────────
  const ctxValue = useMemo(() => ({
    interimTranscript,
    streamingResponse,
    conversationState,
    isListening,
    isSpeaking,
    isSpeechSupported,
    currentChunk,
    startSession,
    stopSession,
    submitText,
    agentStreamingResponse: agent.streamingResponse,
    agentIsSpeaking: agent.isSpeaking,
    handleGlobalSubmit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assessment: assessment as any,
    did: avatar ?? did,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    interimTranscript, streamingResponse, conversationState,
    isListening, isSpeaking, isSpeechSupported, currentChunk,
    agent.streamingResponse, agent.isSpeaking,
    assessment, avatar,
  ]);

  return (
    <AssistantContext.Provider value={ctxValue}>
      <div className={styles.page}>
        <AppLayout
          streamingResponse={streamingResponse}
          agentStreamingResponse={agent.streamingResponse}
          interimTranscript={interimTranscript}
          onGlobalSubmit={handleGlobalSubmit}
          collectAllFields={agent.collectAllFields}
          onSubmitBulkFields={agent.submitBulkFields}
          isAgentThinking={agent.isThinking}
        />

        {/* ── Error toast ─────────────────────────────────────────────── */}
        {error && (
          <div className={styles.errorToast} role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
            <button className={styles.toastClose} onClick={() => setError(null)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        )}
      </div>
    </AssistantContext.Provider>
  );
}
