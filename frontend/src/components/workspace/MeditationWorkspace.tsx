import { useState, useEffect } from 'react';
import { useMeditationStore } from '../../store/meditationStore';
import { MeditationPlanView } from '../MeditationPlanView/MeditationPlanView';
import { MeditationMode } from '../MeditationMode/MeditationMode';
import styles from './FeatureWorkspace.module.css';

export function MeditationWorkspace() {
  const {
    currentPlan,
    isMeditationModeActive,
    startMeditationMode,
    exitMeditationMode,
  } = useMeditationStore();
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    if (currentPlan) setShowPlan(true);
  }, [currentPlan]);

  return (
    <div className={styles.workspace}>
      {currentPlan ? (
        <div className={styles.planCard}>
          <div className={styles.planCardIcon} aria-hidden="true">🧘</div>
          <h2 className={styles.planCardTitle}>Your Meditation Plan</h2>
          <p className={styles.planCardSub}>
            {currentPlan.level ?? 'Custom'} level · {currentPlan.sessionDuration ?? '—'} min sessions
          </p>
          <div className={styles.btnRow}>
            <button className={styles.viewBtn} onClick={() => setShowPlan(true)}>
              View Plan
            </button>
            <button
              className={styles.primaryBtn}
              onClick={startMeditationMode}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start Session
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.emptyFeature}>
          <div className={styles.emptyIcon} aria-hidden="true">🧘</div>
          <h2 className={styles.emptyTitle}>Meditation</h2>
          <p className={styles.emptyDesc}>
            Describe your stress level, goals, and available time — the AI will create a
            personalised mindfulness programme with guided sessions.
          </p>
          <div className={styles.examplePrompts}>
            <p className={styles.examplesLabel}>Try saying:</p>
            <span className={styles.prompt}>&ldquo;Create a beginner meditation plan for anxiety&rdquo;</span>
            <span className={styles.prompt}>&ldquo;I have 10 minutes a day to meditate&rdquo;</span>
            <span className={styles.prompt}>&ldquo;Help me sleep better with meditation&rdquo;</span>
          </div>
          <p className={styles.hint}>Use the input bar below or press the mic to get started.</p>
        </div>
      )}

      {showPlan && currentPlan && !isMeditationModeActive && (
        <MeditationPlanView
          plan={currentPlan}
          onClose={() => setShowPlan(false)}
          onStartSession={() => {
            setShowPlan(false);
            startMeditationMode();
          }}
        />
      )}

      {isMeditationModeActive && currentPlan && (
        <MeditationMode plan={currentPlan} onExit={exitMeditationMode} />
      )}
    </div>
  );
}
