import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MeditationPlan, MeditationStep } from '../../store/meditationStore';
import styles from './MeditationMode.module.css';

interface Props {
  plan: MeditationPlan;
  onExit: () => void;
}

type BreathPhase = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

const BOX_BREATH_PHASES: { phase: BreathPhase; label: string; count: number }[] = [
  { phase: 'inhale',   label: 'Breathe In',  count: 4 },
  { phase: 'hold-in',  label: 'Hold',        count: 4 },
  { phase: 'exhale',   label: 'Breathe Out', count: 4 },
  { phase: 'hold-out', label: 'Hold',        count: 4 },
];

/** Simple countdown hook — counts from `from` to 0, fires onComplete */
function useCountdown(from: number, running: boolean, onComplete: () => void) {
  const [count, setCount] = useState(from);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCount(from);
  }, [from]);

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          onComplete();
          return from;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, from, onComplete]);

  return count;
}

export const MeditationMode: React.FC<Props> = ({ plan, onExit }) => {
  const steps        = plan.stepByStepGuide;
  const totalMinutes = plan.sessionDuration;

  // Session state
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isRunning,      setIsRunning]       = useState(false);
  const [sessionDone,    setSessionDone]     = useState(false);

  // Breath animation state
  const [breathPhaseIdx, setBreathPhaseIdx] = useState(0);
  const [breathRunning,  setBreathRunning]  = useState(false);

  // Session timer (total seconds)
  const [elapsed, setElapsed] = useState(0);
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentStep        = steps[currentStepIdx] as MeditationStep | undefined;
  const currentBreathPhase = BOX_BREATH_PHASES[breathPhaseIdx];

  // ── Session timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning && !sessionDone) {
      sessionTimerRef.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= totalMinutes * 60) {
            clearInterval(sessionTimerRef.current!);
            setIsRunning(false);
            setBreathRunning(false);
            setSessionDone(true);
          }
          return e + 1;
        });
      }, 1000);
    }
    return () => { if (sessionTimerRef.current) clearInterval(sessionTimerRef.current); };
  }, [isRunning, sessionDone, totalMinutes]);

  // ── Breath phase cycle ────────────────────────────────────────────────────────
  const advanceBreathPhase = useCallback(() => {
    setBreathPhaseIdx(i => (i + 1) % BOX_BREATH_PHASES.length);
  }, []);

  const breathCount = useCountdown(
    currentBreathPhase.count,
    breathRunning,
    advanceBreathPhase
  );

  // ── Controls ──────────────────────────────────────────────────────────────────
  const handleStart = () => {
    setIsRunning(true);
    setBreathRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    setBreathRunning(false);
  };

  const handleResume = () => {
    setIsRunning(true);
    setBreathRunning(true);
  };

  const handleNextStep = () => {
    if (currentStepIdx < steps.length - 1) {
      setCurrentStepIdx(i => i + 1);
    } else {
      setSessionDone(true);
      setIsRunning(false);
      setBreathRunning(false);
    }
  };

  // ── Formatting ─────────────────────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPct = Math.min((elapsed / (totalMinutes * 60)) * 100, 100);

  // ── Breath animation circle scale ─────────────────────────────────────────────
  const breathScale = currentBreathPhase.phase === 'inhale' ? 1.35
    : currentBreathPhase.phase === 'exhale' ? 0.75 : 1;

  return (
    <div className={styles.fullscreen}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>Meditation Session</div>
        <button className={styles.exitBtn} onClick={onExit}>✕ Exit</button>
      </div>

      {/* Session done overlay */}
      {sessionDone ? (
        <div className={styles.doneCard}>
          <div className={styles.doneIcon}>🙏</div>
          <h2 className={styles.doneTitle}>Session Complete</h2>
          <p className={styles.doneText}>
            You completed {formatTime(elapsed)} of mindful practice. Well done.
          </p>
          <button className={styles.doneBtn} onClick={onExit}>Close</button>
        </div>
      ) : (
        <>
          {/* Breath circle */}
          <div className={styles.breathContainer}>
            <div
              className={styles.breathCircle}
              style={{
                transform: `scale(${breathRunning ? breathScale : 1})`,
                transition: `transform ${currentBreathPhase.count}s ease-in-out`,
              }}
            >
              <div className={styles.breathPhaseLabel}>
                {breathRunning ? currentBreathPhase.label : 'Ready'}
              </div>
              {breathRunning && (
                <div className={styles.breathCount}>{breathCount}</div>
              )}
            </div>
          </div>

          {/* Current step card */}
          {currentStep && (
            <div className={styles.stepCard}>
              <div className={styles.stepMeta}>
                Step {currentStepIdx + 1} of {steps.length} · {currentStep.duration}
              </div>
              <div className={styles.stepTitle}>{currentStep.title}</div>
              <p className={styles.stepInstruction}>{currentStep.instruction}</p>
            </div>
          )}

          {/* Progress bar */}
          <div className={styles.progressContainer}>
            <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
          </div>
          <div className={styles.timerRow}>
            <span className={styles.elapsed}>{formatTime(elapsed)}</span>
            <span className={styles.total}>{formatTime(totalMinutes * 60)}</span>
          </div>

          {/* Controls */}
          <div className={styles.controls}>
            {!isRunning ? (
              <button
                className={`${styles.controlBtn} ${styles.primaryBtn}`}
                onClick={elapsed === 0 ? handleStart : handleResume}
              >
                {elapsed === 0 ? '▶ Begin Session' : '▶ Resume'}
              </button>
            ) : (
              <button className={`${styles.controlBtn} ${styles.pauseBtn}`} onClick={handlePause}>
                ⏸ Pause
              </button>
            )}
            {isRunning && currentStepIdx < steps.length - 1 && (
              <button className={`${styles.controlBtn} ${styles.secondaryBtn}`} onClick={handleNextStep}>
                Next Step →
              </button>
            )}
          </div>

          {/* Music suggestion */}
          {plan.calmingMusicSuggestion.length > 0 && (
            <div className={styles.musicHint}>
              🎵 Try: {plan.calmingMusicSuggestion[0]}
            </div>
          )}
        </>
      )}
    </div>
  );
};
