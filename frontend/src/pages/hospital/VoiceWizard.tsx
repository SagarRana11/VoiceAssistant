/**
 * VoiceWizard — Voice-first guided wizard (Consent + Discharge).
 *
 * Fixes applied:
 *  1. Generation-ID guard prevents React StrictMode double-effect from
 *     causing two concurrent SSE streams that interleave into garbled text.
 *  2. <video> is always in the DOM (display:none when not connected) so that
 *     D-ID's ontrack handler can attach srcObject before isConnected flips.
 *  3. speak() uses an isSpeakingRef + cancelId so mid-speech cancellation is
 *     clean and the next step always speaks in full.
 *
 * Per-step flow:
 *   loadStep(n) → stream AI text → speak(fullText) via D-ID → ElevenLabs → browser TTS
 *   At any time patient can: ask by voice, ask by text, replay, go next/back
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useDIDStream } from '../../hooks/useDIDStream';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { speakWithElevenLabs } from '../../services/elevenLabsService';
import styles from './VoiceWizard.module.css';

export interface WizardStep {
  label: string;
  title: string;
}

interface Props {
  steps: WizardStep[];
  patientName: string;
  diagnosis: string;
  subTitle?: string;
  onLoadStep: (step: number, onChunk: (c: string) => void) => Promise<void>;
  onAskQuestion: (question: string, onChunk: (c: string) => void) => Promise<void>;
  onNext?: (step: number) => void;
  onComplete: () => void;
  completeLabel?: string;
  minStepSeconds?: number; // mandatory wait before Next is enabled
}

// ─── Speech helpers ───────────────────────────────────────────────────────────

/** Split text at sentence boundaries into ≤maxLen char chunks for D-ID */
function toSpeechChunks(text: string, maxLen = 260): string[] {
  const raw = text.replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
  if (!raw) return [];
  const sentences = raw.match(/[^.!?]+[.!?]+[\s]*/g) ?? [raw];
  const chunks: string[] = [];
  let buf = '';
  for (const s of sentences) {
    if (buf.length + s.length > maxLen && buf) {
      chunks.push(buf.trim());
      buf = s;
    } else buf += s;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks.length ? chunks : [raw];
}

function browserSpeak(text: string, cancelId: { cancelled: boolean }): Promise<void> {
  return new Promise(resolve => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.88;
    utt.pitch = 1.0;
    utt.volume = 1;
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    if (!cancelId.cancelled) window.speechSynthesis.speak(utt);
    else resolve();
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoiceWizard({
  steps,
  patientName,
  diagnosis,
  subTitle,
  onLoadStep,
  onAskQuestion,
  onNext,
  onComplete,
  completeLabel = 'Complete',
  minStepSeconds = 0,
}: Props) {
  const { token } = useAppStore();
  const did = useDIDStream();

  const [step, setStep] = useState(0);
  const [content, setContent] = useState('');
  const [qaContent, setQaContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interimTx, setInterimTx] = useState('');
  const [textInput, setTextInput] = useState('');
  const [mode, setMode] = useState<'step' | 'qa'>('step');

  const [secsLeft, setSecsLeft] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generation ID — incremented every time loadStep/askQuestion starts.
  // Callbacks that carry an old generationId are silently dropped.
  const genRef = useRef(0);
  const fullTextRef = useRef('');
  const speakCancelId = useRef({ cancelled: false });
  const isSpeakRef = useRef(false);
  // Always points to the current handleNext — lets the memoized loadStep
  // call the up-to-date version without adding `step` to its dep array.
  const handleNextRef = useRef<() => Promise<void>>(async () => {});

  // ── connect D-ID once on mount ──────────────────────────────────────────
  const didConnected = useRef(false);
  useEffect(() => {
    if (didConnected.current) return; // guard React StrictMode double-fire
    didConnected.current = true;
    did.connect();
    return () => {
      speakCancelId.current.cancelled = true;
      window.speechSynthesis.cancel();
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      did.disconnect();
      didConnected.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── speak ─────────────────────────────────────────────────────────────────
  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // Cancel previous speech
      speakCancelId.current.cancelled = true;
      window.speechSynthesis.cancel();
      // Small yield so any in-progress async iteration sees the cancel
      await new Promise(r => setTimeout(r, 30));

      const cancelId = { cancelled: false };
      speakCancelId.current = cancelId;
      isSpeakRef.current = true;
      setSpeaking(true);

      try {
        const chunks = toSpeechChunks(text);

        if (did.isConnected) {
          for (const chunk of chunks) {
            if (cancelId.cancelled) break;
            await did.speak(chunk);
          }
        } else {
          // Decide once per speak() call whether ElevenLabs is working.
          // If it fails on any chunk, fall back to browser TTS for ALL remaining
          // chunks so the user never hears a mixed voice within one response.
          let useElevenLabs = !!token;
          for (const chunk of toSpeechChunks(text, 400)) {
            if (cancelId.cancelled) break;
            if (useElevenLabs) {
              const audio = await speakWithElevenLabs(chunk, token!);
              if (audio && !cancelId.cancelled) {
                await new Promise<void>(res => {
                  audio.onended = () => res();
                  audio.onerror = () => res();
                  audio.play().catch(() => res());
                });
                continue;
              }
              // ElevenLabs failed — switch entire call to browser TTS
              useElevenLabs = false;
            }
            if (!cancelId.cancelled) await browserSpeak(chunk, cancelId);
          }
        }
      } finally {
        if (speakCancelId.current === cancelId) {
          isSpeakRef.current = false;
          setSpeaking(false);
        }
      }
    },
    [did, token],
  );

  // ── load a step ────────────────────────────────────────────────────────────
  const loadStep = useCallback(
    async (s: number) => {
      const myGen = ++genRef.current;

      // Cancel any in-progress speech
      speakCancelId.current.cancelled = true;
      window.speechSynthesis.cancel();

      setLoading(true);
      setContent('');
      setQaContent('');
      setMode('step');
      setSecsLeft(0);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      fullTextRef.current = '';

      try {
        await onLoadStep(s, chunk => {
          if (genRef.current !== myGen) return; // stale stream — discard
          fullTextRef.current += chunk;
          setContent(c => c + chunk);
        });

        if (genRef.current !== myGen) return; // step changed mid-flight
        await speak(fullTextRef.current);

        // Auto-advance countdown after speech ends
        if (genRef.current === myGen && minStepSeconds > 0) {
          setSecsLeft(minStepSeconds);
          countdownRef.current = setInterval(() => {
            setSecsLeft(prev => {
              if (prev <= 1) {
                clearInterval(countdownRef.current!);
                countdownRef.current = null;
                handleNextRef.current(); // always calls the up-to-date version
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } finally {
        if (genRef.current === myGen) setLoading(false);
      }
    },
    [onLoadStep, speak, minStepSeconds],
  );

  // Load step 0 on first mount only
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    loadStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ask a question ─────────────────────────────────────────────────────────
  const askQuestion = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;

      const myGen = ++genRef.current;
      speakCancelId.current.cancelled = true;
      window.speechSynthesis.cancel();

      setLoading(true);
      setQaContent('');
      setMode('qa');
      fullTextRef.current = '';

      try {
        await onAskQuestion(question, chunk => {
          if (genRef.current !== myGen) return;
          fullTextRef.current += chunk;
          setQaContent(c => c + chunk);
        });
        if (genRef.current !== myGen) return;
        await speak(fullTextRef.current);
      } finally {
        if (genRef.current === myGen) {
          setLoading(false);
          setTextInput('');
        }
      }
    },
    [loading, onAskQuestion, speak],
  );

  // ── voice input ───────────────────────────────────────────────────────────
  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onFinalResult: tx => {
      setInterimTx('');
      askQuestion(tx);
    },
    onInterimResult: tx => setInterimTx(tx),
  });

  // ── navigation ────────────────────────────────────────────────────────────
  async function handleNext() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setSecsLeft(0);
    if (step < steps.length - 1) {
      const next = step + 1;
      setStep(next);
      onNext?.(next);
      await loadStep(next);
    } else {
      onComplete();
    }
  }
  // Keep ref pointing at the latest handleNext so the memoized loadStep
  // interval always calls the version that sees the current `step`.
  handleNextRef.current = handleNext;

  const statusLabel = loading
    ? 'Generating...'
    : speaking
      ? 'Speaking...'
      : isListening
        ? 'Listening...'
        : 'Ready';

  const statusColor = speaking
    ? '#0ea5a0'
    : isListening
      ? '#dc2626'
      : loading
        ? '#d97706'
        : '#16a34a';

  return (
    <div className={styles.shell}>
      {/* ═══════════════ LEFT — Full-height avatar panel ══════════════════ */}
      <div className={styles.avatarCol}>
        <div className={styles.avatarWrap}>
          {/* D-ID video — ALWAYS in DOM so ontrack can attach srcObject */}
          <video
            ref={did.videoRef}
            className={styles.didVideo}
            style={{ display: did.isConnected ? 'block' : 'none' }}
            autoPlay
            playsInline
          />

          {/* Static animated avatar shown until D-ID connects */}
          {!did.isConnected && (
            <div
              className={`${styles.staticAvatar} ${speaking ? styles.avatarSpeaking : loading ? styles.avatarThinking : ''}`}
            >
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
          )}

          {/* Interim transcript overlay */}
          {interimTx && <div className={styles.interimOverlay}>{interimTx}</div>}

          <div className={styles.statusBadge} style={{ borderColor: statusColor, color: statusColor }}>
            <span className={styles.statusDot} style={{ background: statusColor }} />
            {statusLabel}
          </div>
        </div>
      </div>

      {/* ═══════════════ RIGHT — Content ══════════════════════════════════ */}
      <div className={styles.contentCol}>
        {/* Top bar: patient info + action buttons */}
        <div className={styles.topBar}>
          <div className={styles.patientInfo}>
            <div className={styles.patientName}>{patientName}</div>
            <div className={styles.patientDiag}>{diagnosis}</div>
            {subTitle && <div className={styles.patientSub}>{subTitle}</div>}
          </div>
          <div className={styles.topActions}>
            {isSupported && (
              <button
                className={`${styles.micBtn} ${isListening ? styles.micActive : ''}`}
                onClick={() => (isListening ? stopListening() : startListening())}
                disabled={loading || speaking}
                title={isListening ? 'Stop listening' : 'Ask by voice'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                </svg>
                {isListening ? 'Stop' : 'Ask by Voice'}
              </button>
            )}
            <button
              className={styles.replayBtn}
              onClick={() => speak(mode === 'qa' ? qaContent : content)}
              disabled={loading || speaking || (!content && !qaContent)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.44" />
              </svg>
              Replay
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className={styles.progressBar}>
          {steps.map((s, i) => (
            <div
              key={i}
              className={`${styles.pStep} ${i < step ? styles.pDone : ''} ${i === step ? styles.pActive : ''}`}
            >
              <div className={styles.pDot}>{i < step ? '✓' : i + 1}</div>
              <div className={styles.pLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Content card */}
        <div className={styles.contentCard}>
          <div className={styles.stepTitle}>{steps[step]?.title}</div>

          {loading && !content && !qaContent && (
            <div className={styles.dots}>
              <span />
              <span />
              <span />
            </div>
          )}

          {mode === 'step' && content && <p className={styles.bodyText}>{content}</p>}

          {mode === 'qa' && (
            <div className={styles.qaBlock}>
              <div className={styles.qaLabel}>Answer</div>
              {loading && !qaContent && (
                <div className={styles.dots}>
                  <span />
                  <span />
                  <span />
                </div>
              )}
              {qaContent && <p className={styles.bodyText}>{qaContent}</p>}
              <button
                className={styles.backToStepBtn}
                onClick={() => {
                  setMode('step');
                  speak(content);
                }}
                disabled={loading || speaking}
              >
                ← Back to step
              </button>
            </div>
          )}
        </div>

        {/* Question input */}
        <div className={styles.inputRow}>
          <input
            className={styles.qInput}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Type a question and press Enter..."
            onKeyDown={e => e.key === 'Enter' && askQuestion(textInput)}
            disabled={loading || speaking}
          />
          <button
            className={styles.askBtn}
            onClick={() => askQuestion(textInput)}
            disabled={!textInput.trim() || loading || speaking}
          >
            Ask
          </button>
        </div>

        {/* Navigation */}
        <div className={styles.navRow}>
          <button
            className={styles.needDrBtn}
            onClick={() => askQuestion('I need to speak to a doctor or nurse right now.')}
            disabled={loading || speaking}
          >
            Need Doctor
          </button>
          <button className={styles.nextBtn} onClick={handleNext} disabled={loading || speaking}>
            {secsLeft > 0 && !loading && !speaking
              ? `Auto-advancing in ${secsLeft}s…`
              : step < steps.length - 1
                ? `Next: ${steps[step + 1]?.label}`
                : completeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
