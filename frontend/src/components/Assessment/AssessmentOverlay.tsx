/**
 * AssessmentOverlay.tsx
 * Full-screen overlay that hosts the assessment UI:
 * - Progress indicator
 * - Live transcript (current question + user answer)
 * - Pause / Resume / Stop controls
 * - Final report (when complete)
 * - Safety protocol message
 */

import { AssessmentProgress } from './AssessmentProgress';
import { AssessmentReport }   from './AssessmentReport';
import type { UseAssessmentReturn } from '../../assessment/assessmentTypes';
import styles from './AssessmentOverlay.module.css';

interface Props extends UseAssessmentReturn {}

export function AssessmentOverlay({
  assessmentState,
  isActive,
  currentDomain,
  currentQuestion,
  progress,
  pauseAssessment,
  resumeAssessment,
  stopAssessment,
  submitAnswer,
  waitingForTextAnswer,
}: Props) {
  const { phase, domainIndex, questionIndex, interimTranscript, finalReport, domainResults, assessmentId, answers, error } = assessmentState;
  const isPaused = phase === 'paused';
  const isReport = phase === 'report';
  const isScoring = phase === 'scoring_domain' || phase === 'final_scoring';

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.pulse} />
            <span className={styles.headerTitle}>Well-Being Assessment</span>
          </div>
          <button
            className={styles.stopBtn}
            onClick={stopAssessment}
            aria-label="Stop assessment"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="3" />
            </svg>
            End
          </button>
        </div>

        {/* ── Final Report ────────────────────────────────────────────────── */}
        {isReport && finalReport && (
          <div className={styles.reportWrapper}>
            <AssessmentReport
              report={finalReport}
              physicalResult={domainResults.physical}
              mentalResult={domainResults.mental}
              emotionalResult={domainResults.emotional}
              assessmentId={assessmentId}
              answers={answers}
              onClose={stopAssessment}
            />
          </div>
        )}

        {/* ── Active assessment UI ────────────────────────────────────────── */}
        {!isReport && (
          <>
            {/* Progress */}
            {progress && (
              <div className={styles.progressSection}>
                <AssessmentProgress
                  phase={phase}
                  domainIndex={domainIndex}
                  questionIndex={questionIndex}
                  currentQuestionLabel={currentQuestion?.shortLabel}
                />
              </div>
            )}

            {/* Current question */}
            {currentQuestion && (phase === 'asking' || phase === 'listening' || phase === 'acknowledging') && (
              <div className={styles.questionBox}>
                <p className={styles.questionText}>{currentQuestion.text}</p>

                {/* Text mode: show selectable options */}
                {waitingForTextAnswer && currentQuestion.options && (
                  <div className={styles.optionsGrid}>
                    {currentQuestion.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={styles.optionBtn}
                        onClick={() => submitAnswer(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Voice mode: show listening indicator */}
                {phase === 'listening' && !waitingForTextAnswer && (
                  <div className={styles.listeningIndicator}>
                    <span className={styles.listenDot} />
                    <span className={styles.listenDot} />
                    <span className={styles.listenDot} />
                    <span className={styles.listenLabel}>Listening...</span>
                  </div>
                )}
              </div>
            )}

            {/* Live interim transcript */}
            {interimTranscript && phase === 'listening' && !waitingForTextAnswer && (
              <div className={styles.interimBox}>
                <div className={styles.interimDot} />
                <p className={styles.interimText}>&ldquo;{interimTranscript}&rdquo;</p>
              </div>
            )}

            {/* Scoring / thinking indicator */}
            {isScoring && (
              <div className={styles.scoringBox}>
                <div className={styles.scoringSpinner} />
                <span className={styles.scoringText}>
                  {phase === 'final_scoring' ? 'Generating your report...' : 'Analysing your responses...'}
                </span>
              </div>
            )}

            {/* Phase labels for non-question phases */}
            {(phase === 'intro' || phase === 'domain_intro' || phase === 'domain_summary') && (
              <div className={styles.phaseLabel}>
                <div className={styles.speakingPulse} />
                <span>
                  {phase === 'intro' && 'Introduction'}
                  {phase === 'domain_intro' && `${currentDomain?.label ?? ''} — Starting`}
                  {phase === 'domain_summary' && `${currentDomain?.label ?? ''} — Summary`}
                </span>
              </div>
            )}

            {/* Paused state */}
            {isPaused && (
              <div className={styles.pausedBox}>
                <span className={styles.pausedIcon}>⏸</span>
                <p className={styles.pausedText}>Assessment paused</p>
                <button className={styles.resumeBtn} onClick={resumeAssessment}>
                  Resume
                </button>
              </div>
            )}

            {/* Controls */}
            {!isPaused && isActive && phase !== 'scoring_domain' && phase !== 'final_scoring' && (
              <div className={styles.controls}>
                <button className={styles.pauseBtn} onClick={pauseAssessment}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  Pause
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className={styles.errorBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
