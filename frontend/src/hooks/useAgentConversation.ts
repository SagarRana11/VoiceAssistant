import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useProfileStore } from '../store/profileStore';
import { usePlannerStore, ExercisePlan } from '../store/plannerStore';
import { useMeditationStore, MeditationPlan } from '../store/meditationStore';
import { useDietStore, DietPlan } from '../store/dietStore';
import { saveProfileField } from '../services/profileService';
import { streamAgentMessage, AgentAction } from '../services/agentService';
import { useSpeechQueue } from './useSpeechQueue';
import {
  ConversationState,
  DEFAULT_STATE,
} from '../utils/emotionDetector';

// Detects sentence boundaries for streaming TTS
const SENTENCE_BOUNDARY = /^([\s\S]{12,}?[.!?])(?:\s|$)/;

export interface CollectFieldSpec {
  field: string;
  question: string;
  inputType?: 'number' | 'select' | 'text';
  options?: { label: string; value: string }[];
  unit?: string;
}

export interface AgentConversationState {
  streamingResponse: string;
  conversationState: ConversationState;
  isThinking: boolean;
  isSpeaking: boolean;
  pendingField: string | null;
  pendingIntent: string | null;
  pendingRemainingFields: string[];
  pendingPlanId: string | null;
  collectAllFields: CollectFieldSpec[] | null;
  collectAllIntent: string | null;
  history: { role: 'user' | 'assistant'; content: string }[];
  submitMessage: (text: string, mode?: 'voice' | 'text') => Promise<void>;
  submitBulkFields: (fields: Record<string, string>) => Promise<void>;
  clearHistory: () => void;
}

export function useAgentConversation(): AgentConversationState {
  const { addMessage, setAssistantState, setError, voiceEnabled } = useAppStore();
  const { setProfile, updateField }                 = useProfileStore();
  const { setPlan, setGenerating }                  = usePlannerStore();
  const { setPlan: setMeditationPlan, setGenerating: setMeditationGenerating } = useMeditationStore();
  const { setPlan: setDietPlan, setGenerating: setDietGenerating }             = useDietStore();

  // Agent conversation-level state
  const [streamingResponse, setStreamingResponse] = useState('');
  const [isThinking, setIsThinking]               = useState(false);
  const [conversationState]                        = useState<ConversationState>(DEFAULT_STATE);
  const [history, setHistory]                      = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);

  // Multi-turn field collection state
  const [pendingField,  setPendingField]  = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const [pendingRemainingFields, setPendingRemainingFields] = useState<string[]>([]);

  // Profile confirmation state
  const confirmFieldRef = useRef<string | null>(null);
  const confirmValueRef = useRef<unknown>(null);

  // Plan state
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  // Bulk field collection state (text mode)
  const [collectAllFields, setCollectAllFields] = useState<CollectFieldSpec[] | null>(null);
  const [collectAllIntent, setCollectAllIntent] = useState<string | null>(null);

  const isProcessingRef   = useRef(false);
  const sentenceBufferRef = useRef('');

  const { isSpeaking, enqueue, waitForDrain, resetQueue } = useSpeechQueue();

  // ── Handle SSE actions from backend agent ─────────────────────────────────
  const handleAction = useCallback((agentAction: AgentAction) => {
    const { action, data } = agentAction;
    const d = data as Record<string, unknown>;

    switch (action) {
      case 'COLLECT_PROFILE_FIELD':
        setPendingField(d.field as string);
        setPendingIntent(d.intent as string);
        setPendingRemainingFields((d.remainingFields as string[]) ?? []);
        break;

      case 'COLLECT_ALL_FIELDS':
        setCollectAllFields(d.fields as CollectFieldSpec[]);
        setCollectAllIntent(d.intent as string);
        break;

      case 'PROFILE_FIELD_SAVED': {
        const field = d.field as string;
        const value = d.value;
        updateField(field as keyof import('../store/profileStore').UserProfile, value);
        // Persist to backend (fire and forget — backend already saved it)
        // but refresh profile store
        saveProfileField(field, value)
          .then(updated => setProfile(updated))
          .catch(console.error);
        // Clear pending field after save
        setPendingField(null);
        break;
      }

      case 'CONFIRM_PROFILE_UPDATE':
        confirmFieldRef.current = d.field as string;
        confirmValueRef.current = d.value;
        break;

      case 'PLAN_GENERATED': {
        const plan = d.plan as ExercisePlan;
        const planId = d.planId as string;
        setPlan(plan, planId);
        setPendingPlanId(planId);
        setGenerating(false);
        break;
      }

      case 'MEDITATION_PLAN_GENERATED': {
        const plan   = d.plan   as MeditationPlan;
        const planId = d.planId as string;
        setMeditationPlan(plan, planId);
        setPendingPlanId(planId);
        setMeditationGenerating(false);
        break;
      }

      case 'DIET_PLAN_GENERATED': {
        const plan   = d.plan   as DietPlan;
        const planId = d.planId as string;
        setDietPlan(plan, planId);
        setPendingPlanId(planId);
        setDietGenerating(false);
        break;
      }

      case 'SHOW_PROFILE':
        // Handled by parent — just refresh profile
        import('../services/profileService').then(svc =>
          svc.fetchProfile().then(setProfile).catch(console.error)
        );
        break;

      default:
        console.warn('[AgentConversation] Unknown action:', action);
    }
  }, [updateField, setProfile, setPlan, setGenerating, setMeditationPlan, setMeditationGenerating, setDietPlan, setDietGenerating]);

  // ── Submit a message ───────────────────────────────────────────────────────
  const submitMessage = useCallback(async (text: string, _mode: 'voice' | 'text' = 'text') => {
    const trimmed = text.trim();
    if (!trimmed || isProcessingRef.current) return;

    isProcessingRef.current   = true;
    sentenceBufferRef.current = '';
    resetQueue();
    setError(null);
    setIsThinking(true);
    setAssistantState('thinking');
    setStreamingResponse('');

    // Add to transcript
    addMessage({ id: `user-${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date() });
    setHistory(h => [...h, { role: 'user', content: trimmed }]);

    // If we're collecting a profile field — detect if this is a confirmation reply
    let isConfirmReply = false;
    if (confirmFieldRef.current && confirmValueRef.current !== null) {
      isConfirmReply = true;
    }

    let fullResponse = '';
    let speakingStarted = false;

    try {
      await streamAgentMessage(
        {
          message: trimmed,
          conversationHistory: history,
          voiceEnabled,
          ...(pendingField && !isConfirmReply ? {
            pendingField,
            pendingIntent: pendingIntent ?? undefined,
            pendingRemainingFields,
          } : {}),
          ...(isConfirmReply ? {
            confirmField: confirmFieldRef.current ?? undefined,
            confirmValue: confirmValueRef.current,
          } : {}),
        },
        {
          onChunk: (chunk) => {
            fullResponse              += chunk;
            sentenceBufferRef.current += chunk;
            setStreamingResponse(fullResponse);

            const match = sentenceBufferRef.current.match(SENTENCE_BOUNDARY);
            if (match) {
              const sentence = match[1].trim();
              sentenceBufferRef.current = sentenceBufferRef.current
                .slice(match[0].length)
                .trimStart();
              if (!speakingStarted) {
                speakingStarted = true;
                setAssistantState('speaking');
              }
              enqueue(sentence, DEFAULT_STATE);
            }
          },
          onAction: handleAction,
          onDone: () => {
            // Flush leftover TTS buffer
            const leftover = sentenceBufferRef.current.trim();
            if (leftover) {
              if (!speakingStarted) {
                speakingStarted = true;
                setAssistantState('speaking');
              }
              enqueue(leftover, DEFAULT_STATE);
            }
            sentenceBufferRef.current = '';
          },
          onError: (err) => {
            setError(err.message);
            setAssistantState('idle');
            setIsThinking(false);
            isProcessingRef.current = false;
          },
        }
      );

      // Reset confirmation refs after successful round-trip
      if (isConfirmReply) {
        confirmFieldRef.current = null;
        confirmValueRef.current = null;
      }

      // Flush final leftover
      const leftover = sentenceBufferRef.current.trim();
      if (leftover && !speakingStarted) {
        speakingStarted = true;
        setAssistantState('speaking');
        enqueue(leftover, DEFAULT_STATE);
      }
      sentenceBufferRef.current = '';

      if (speakingStarted) await waitForDrain();

      setStreamingResponse('');
      if (fullResponse.trim()) {
        addMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date(),
        });
        setHistory(h => [...h, { role: 'assistant', content: fullResponse }]);
      }

      setAssistantState('idle');
    } catch (err) {
      setError((err as Error).message);
      setAssistantState('idle');
    } finally {
      setIsThinking(false);
      isProcessingRef.current = false;
    }
  }, [
    history,
    pendingField,
    pendingIntent,
    pendingRemainingFields,
    addMessage,
    setAssistantState,
    setError,
    enqueue,
    waitForDrain,
    resetQueue,
    handleAction,
  ]);

  // ── Submit all fields at once (text-mode form) ─────────────────────────
  const submitBulkFields = useCallback(async (fields: Record<string, string>) => {
    if (!collectAllIntent || isProcessingRef.current) return;

    isProcessingRef.current = true;
    sentenceBufferRef.current = '';
    resetQueue();
    setError(null);
    setIsThinking(true);
    setAssistantState('thinking');
    setStreamingResponse('');

    // Clear the form
    setCollectAllFields(null);
    const intent = collectAllIntent;
    setCollectAllIntent(null);

    let fullResponse = '';
    let speakingStarted = false;

    try {
      await streamAgentMessage(
        {
          message: '',
          conversationHistory: history,
          voiceEnabled,
          pendingIntent: intent,
          bulkFields: fields,
        },
        {
          onChunk: (chunk) => {
            fullResponse += chunk;
            sentenceBufferRef.current += chunk;
            setStreamingResponse(fullResponse);

            const match = sentenceBufferRef.current.match(SENTENCE_BOUNDARY);
            if (match) {
              const sentence = match[1].trim();
              sentenceBufferRef.current = sentenceBufferRef.current
                .slice(match[0].length)
                .trimStart();
              if (!speakingStarted) {
                speakingStarted = true;
                setAssistantState('speaking');
              }
              enqueue(sentence, DEFAULT_STATE);
            }
          },
          onAction: handleAction,
          onDone: () => {
            const leftover = sentenceBufferRef.current.trim();
            if (leftover) {
              if (!speakingStarted) {
                speakingStarted = true;
                setAssistantState('speaking');
              }
              enqueue(leftover, DEFAULT_STATE);
            }
            sentenceBufferRef.current = '';
          },
          onError: (err) => {
            setError(err.message);
            setAssistantState('idle');
            setIsThinking(false);
            isProcessingRef.current = false;
          },
        }
      );

      const leftover = sentenceBufferRef.current.trim();
      if (leftover && !speakingStarted) {
        speakingStarted = true;
        setAssistantState('speaking');
        enqueue(leftover, DEFAULT_STATE);
      }
      sentenceBufferRef.current = '';

      if (speakingStarted) await waitForDrain();

      setStreamingResponse('');
      if (fullResponse.trim()) {
        addMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date(),
        });
        setHistory(h => [...h, { role: 'assistant', content: fullResponse }]);
      }

      setAssistantState('idle');
    } catch (err) {
      setError((err as Error).message);
      setAssistantState('idle');
    } finally {
      setIsThinking(false);
      isProcessingRef.current = false;
    }
  }, [
    collectAllIntent,
    voiceEnabled,
    history,
    addMessage,
    setAssistantState,
    setError,
    enqueue,
    waitForDrain,
    resetQueue,
    handleAction,
  ]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setPendingField(null);
    setPendingIntent(null);
    setPendingRemainingFields([]);
    setPendingPlanId(null);
    setCollectAllFields(null);
    setCollectAllIntent(null);
    confirmFieldRef.current = null;
    confirmValueRef.current = null;
    setStreamingResponse('');
  }, []);

  return {
    streamingResponse,
    conversationState,
    isThinking,
    isSpeaking,
    pendingField,
    pendingIntent,
    pendingRemainingFields,
    pendingPlanId,
    collectAllFields,
    collectAllIntent,
    history,
    submitMessage,
    submitBulkFields,
    clearHistory,
  };
}
