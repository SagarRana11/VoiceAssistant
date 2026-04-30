/**
 * CathLabInterviewPage — Voice-first H&P interview with Sofiya NP.
 *
 * Flow per patient turn:
 *   1. Patient speaks or types → streamCathLabChat()
 *   2. SSE chunks → displayed + spoken via D-ID / ElevenLabs / browserTTS
 *   3. SSE actions: CAPTURE → store field, FLAG → show banner,
 *      ADVANCE → show next step question, COMPLETE → navigate to summary
 *
 * Same generation-ID guard and D-ID mount pattern as VoiceWizard.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useCathLabStore } from '../../store/cathLabStore';
import { useDIDStream } from '../../hooks/useDIDStream';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { speakWithElevenLabs } from '../../services/elevenLabsService';
import { streamCathLabChat } from '../../services/cathLabService';
import { MODULE_LABELS, STEP_META } from './cathLabSteps';
import styles from './CathLabInterviewPage.module.css';

const MODULE_LIST = [1, 2, 3, 4, 5, 6];

// ─── Speech helpers (same pattern as VoiceWizard) ────────────────────────────

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

export function CathLabInterviewPage() {
  const { navigate, token } = useAppStore();
  const { patient, session, flags, capturedCount, updateHPField, addFlag, advanceStep } =
    useCathLabStore();
  const did = useDIDStream();

  // Redirect if no session
  useEffect(() => {
    if (!session || !patient) navigate('cathlab');
  }, [session, patient, navigate]);

  const initStepId = session?.currentStep ?? 'greeting';
  const initMeta = STEP_META[initStepId] ?? STEP_META['greeting'];

  // ── Local state ────────────────────────────────────────────────────────────
  const [sofiyaText, setSofiyaText] = useState('');
  const [currentModule, setCurrentModule] = useState(session?.currentModule ?? 1);
  const [currentStepLabel, setCurrentStepLabel] = useState(initMeta.stepLabel);
  const [currentModuleLabel, setCurrentModuleLabel] = useState(initMeta.moduleLabel);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [interimTx, setInterimTx] = useState('');
  const [error, setError] = useState('');

  // ── Refs ───────────────────────────────────────────────────────────────────
  const genRef = useRef(0);
  const speakCancelId = useRef({ cancelled: false });
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const currentModuleRef = useRef(session?.currentModule ?? 1);
  const didConnected = useRef(false);
  const initRef = useRef(false);

  // ── D-ID connect once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (didConnected.current) return;
    didConnected.current = true;
    did.connect();
    return () => {
      speakCancelId.current.cancelled = true;
      window.speechSynthesis.cancel();
      did.disconnect();
      didConnected.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Speak ──────────────────────────────────────────────────────────────────
  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      speakCancelId.current.cancelled = true;
      window.speechSynthesis.cancel();
      await new Promise(r => setTimeout(r, 30));

      const cancelId = { cancelled: false };
      speakCancelId.current = cancelId;
      setSpeaking(true);

      try {
        const chunks = toSpeechChunks(text);
        if (did.isConnected) {
          for (const chunk of chunks) {
            if (cancelId.cancelled) break;
            await did.speak(chunk);
          }
        } else {
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
              useElevenLabs = false;
            }
            if (!cancelId.cancelled) await browserSpeak(chunk, cancelId);
          }
        }
      } finally {
        if (speakCancelId.current === cancelId) setSpeaking(false);
      }
    },
    [did, token],
  );

  // ── Initial greeting speak ─────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const text = initMeta.avatarText;
    setSofiyaText(text);
    historyRef.current = [{ role: 'assistant', content: text }];
    speak(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handle patient response ────────────────────────────────────────────────
  const handlePatientResponse = useCallback(
    async (message: string) => {
      if (!message.trim() || loading || !session) return;

      const myGen = ++genRef.current;
      speakCancelId.current.cancelled = true;
      window.speechSynthesis.cancel();

      const history = [...historyRef.current];
      historyRef.current = [...history, { role: 'user', content: message }];

      setLoading(true);
      setTextInput('');
      setError('');
      setSofiyaText('');

      // Mutable container for closure-assigned state.
      // Using an object (not bare `let`) so TypeScript narrows correctly.
      let accResponse = '';
      const pending: {
        advance: {
          nextStep: string;
          nextModule: number;
          nextStepLabel: string;
          nextModuleLabel: string;
          nextAvatarText: string;
        } | null;
        complete: boolean;
      } = { advance: null, complete: false };

      try {
        await streamCathLabChat(
          session._id,
          message,
          history,
          chunk => {
            if (genRef.current !== myGen) return;
            accResponse += chunk;
            setSofiyaText(t => t + chunk);
          },
          action => {
            if (genRef.current !== myGen) return;

            if (action.action === 'CAPTURE') {
              updateHPField(action.data.field, action.data.value);
            } else if (action.action === 'FLAG') {
              addFlag({
                type: action.data.type,
                message: action.data.message,
                module: currentModuleRef.current,
                raisedAt: new Date().toISOString(),
              });
            } else if (action.action === 'ADVANCE') {
              // Store for after stream — do NOT call speak() here or it
              // would cancel the acknowledgment speech mid-sentence.
              pending.advance = action.data;
              advanceStep(action.data.nextStep, action.data.nextModule);
              historyRef.current = [
                ...historyRef.current,
                { role: 'assistant', content: accResponse },
                { role: 'assistant', content: action.data.nextAvatarText },
              ];
            } else if (action.action === 'COMPLETE') {
              pending.complete = true;
              historyRef.current = [
                ...historyRef.current,
                { role: 'assistant', content: accResponse },
              ];
            }
          },
        );
      } catch {
        if (genRef.current === myGen) {
          setError('Something went wrong. Please try again.');
          setLoading(false);
        }
        return;
      }

      if (genRef.current !== myGen) return;
      setLoading(false); // LLM streaming done

      // Step 1 — speak Sofiya's acknowledgment response
      if (accResponse.trim()) {
        await speak(accResponse);
      }

      if (genRef.current !== myGen) return;

      // Step 2 — navigate on COMPLETE
      if (pending.complete) {
        navigate('cathlab-summary');
        return;
      }

      // Step 3 — show + speak the next step's question
      const pa = pending.advance; // const lets TypeScript narrow correctly
      if (pa) {
        currentModuleRef.current = pa.nextModule;
        setCurrentModule(pa.nextModule);
        setCurrentStepLabel(pa.nextStepLabel);
        setCurrentModuleLabel(pa.nextModuleLabel);
        setSofiyaText(pa.nextAvatarText);
        await speak(pa.nextAvatarText);
      }
    },
    [loading, session, advanceStep, updateHPField, addFlag, speak, navigate],
  );

  // ── Voice input ────────────────────────────────────────────────────────────
  const { isListening, isSupported, startListening, stopListening } = useSpeechRecognition({
    onFinalResult: tx => {
      setInterimTx('');
      handlePatientResponse(tx);
    },
    onInterimResult: tx => setInterimTx(tx),
  });

  // ── Status ─────────────────────────────────────────────────────────────────
  const statusLabel = loading
    ? 'Thinking...'
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

  if (!session || !patient) return null;

  return (
    <div className={styles.page}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('cathlab')} aria-label="Go back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className={styles.brand}>
            <span className={styles.brandIcon}>🫀</span>
            <div>
              <div className={styles.brandName}>Mount Sinai</div>
              <div className={styles.brandSub}>Cardiac Catheterization Lab</div>
            </div>
          </div>
        </div>

        {/* Module progress */}
        <div className={styles.moduleBar}>
          {MODULE_LIST.map(m => (
            <div
              key={m}
              className={`${styles.modStep} ${m < currentModule ? styles.modDone : ''} ${m === currentModule ? styles.modActive : ''}`}
              title={MODULE_LABELS[m]}
            >
              <div className={styles.modDot}>{m < currentModule ? '✓' : m}</div>
              <div className={styles.modLabel}>{MODULE_LABELS[m]}</div>
            </div>
          ))}
        </div>

        <div className={styles.headerRight}>
          <div className={styles.patientChip}>{patient.patientName}</div>
          <div className={styles.avatarBadge}>Sofiya · NP</div>
        </div>
      </header>

      {/* ─── Body: Avatar | Content ───────────────────────────────────────── */}
      <div className={styles.body}>
        {/* ═══ LEFT — Avatar ══════════════════════════════════════════════ */}
        <div className={styles.avatarCol}>
          <div className={styles.avatarWrap}>
            <video
              ref={did.videoRef}
              className={styles.didVideo}
              style={{ display: did.isConnected ? 'block' : 'none' }}
              autoPlay
              playsInline
            />

            {!did.isConnected && (
              <div
                className={`${styles.staticAvatar} ${speaking ? styles.avatarSpeaking : loading ? styles.avatarThinking : ''}`}
              >
                <svg
                  width="56"
                  height="56"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
            )}

            {interimTx && (
              <div className={styles.interimOverlay}>{interimTx}</div>
            )}

            <div
              className={styles.statusBadge}
              style={{ borderColor: statusColor, color: statusColor }}
            >
              <span className={styles.statusDot} style={{ background: statusColor }} />
              {statusLabel}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT — Content ════════════════════════════════════════════ */}
        <div className={styles.contentCol}>
          {/* Current step label */}
          <div className={styles.stepHeader}>
            <span className={styles.modulePill}>{currentModuleLabel}</span>
            <span className={styles.stepName}>{currentStepLabel}</span>
            {capturedCount > 0 && (
              <span className={styles.capturedBadge}>{capturedCount} fields captured</span>
            )}
          </div>

          {/* Clinical flag banners */}
          {flags.length > 0 && (
            <div className={styles.flagSection}>
              {flags.map((f, i) => (
                <div key={i} className={styles.flagBanner}>
                  <span className={styles.flagIcon}>⚠</span>
                  <span>{f.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sofiya's dialogue */}
          <div className={styles.dialogueCard}>
            <div className={styles.dialogueLabel}>
              <span className={styles.dialogueDot} />
              Sofiya, NP
            </div>
            {loading && !sofiyaText && (
              <div className={styles.dots}>
                <span /><span /><span />
              </div>
            )}
            {sofiyaText && (
              <p className={styles.dialogueText}>{sofiyaText}</p>
            )}
            {!loading && !sofiyaText && (
              <p className={styles.dialogueEmpty}>
                Please respond to Sofiya's question above.
              </p>
            )}
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {/* Patient input */}
          <div className={styles.inputSection}>
            {isSupported && (
              <button
                className={`${styles.micBtn} ${isListening ? styles.micActive : ''}`}
                onClick={() => (isListening ? stopListening() : startListening())}
                disabled={loading || speaking}
                title={isListening ? 'Stop listening' : 'Speak your answer'}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                </svg>
                {isListening ? 'Stop' : 'Speak'}
              </button>
            )}

            <div
              className={`${styles.inputRow} ${loading || speaking ? styles.inputDisabled : ''}`}
            >
              <input
                className={styles.textInput}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Or type your answer here and press Enter..."
                onKeyDown={e => e.key === 'Enter' && handlePatientResponse(textInput)}
                disabled={loading || speaking}
              />
              <button
                className={styles.sendBtn}
                onClick={() => handlePatientResponse(textInput)}
                disabled={!textInput.trim() || loading || speaking}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Replay + urgent */}
          <div className={styles.actionsRow}>
            <button
              className={styles.replayBtn}
              onClick={() => speak(sofiyaText)}
              disabled={!sofiyaText || loading || speaking}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 .49-3.44" />
              </svg>
              Replay
            </button>
            <button
              className={styles.urgentBtn}
              onClick={() =>
                handlePatientResponse('I need to speak with a doctor or nurse right away.')
              }
              disabled={loading || speaking}
            >
              Need Clinical Staff
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
