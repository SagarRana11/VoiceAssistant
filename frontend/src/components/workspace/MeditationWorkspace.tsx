import { useState, useEffect, useCallback } from 'react';
import { useMeditationStore, MeditationPlan } from '../../store/meditationStore';
import { MeditationPlanView } from '../MeditationPlanView/MeditationPlanView';
import { MeditationMode } from '../MeditationMode/MeditationMode';
import { PlanHistory, HistoryItem } from '../PlanHistory/PlanHistory';
import { apiListMeditationPlans, apiGetMeditationPlan } from '../../services/apiService';
import styles from './FeatureWorkspace.module.css';

export function MeditationWorkspace() {
  const {
    currentPlan,
    isMeditationModeActive,
    startMeditationMode,
    exitMeditationMode,
    history,
    historyLoading,
    setHistory,
    setHistoryLoading,
  } = useMeditationStore();
  const [showPlan, setShowPlan] = useState(false);
  const [viewingPlan, setViewingPlan] = useState<MeditationPlan | null>(null);

  useEffect(() => {
    if (currentPlan) setShowPlan(true);
  }, [currentPlan]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { plans } = await apiListMeditationPlans();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHistory(plans as any[]);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, [setHistory, setHistoryLoading]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const historyItems: HistoryItem[] = history.map((p) => ({
    _id: p._id,
    icon: '🧘',
    title: p.planSummary?.slice(0, 50) || 'Meditation Plan',
    subtitle: `${p.level} · ${p.sessionDuration} min`,
    date: new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const handleSelect = async (id: string) => {
    try {
      const { plan } = await apiGetMeditationPlan(id);
      setViewingPlan(plan as MeditationPlan);
    } catch { /* silent */ }
  };

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

      <PlanHistory
        label="Meditation Plan History"
        items={historyItems}
        loading={historyLoading}
        onRefresh={fetchHistory}
        onSelect={handleSelect}
        emptyText="No meditation plans yet. Ask the AI to create one."
      />

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

      {viewingPlan && (
        <MeditationPlanView
          plan={viewingPlan}
          onClose={() => setViewingPlan(null)}
          onStartSession={() => setViewingPlan(null)}
        />
      )}

      {isMeditationModeActive && currentPlan && (
        <MeditationMode plan={currentPlan} onExit={exitMeditationMode} />
      )}
    </div>
  );
}
