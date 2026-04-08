import React, { useState } from 'react';
import { MeditationPlan, WeeklyMeditationDay } from '../../store/meditationStore';
import styles from './MeditationPlanView.module.css';

interface Props {
  plan: MeditationPlan;
  onClose: () => void;
  onStartSession: () => void;
}

const LEVEL_COLORS = {
  beginner: '#22c55e',
  moderate: '#f59e0b',
  advanced: '#8b5cf6',
};

const LEVEL_LABELS = {
  beginner: 'Beginner',
  moderate: 'Moderate',
  advanced: 'Advanced',
};

export const MeditationPlanView: React.FC<Props> = ({ plan, onClose, onStartSession }) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'guide' | 'tips'>('schedule');

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.panelHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.levelBadge} style={{ background: LEVEL_COLORS[plan.level] }}>
              {LEVEL_LABELS[plan.level]}
            </span>
            <h2 className={styles.panelTitle}>Your Meditation Plan</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Summary */}
        {plan.planSummary && (
          <div className={styles.summary}>{plan.planSummary}</div>
        )}

        {/* Meta row */}
        <div className={styles.metaRow}>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>⏱</span>
            <span>{plan.sessionDuration} min/session</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>📅</span>
            <span className={styles.metaCapitalize}>{plan.planDuration} plan</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaIcon}>🎯</span>
            <span>{plan.meditationType.slice(0, 2).join(', ')}</span>
          </div>
        </div>

        {/* Start Session CTA */}
        <button className={styles.startBtn} onClick={onStartSession}>
          <span>▶</span> Start Guided Session
        </button>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(['schedule', 'guide', 'tips'] as const).map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'schedule' ? '📅 Schedule' : tab === 'guide' ? '📖 Step Guide' : '💡 Tips'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={styles.tabContent}>
          {activeTab === 'schedule' && (
            <div className={styles.weekGrid}>
              {plan.weeklyStructure.map((day, i) => (
                <DayCard key={i} day={day} />
              ))}
            </div>
          )}

          {activeTab === 'guide' && (
            <div className={styles.guideList}>
              {plan.stepByStepGuide.map((step, i) => (
                <div key={i} className={styles.guideStep}>
                  <div className={styles.stepNumber}>{step.step}</div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepHeader}>
                      <span className={styles.stepTitle}>{step.title}</span>
                      <span className={styles.stepDuration}>{step.duration}</span>
                    </div>
                    <p className={styles.stepInstruction}>{step.instruction}</p>
                  </div>
                </div>
              ))}

              {/* Breathing exercises */}
              {plan.breathingExercises.length > 0 && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionTitle}>Breathing Techniques</div>
                  {plan.breathingExercises.map((b, i) => (
                    <div key={i} className={styles.listItem}>🫁 {b}</div>
                  ))}
                </div>
              )}

              {/* Progression */}
              {plan.progressionAdvice && (
                <div className={`${styles.sectionCard} ${styles.progressCard}`}>
                  <div className={styles.sectionTitle}>Progression Advice</div>
                  <p className={styles.sectionText}>{plan.progressionAdvice}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tips' && (
            <div className={styles.tipsGrid}>
              {/* Environment */}
              <div className={styles.tipCard}>
                <div className={styles.tipTitle}>Environment Setup</div>
                {plan.environmentTips.map((tip, i) => (
                  <div key={i} className={styles.listItem}>✓ {tip}</div>
                ))}
              </div>

              {/* Music */}
              <div className={styles.tipCard}>
                <div className={styles.tipTitle}>Calming Music / Sounds</div>
                {plan.calmingMusicSuggestion.map((m, i) => (
                  <div key={i} className={styles.listItem}>🎵 {m}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DayCard: React.FC<{ day: WeeklyMeditationDay }> = ({ day }) => (
  <div className={`${styles.dayCard} ${day.isRestDay ? styles.restDay : ''}`}>
    <div className={styles.dayHeader}>
      <span className={styles.dayName}>{day.day}</span>
      {!day.isRestDay && (
        <span className={styles.dayDuration}>{day.duration}min</span>
      )}
    </div>
    <div className={styles.sessionType}>{day.sessionType}</div>
    {day.focus && <div className={styles.dayFocus}>{day.focus}</div>}
    {day.isRestDay && <div className={styles.restLabel}>Rest &amp; Reflect</div>}
  </div>
);
