/**
 * useAssessment.ts
 * State machine + voice orchestration for the Multi-Domain Well-Being Assessment.
 *
 * Architecture:
 * - Single async runAssessment() loop owns all state transitions
 * - Pause/stop are ref-based signals that the loop checks at each step
 * - useSpeechQueue provides awaitable TTS (speak() returns Promise<void>)
 * - useSpeechRecognition is wrapped in a Promise via answerResolveRef pattern
 * - Sets Zustand assistantState so Avatar animations sync correctly
 */

import { useCallback, useRef, useState } from 'react';
import { useSpeechQueue }       from './useSpeechQueue';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useAppStore }          from '../store/useAppStore';
import { apiScoreDomain, apiGenerateReport } from '../services/apiService';
import {
  ASSESSMENT_DOMAINS,
  getAcknowledgment,
} from '../assessment/assessmentQuestions';
import type {
  AssessmentPhase,
  AssessmentState,
  PhysicalScore,
  MentalScore,
  EmotionalScore,
  UseAssessmentReturn,
  AssessmentDomain,
  AssessmentQuestion,
} from '../assessment/assessmentTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPATHETIC_STATE = {
  emotion: 'supportive' as const,
  pace:    'slow' as const,
  energy:  'low' as const,
};

const INTRO_TEXT =
  "I'd like to take a few minutes to check in on how you've been doing. " +
  "We'll look at three areas together — your physical health, your mental state, and your emotional well-being. " +
  "There are no right or wrong answers — just share what's been true for you. Ready? Let's begin.";

const FINAL_SCORING_TEXT =
  "Thank you for walking through all of this with me. " +
  "Let me take a moment to put together a complete picture of your well-being...";

const REPORT_INTRO_TEXT =
  "Your assessment is complete. I've put together a full report for you. Here's an overview of where you stand...";

const LISTEN_TIMEOUT_MS = 45_000; // 45 seconds max per answer

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE: AssessmentState = {
  phase:          'idle',
  domainIndex:    0,
  questionIndex:  0,
  answers:        {},
  interimTranscript: '',
  domainResults:  {},
  finalReport:    undefined,
  assessmentId:   undefined,
  error:          null,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAssessment(): UseAssessmentReturn {
  const [state, setState] = useState<AssessmentState>(INITIAL_STATE);
  const [waitingForTextAnswer, setWaitingForTextAnswer] = useState(false);

  // Ref mirrors for async loop access (avoids stale closures)
  const stateRef   = useRef<AssessmentState>(INITIAL_STATE);
  const abortRef   = useRef(false);
  const pausedRef  = useRef(false);
  const resumeRef  = useRef<(() => void) | null>(null);   // resolved when user resumes
  const answerResolveRef = useRef<((ans: string) => void) | null>(null);
  const interimRef = useRef('');
  const runningRef = useRef(false);
  const voiceEnabledRef = useRef(true);

  const setPhase = useAppStore((s) => s.setAssistantState);
  const voiceEnabled = useAppStore((s) => s.voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;

  // ── TTS queue ──────────────────────────────────────────────────────────────
  const tts = useSpeechQueue();

  // ── Speech recognition ─────────────────────────────────────────────────────
  const speech = useSpeechRecognition({
    onFinalResult: (transcript) => {
      interimRef.current = '';
      update({ interimTranscript: '' });
      answerResolveRef.current?.(transcript.trim());
      answerResolveRef.current = null;
    },
    onInterimResult: (transcript) => {
      interimRef.current = transcript;
      update({ interimTranscript: transcript });
    },
    onError: (code) => {
      // 'no-speech' just means silence — resolve with empty to let loop decide
      if (code === 'no-speech') {
        answerResolveRef.current?.('');
        answerResolveRef.current = null;
      }
    },
  });

  // ── State helpers ─────────────────────────────────────────────────────────

  const update = useCallback((patch: Partial<AssessmentState>) => {
    stateRef.current = { ...stateRef.current, ...patch };
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setAssessmentPhase = useCallback((phase: AssessmentPhase) => {
    update({ phase });
    // Sync avatar state
    if (phase === 'asking' || phase === 'intro' || phase === 'domain_intro' ||
        phase === 'acknowledging' || phase === 'domain_summary' || phase === 'report') {
      setPhase('speaking');
    } else if (phase === 'listening') {
      setPhase('listening');
    } else if (phase === 'scoring_domain' || phase === 'final_scoring') {
      setPhase('thinking');
    } else if (phase === 'idle' || phase === 'paused' || phase === 'error') {
      setPhase('idle');
    }
  }, [update, setPhase]);

  // ── Core async helpers ────────────────────────────────────────────────────

  const sleep = (ms: number) =>
    voiceEnabledRef.current
      ? new Promise<void>((res) => setTimeout(res, ms))
      : Promise.resolve();

  const checkAborted = () => {
    if (abortRef.current) throw new Error('ASSESSMENT_ABORTED');
  };

  /** Pause support: waits until resumeRef is resolved (or abort) */
  const waitIfPaused = async () => {
    if (!pausedRef.current) return;
    await new Promise<void>((resolve) => { resumeRef.current = resolve; });
    checkAborted();
  };

  /** Awaitable speak — wraps tts.speak with pause/abort checks. Skipped in text mode. */
  const speak = async (text: string) => {
    checkAborted();
    await waitIfPaused();
    if (!voiceEnabledRef.current) return; // Text mode — skip TTS
    setPhase('speaking');
    tts.resetQueue();
    await tts.speak(text, EMPATHETIC_STATE);
    checkAborted();
  };

  /** Awaitable listen — voice mode uses mic, text mode waits for submitAnswer() */
  const listenForAnswer = (): Promise<string> => {
    return new Promise<string>((resolve) => {
      let resolved = false;

      answerResolveRef.current = (answer: string) => {
        if (!resolved) {
          resolved = true;
          setWaitingForTextAnswer(false);
          resolve(answer);
        }
      };

      if (!voiceEnabledRef.current) {
        // Text mode — just wait for submitAnswer() to resolve answerResolveRef
        setWaitingForTextAnswer(true);
        return;
      }

      // Voice mode — start mic
      speech.startListening();

      // Timeout safety: if user says nothing after LISTEN_TIMEOUT_MS
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          answerResolveRef.current = null;
          speech.stopListening();
          resolve('');  // Empty string = no answer, loop will handle gracefully
        }
      }, LISTEN_TIMEOUT_MS);
    });
  };

  // ── Main assessment orchestration loop ────────────────────────────────────

  const runAssessment = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    abortRef.current   = false;
    pausedRef.current  = false;

    try {
      // ── Introduction
      setAssessmentPhase('intro');
      await speak(INTRO_TEXT);
      await sleep(800);

      const collectedResults: {
        physical?: PhysicalScore;
        mental?:   MentalScore;
        emotional?: EmotionalScore;
      } = {};

      // ── Domain loop
      for (let dIdx = 0; dIdx < ASSESSMENT_DOMAINS.length; dIdx++) {
        checkAborted();
        const domain = ASSESSMENT_DOMAINS[dIdx];
        update({ domainIndex: dIdx, questionIndex: 0 });

        // Domain intro
        setAssessmentPhase('domain_intro');
        await speak(domain.introText);
        await sleep(600);

        const domainAnswers: Record<string, string> = {};

        // ── Question loop
        for (let qIdx = 0; qIdx < domain.questions.length; qIdx++) {
          checkAborted();
          await waitIfPaused();

          const question = domain.questions[qIdx];
          update({ questionIndex: qIdx });

          // Ask question
          setAssessmentPhase('asking');
          await speak(question.text);

          // Listen for answer
          setAssessmentPhase('listening');
          setPhase('listening');
          const answer = await listenForAnswer();

          checkAborted();

          // Store answer (use placeholder if silent)
          const storedAnswer = answer || 'No response provided.';
          domainAnswers[question.id] = storedAnswer;
          update({
            answers: { ...stateRef.current.answers, [question.id]: storedAnswer },
            interimTranscript: '',
          });

          // Acknowledge answer
          setAssessmentPhase('acknowledging');
          const ack = getAcknowledgment(domain.id);
          await speak(ack);
          await sleep(400);
        }

        // ── Score domain via backend AI
        setAssessmentPhase('scoring_domain');
        setPhase('thinking');

        let domainResult: PhysicalScore | MentalScore | EmotionalScore | undefined;
        try {
          const response = await apiScoreDomain(domain.id, domainAnswers);
          domainResult = response.result as PhysicalScore | MentalScore | EmotionalScore;

          collectedResults[domain.id as 'physical' | 'mental' | 'emotional'] =
            domainResult as PhysicalScore & MentalScore & EmotionalScore;

          update({ domainResults: { ...stateRef.current.domainResults, [domain.id]: domainResult } });
        } catch (err) {
          console.error(`[Assessment] Scoring failed for ${domain.id}:`, err);
          // Continue assessment even if scoring API fails
        }

        // ── Domain summary (brief spoken summary)
        setAssessmentPhase('domain_summary');
        const summaryText = buildDomainSummaryText(domain, domainResult);
        await speak(summaryText);
        await sleep(600);

        // Domain outro before next domain
        if (dIdx < ASSESSMENT_DOMAINS.length - 1) {
          await speak(domain.outroText);
          await sleep(800);
        }
      }

      checkAborted();

      // ── Final report generation
      setAssessmentPhase('final_scoring');
      setPhase('thinking');
      await speak(FINAL_SCORING_TEXT);

      let finalReport;
      let assessmentId;

      try {
        if (
          collectedResults.physical &&
          collectedResults.mental &&
          collectedResults.emotional
        ) {
          const response = await apiGenerateReport({
            physicalResult:  collectedResults.physical,
            mentalResult:    collectedResults.mental,
            emotionalResult: collectedResults.emotional,
          });

          finalReport  = response.fullReport;
          assessmentId = response.assessmentId;

          update({ finalReport, assessmentId });
        }
      } catch (err) {
        console.error('[Assessment] Final report generation failed:', err);
        update({ error: 'Could not generate final report. Please try again.' });
      }

      // ── Report phase
      setAssessmentPhase('report');
      await speak(REPORT_INTRO_TEXT);

      if (finalReport?.overallSummary) {
        await speak(finalReport.overallSummary);
      }

      setPhase('idle');
      update({ phase: 'report' });

    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'ASSESSMENT_ABORTED') {
        update({ phase: 'idle' });
        setPhase('idle');
        return;
      }
      console.error('[Assessment] Unexpected error:', err);
      update({ phase: 'error', error: 'An unexpected error occurred. Please try again.' });
      setPhase('idle');
    } finally {
      runningRef.current = false;
    }
  };

  // ── Domain summary text builder ───────────────────────────────────────────

  const buildDomainSummaryText = (
    domain: AssessmentDomain,
    result: PhysicalScore | MentalScore | EmotionalScore | undefined
  ): string => {
    if (!result) return `I've noted your responses for ${domain.label}.`;

    if (domain.id === 'physical') {
      const r = result as PhysicalScore;
      return `Based on your answers, your physical well-being is in the ${r.category} range, with a score of ${r.score} out of ${r.maxScore}. ${r.interpretation}`;
    }
    if (domain.id === 'mental') {
      const r = result as MentalScore;
      return `Your mental health screening shows ${r.categorySummary.depression.toLowerCase()} depression indicators and ${r.categorySummary.anxiety.toLowerCase()} anxiety levels. ${r.keySymptoms.length > 0 ? `Key areas I noticed include ${r.keySymptoms.slice(0, 2).join(' and ')}.` : ''} Thank you for being so open with me.`;
    }
    if (domain.id === 'emotional') {
      const r = result as EmotionalScore;
      return `Your emotional well-being scored ${r.totalScore} out of 24, which puts you in the ${r.category.toLowerCase()} range. ${r.interpretation}`;
    }
    return `I've captured your ${domain.label} responses.`;
  };

  // ── Public controls ───────────────────────────────────────────────────────

  const startAssessment = useCallback(() => {
    if (runningRef.current) return;
    const fresh = { ...INITIAL_STATE };
    stateRef.current = fresh;
    setState(fresh);
    runAssessment();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pauseAssessment = useCallback(() => {
    if (!runningRef.current) return;
    pausedRef.current = true;
    tts.cancel();
    speech.stopListening();
    answerResolveRef.current = null;
    update({ phase: 'paused' });
    setPhase('idle');
  }, [tts, speech, update, setPhase]);

  const resumeAssessment = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    const prevPhase = stateRef.current.phase;
    // Resume from wherever we were — re-ask current question
    update({ phase: prevPhase === 'paused' ? 'asking' : prevPhase });
    resumeRef.current?.();
    resumeRef.current = null;
  }, [update]);

  const stopAssessment = useCallback(() => {
    abortRef.current = true;
    pausedRef.current = false;
    tts.cancel();
    speech.stopListening();
    answerResolveRef.current = null;
    resumeRef.current?.();  // unblock any pause waiter so abort propagates
    resumeRef.current = null;
    runningRef.current = false;
    setWaitingForTextAnswer(false);
    const reset = { ...INITIAL_STATE };
    stateRef.current = reset;
    setState(reset);
    setPhase('idle');
  }, [tts, speech, setPhase]);

  /** Text-mode: user selected an option — resolve the pending answer promise */
  const submitAnswer = useCallback((answer: string) => {
    if (answerResolveRef.current) {
      answerResolveRef.current(answer);
    }
  }, []);

  // ── Derived values for UI ─────────────────────────────────────────────────

  const currentDomain = state.phase !== 'idle' && state.phase !== 'intro'
    ? ASSESSMENT_DOMAINS[state.domainIndex] ?? null
    : null;

  const currentQuestion = currentDomain
    ? currentDomain.questions[state.questionIndex] ?? null
    : null;

  const progress = currentDomain
    ? {
        domainLabel: currentDomain.label,
        current:     state.questionIndex + 1,
        total:       currentDomain.questions.length,
      }
    : null;

  const isActive = state.phase !== 'idle' && state.phase !== 'error';

  return {
    assessmentState: state,
    isActive,
    currentDomain,
    currentQuestion,
    progress,
    startAssessment,
    pauseAssessment,
    resumeAssessment,
    stopAssessment,
    submitAnswer,
    waitingForTextAnswer,
  };
}
