import { createContext, MutableRefObject, useContext } from 'react';

/**
 * Shared context for all hook-derived conversation/agent state.
 * Provided by AssistantPage, consumed by workspaces and panels.
 */
export interface AssistantContextValue {
  // ── useConversation ──────────────────────────────────────────────────────
  interimTranscript: string;
  streamingResponse: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationState: any;
  isListening: boolean;
  isSpeaking: boolean;
  isSpeechSupported: boolean;
  currentChunk: string;
  startSession: () => void;
  stopSession: () => void;
  submitText: (text: string) => void;

  // ── useAgentConversation ─────────────────────────────────────────────────
  agentStreamingResponse: string;
  agentIsSpeaking: boolean;
  handleGlobalSubmit: (message: string, mode: 'voice' | 'text') => Promise<void>;

  // ── useAssessment ────────────────────────────────────────────────────────
  assessment: {
    isActive: boolean;
    startAssessment: () => void;
    [key: string]: unknown;
  };

  // ── useDIDStream ─────────────────────────────────────────────────────────
  did: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    videoRef: MutableRefObject<any>;
    isConnected: boolean;
  };
}

export const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistantContext(): AssistantContextValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistantContext must be used inside AssistantContext.Provider');
  return ctx;
}
