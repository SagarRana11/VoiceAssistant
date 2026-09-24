/**
 * useConversation.ts — Central orchestration hook
 *
 * Streaming TTS flow (new):
 *  Chunks arrive → sentence boundary detected → enqueue() immediately
 *  TTS starts on the FIRST complete sentence, not after the full response.
 *
 *  chunk 1: "Hmm"
 *  chunk 2: "... that sounds"
 *  chunk 3: " really tough."   ← boundary → enqueue → TTS starts NOW
 *  chunk 4: " How long"
 *  chunk 5: " has this been"
 *  chunk 6: " going on?"       ← boundary → enqueue (plays after sentence 1)
 *  stream ends → enqueue leftover buffer → waitForDrain()
 */
import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ROLES } from '../constants/roles';
import { apiCreateConversation, apiStreamMessage } from '../services/apiService';
import { useSpeechQueue } from './useSpeechQueue';
import { useSpeechRecognition } from './useSpeechRecognition';
import {
  ConversationState,
  DEFAULT_STATE,
  detectConversationState,
} from '../utils/emotionDetector';

// Matches a completed sentence ending in . ! or ? — min 12 chars avoids "Dr." / "3.5"
const SENTENCE_BOUNDARY = /^([\s\S]{12,}?[.!?])(?:\s|$)/;

interface Return {
  interimTranscript:  string;
  streamingResponse:  string;
  conversationState:  ConversationState;
  isListening:        boolean;
  isSpeaking:         boolean;
  isSpeechSupported:  boolean;
  currentChunk:       string;
  startSession:  () => Promise<void>;
  stopSession:   () => void;
  submitText:    (text: string) => Promise<void>;
}

interface Opts {
  /** When provided and active, bypasses the TTS queue entirely.
   *  Called once with the full response text after the stream ends. */
  externalSpeak?: (text: string) => Promise<void>;
  isExternalActive?: boolean;
}

export function useConversation(opts: Opts = {}): Return {
  const { externalSpeak, isExternalActive = false } = opts;
  const {
    currentRole,
    currentConversationId,
    addMessage,
    setConversationId,
    setAssistantState,
    setError,
  } = useAppStore();

  const [interimTranscript,  setInterimTranscript]  = useState('');
  const [streamingResponse,  setStreamingResponse]  = useState('');
  const [conversationState,  setConversationState]  = useState<ConversationState>(DEFAULT_STATE);

  const isProcessingRef   = useRef(false);
  const sentenceBufferRef = useRef(''); // accumulates chunks until sentence boundary

  const { isSpeaking, currentChunk, enqueue, waitForDrain, cancel, resetQueue } =
    useSpeechQueue();

  // ── Ensure a MongoDB conversation doc exists ─────────────────────────────────
  const ensureConversation = useCallback(async (): Promise<string> => {
    if (currentConversationId) return currentConversationId;
    const role = ROLES[currentRole];
    const { conversation } = await apiCreateConversation(currentRole, role.name);
    setConversationId(conversation._id);
    return conversation._id;
  }, [currentRole, currentConversationId, setConversationId]);

  // ── Main pipeline ────────────────────────────────────────────────────────────
  const submitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isProcessingRef.current) return;

      isProcessingRef.current   = true;
      sentenceBufferRef.current = '';
      setInterimTranscript('');
      setError(null);

      // Reset the speech queue — cancel() in startSession sets cancelledRef=true,
      // which would silently block all enqueue() calls without this reset.
      resetQueue();

      // ① Detect emotion → drives TTS rate/pitch/pause
      const detectedState = detectConversationState(trimmed);
      setConversationState(detectedState);

      try {
        const conversationId = await ensureConversation();

        // ② Add user message to transcript immediately
        addMessage({
          id:        `user-${Date.now()}`,
          role:      'user',
          content:   trimmed,
          timestamp: new Date(),
        });

        setAssistantState('thinking');
        setStreamingResponse('');

        let fullResponse        = '';
        let speakingHasStarted  = false;

        // ③ Stream from backend — behaviour differs between D-ID and TTS queue
        await apiStreamMessage(conversationId, trimmed, currentRole, (chunk) => {
          fullResponse              += chunk;
          sentenceBufferRef.current += chunk;
          setStreamingResponse(fullResponse); // live-render the reply as it streams

          // When D-ID is active, skip mid-stream sentence enqueue —
          // we send the full response to D-ID after the stream ends.
          if (isExternalActive) return;

          // TTS queue path: detect sentence boundary and enqueue immediately
          const match = sentenceBufferRef.current.match(SENTENCE_BOUNDARY);
          if (match) {
            const completeSentence    = match[1].trim();
            sentenceBufferRef.current = sentenceBufferRef.current
              .slice(match[0].length)
              .trimStart();

            if (!speakingHasStarted) {
              speakingHasStarted = true;
              setAssistantState('speaking');
            }
            enqueue(completeSentence, detectedState);
          }
        });

        // ④ Stream done
        if (isExternalActive && externalSpeak) {
          // D-ID path: send full response, D-ID handles TTS + lip-sync
          const fullText = fullResponse.trim();
          if (fullText) {
            speakingHasStarted = true;
            setAssistantState('speaking');
            await externalSpeak(fullText);
          }
        } else {
          // TTS queue path: flush leftover buffer
          const leftover = sentenceBufferRef.current.trim();
          if (leftover.length > 0) {
            if (!speakingHasStarted) {
              speakingHasStarted = true;
              setAssistantState('speaking');
            }
            enqueue(leftover, detectedState);
          }
          sentenceBufferRef.current = '';
          if (speakingHasStarted) await waitForDrain();
        }
        sentenceBufferRef.current = '';

        // ⑤ Commit the streamed response to the transcript
        addMessage({
          id:        `assistant-${Date.now()}`,
          role:      'assistant',
          content:   fullResponse,
          timestamp: new Date(),
        });
        setStreamingResponse('');

        setAssistantState('idle');
      } catch (err) {
        setStreamingResponse('');
        setAssistantState('idle');
        setError((err as Error).message);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      currentRole,
      addMessage,
      ensureConversation,
      setAssistantState,
      setError,
      enqueue,
      waitForDrain,
      resetQueue,
      isExternalActive,
      externalSpeak,
    ]
  );

  // ── Speech recognition callbacks ────────────────────────────────────────────
  const handleFinalResult = useCallback(
    (transcript: string) => {
      setInterimTranscript('');
      setAssistantState('thinking');
      submitText(transcript);
    },
    [submitText, setAssistantState]
  );

  const handleInterimResult = useCallback((text: string) => {
    setInterimTranscript(text);
  }, []);

  const handleSpeechError = useCallback(
    (code: string) => {
      setAssistantState('idle');
      setError(`Microphone error: ${code}. Check browser permissions.`);
    },
    [setAssistantState, setError]
  );

  const { isListening, isSupported: isSpeechSupported, startListening, stopListening } =
    useSpeechRecognition({
      onFinalResult:   handleFinalResult,
      onInterimResult: handleInterimResult,
      onError:         handleSpeechError,
    });

  // ── Session control ──────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (isProcessingRef.current || isSpeaking) return;
    cancel();
    setAssistantState('listening');
    startListening();
  }, [isSpeaking, cancel, setAssistantState, startListening]);

  const stopSession = useCallback(() => {
    stopListening();
    cancel();
    sentenceBufferRef.current = '';
    setAssistantState('idle');
    setInterimTranscript('');
    setStreamingResponse('');
    isProcessingRef.current = false;
  }, [stopListening, cancel, setAssistantState]);

  return {
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
  };
}
