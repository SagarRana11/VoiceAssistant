/**
 * AssessmentReport.tsx
 * Renders the final consolidated Well-Being Report after assessment completes.
 */

import type { FinalReport, PhysicalScore, MentalScore, EmotionalScore } from '../../assessment/assessmentTypes';
import { ASSESSMENT_DOMAINS } from '../../assessment/assessmentQuestions';
import styles from './AssessmentReport.module.css';

interface Props {
  report: FinalReport;
  physicalResult?: PhysicalScore;
  mentalResult?:   MentalScore;
  emotionalResult?: EmotionalScore;
  assessmentId?: string;
  answers?: Record<string, string>;
  onClose: () => void;
}

const CATEGORY_CONFIG = {
  'Needs Attention': { color: '#ef4444', bg: '#fef2f2', label: 'Needs Attention', emoji: '⚠️' },
  'Fair':            { color: '#f59e0b', bg: '#fffbeb', label: 'Fair',             emoji: '🌤' },
  'Good':            { color: '#10b981', bg: '#f0fdf4', label: 'Good',             emoji: '🌿' },
  'Thriving':        { color: '#6366f1', bg: '#eef2ff', label: 'Thriving',         emoji: '✨' },
};

const DEPRESSION_COLORS: Record<string, string> = {
  'Minimal':          '#10b981',
  'Mild':             '#f59e0b',
  'Moderate':         '#f97316',
  'Moderately Severe': '#ef4444',
  'Severe':           '#dc2626',
};

const ANXIETY_COLORS: Record<string, string> = {
  'Minimal':  '#10b981',
  'Mild':     '#f59e0b',
  'Moderate': '#f97316',
  'Severe':   '#ef4444',
};

export function AssessmentReport({ report, physicalResult, mentalResult, emotionalResult, answers, onClose }: Props) {
  const catConfig = CATEGORY_CONFIG[report.overallCategory] ?? CATEGORY_CONFIG['Fair'];

  return (
    <div className={styles.wrapper}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className={styles.header}
        style={{ '--cat-color': catConfig.color, '--cat-bg': catConfig.bg } as React.CSSProperties}
      >
        <div className={styles.headerLeft}>
          <span className={styles.catEmoji}>{catConfig.emoji}</span>
          <div>
            <p className={styles.headerSub}>Overall Well-Being</p>
            <h2 className={styles.catLabel}>{catConfig.label}</h2>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close report">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className={styles.scroll}>
        {/* ── Domain scores ──────────────────────────────────────────────── */}
        <div className={styles.scoreCards}>
          {physicalResult && (
            <ScoreCard
              icon="🫀"
              label="Physical"
              score={physicalResult.score}
              max={physicalResult.maxScore}
              category={physicalResult.category}
              color="#ef4444"
            />
          )}
          {mentalResult && (
            <div className={styles.mentalCard}>
              <div className={styles.mentalRow}>
                <span className={styles.cardIcon}>🧠</span>
                <span className={styles.cardLabel}>Mental</span>
              </div>
              <div className={styles.mentalScores}>
                <MiniScore
                  label="Depression"
                  category={mentalResult.categorySummary.depression}
                  color={DEPRESSION_COLORS[mentalResult.categorySummary.depression] ?? '#6b7280'}
                />
                <MiniScore
                  label="Anxiety"
                  category={mentalResult.categorySummary.anxiety}
                  color={ANXIETY_COLORS[mentalResult.categorySummary.anxiety] ?? '#6b7280'}
                />
              </div>
            </div>
          )}
          {emotionalResult && (
            <ScoreCard
              icon="💛"
              label="Emotional"
              score={emotionalResult.totalScore}
              max={24}
              category={emotionalResult.category}
              color="#f59e0b"
            />
          )}
        </div>

        {/* ── Overall summary ─────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Overview</h3>
          <p className={styles.summaryText}>{report.overallSummary}</p>
        </section>

        {/* ── Strengths ───────────────────────────────────────────────────── */}
        {report.strengthAreas.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.titleDot} style={{ background: '#10b981' }} />
              Strengths
            </h3>
            <ul className={styles.list}>
              {report.strengthAreas.map((item, i) => (
                <li key={i} className={`${styles.listItem} ${styles.strengthItem}`}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Concerns ────────────────────────────────────────────────────── */}
        {report.concernAreas.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.titleDot} style={{ background: '#f59e0b' }} />
              Areas to Watch
            </h3>
            <ul className={styles.list}>
              {report.concernAreas.map((item, i) => (
                <li key={i} className={`${styles.listItem} ${styles.concernItem}`}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Behavioural suggestions ─────────────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.titleDot} style={{ background: '#6366f1' }} />
            This Week
          </h3>
          <ul className={styles.list}>
            {report.behaviouralSuggestions.map((item, i) => (
              <li key={i} className={styles.listItem}>{item}</li>
            ))}
          </ul>
        </section>

        {/* ── Lifestyle recommendations ───────────────────────────────────── */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.titleDot} style={{ background: '#0ea5e9' }} />
            Lifestyle Goals
          </h3>
          <ul className={styles.list}>
            {report.lifestyleRecommendations.map((item, i) => (
              <li key={i} className={styles.listItem}>{item}</li>
            ))}
          </ul>
        </section>

        {/* ── Professional help ────────────────────────────────────────────── */}
        <section className={`${styles.section} ${styles.professionalSection}`}>
          <p className={styles.professionalText}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{report.seekProfessionalHelp}</span>
          </p>
          <p className={styles.disclaimer}>
            This assessment is for informational purposes only and does not constitute a medical diagnosis.
            Always consult a qualified healthcare professional for medical advice.
          </p>
        </section>

        {/* ── Q&A Summary ──────────────────────────────────────────────────── */}
        {answers && Object.keys(answers).length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <span className={styles.titleDot} style={{ background: '#8b5cf6' }} />
              Your Responses
            </h3>
            {ASSESSMENT_DOMAINS.map((domain) => (
              <div key={domain.id} className={styles.qaDomain}>
                <h4 className={styles.qaDomainTitle}>
                  {domain.icon} {domain.label}
                </h4>
                {domain.questions.map((q) => {
                  const answer = answers[q.id];
                  if (!answer) return null;
                  return (
                    <div key={q.id} className={styles.qaItem}>
                      <p className={styles.qaQuestion}>{q.shortLabel}</p>
                      <p className={styles.qaAnswer}>{answer}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className={styles.footer}>
          <p className={styles.footerDate}>
            Assessment completed {new Date(report.generatedAt).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
          </p>
          <button className={styles.closeFooterBtn} onClick={onClose}>
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreCard({
  icon, label, score, max, category, color,
}: {
  icon: string; label: string; score: number; max: number; category: string; color: string;
}) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className={styles.scoreCard} style={{ '--card-color': color } as React.CSSProperties}>
      <div className={styles.cardTop}>
        <span className={styles.cardIcon}>{icon}</span>
        <span className={styles.cardLabel}>{label}</span>
      </div>
      <div className={styles.cardScore}>{score}<span className={styles.cardMax}>/{max}</span></div>
      <div className={styles.cardBar}>
        <div className={styles.cardBarFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.cardCategory}>{category}</span>
    </div>
  );
}

function MiniScore({ label, category, color }: { label: string; category: string; color: string }) {
  return (
    <div className={styles.miniScore}>
      <span className={styles.miniLabel}>{label}</span>
      <span className={styles.miniCat} style={{ color, borderColor: color }}>{category}</span>
    </div>
  );
}
