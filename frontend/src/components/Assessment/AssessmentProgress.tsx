/**
 * AssessmentProgress.tsx
 * Shows domain progress indicator during an active assessment.
 * Displays: domain icon, label, current question / total, progress bar.
 */

import { ASSESSMENT_DOMAINS } from '../../assessment/assessmentQuestions';
import type { AssessmentPhase } from '../../assessment/assessmentTypes';
import styles from './AssessmentProgress.module.css';

interface Props {
  phase: AssessmentPhase;
  domainIndex: number;
  questionIndex: number;
  currentQuestionLabel?: string;
}

export function AssessmentProgress({
  phase,
  domainIndex,
  questionIndex,
  currentQuestionLabel,
}: Props) {
  const domain = ASSESSMENT_DOMAINS[domainIndex];
  if (!domain) return null;

  const total    = domain.questions.length;
  const current  = Math.min(questionIndex + 1, total);
  const pct      = Math.round((current / total) * 100);

  const phaseLabel: Record<AssessmentPhase, string> = {
    idle:            '',
    intro:           'Starting...',
    domain_intro:    'Introducing...',
    asking:          `Question ${current} of ${total}`,
    listening:       'Listening...',
    acknowledging:   'Got it...',
    scoring_domain:  'Scoring...',
    domain_summary:  'Summary',
    final_scoring:   'Generating Report...',
    report:          'Complete',
    safety_protocol: 'Important',
    paused:          'Paused',
    error:           'Error',
  };

  return (
    <div className={styles.container}>
      {/* Domain tabs */}
      <div className={styles.domains}>
        {ASSESSMENT_DOMAINS.map((d, idx) => (
          <div
            key={d.id}
            className={`${styles.domainTab} ${idx === domainIndex ? styles.active : ''} ${idx < domainIndex ? styles.done : ''}`}
            style={{ '--domain-color': d.color } as React.CSSProperties}
          >
            <span className={styles.domainIcon}>{d.icon}</span>
            <span className={styles.domainLabel}>{d.label.split(' ')[0]}</span>
            {idx < domainIndex && (
              <span className={styles.checkmark}>✓</span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className={styles.progressRow}>
        <div
          className={styles.progressBar}
          style={{ '--domain-color': domain.color } as React.CSSProperties}
        >
          <div
            className={styles.progressFill}
            style={{ width: `${pct}%` }}
          />
        </div>

        <span className={styles.progressLabel}>
          {phaseLabel[phase] || `${current}/${total}`}
        </span>
      </div>

      {/* Current question label */}
      {currentQuestionLabel && phase === 'asking' && (
        <p className={styles.questionLabel}>{currentQuestionLabel}</p>
      )}
    </div>
  );
}
