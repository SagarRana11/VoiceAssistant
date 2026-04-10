import { useState, useEffect, useCallback } from 'react';
import { usePlannerStore, ExercisePlan } from '../../store/plannerStore';
import { ExercisePlanView } from '../ExercisePlanView/ExercisePlanView';
import { PlanHistory, HistoryItem } from '../PlanHistory/PlanHistory';
import { apiListExercisePlans, apiGetExercisePlan } from '../../services/apiService';
import styles from './FeatureWorkspace.module.css';

export function ExerciseWorkspace() {
  const { currentPlan, history, historyLoading, setHistory, setHistoryLoading } = usePlannerStore();
  const [showPlan, setShowPlan] = useState(false);
  const [viewingPlan, setViewingPlan] = useState<ExercisePlan | null>(null);

  useEffect(() => {
    if (currentPlan) setShowPlan(true);
  }, [currentPlan]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { plans } = await apiListExercisePlans();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHistory(plans as any[]);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); }
  }, [setHistory, setHistoryLoading]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const historyItems: HistoryItem[] = history.map((p) => ({
    _id: p._id,
    icon: '💪',
    title: p.planSummary?.slice(0, 50) || `${p.durationWeeks}-week plan`,
    subtitle: `${p.durationWeeks} weeks`,
    date: new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const handleSelect = async (id: string) => {
    try {
      const { plan } = await apiGetExercisePlan(id);
      setViewingPlan(plan as ExercisePlan);
    } catch { /* silent */ }
  };

  return (
    <div className={styles.workspace}>
      {currentPlan ? (
        <div className={styles.planCard}>
          <div className={styles.planCardIcon} aria-hidden="true">💪</div>
          <h2 className={styles.planCardTitle}>Your Exercise Plan</h2>
          <p className={styles.planCardSub}>
            {currentPlan.durationWeeks
              ? `${currentPlan.durationWeeks}-week programme`
              : 'Custom programme'} ready to go.
          </p>
          <div className={styles.planStats}>
            {(currentPlan.weeklySchedule ?? []).slice(0, 4).map((workout) => (
              <div key={workout.day} className={styles.stat}>
                <span className={styles.statDay}>{workout.day.slice(0, 3)}</span>
                <span className={styles.statVal}>
                  {workout.isRestDay ? 'Rest' : workout.focus.slice(0, 18)}
                </span>
              </div>
            ))}
          </div>
          <button className={styles.viewBtn} onClick={() => setShowPlan(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="12" y2="17" />
            </svg>
            View Full Plan
          </button>
        </div>
      ) : (
        <div className={styles.emptyFeature}>
          <div className={styles.emptyIcon} aria-hidden="true">💪</div>
          <h2 className={styles.emptyTitle}>Exercise Planner</h2>
          <p className={styles.emptyDesc}>
            Tell the AI your fitness goals and it will generate a personalised weekly workout plan.
          </p>
          <div className={styles.examplePrompts}>
            <p className={styles.examplesLabel}>Try saying:</p>
            <span className={styles.prompt}>&ldquo;Create a 4-week beginner workout plan&rdquo;</span>
            <span className={styles.prompt}>&ldquo;I want to build muscle in 3 days per week&rdquo;</span>
            <span className={styles.prompt}>&ldquo;Give me a home workout routine&rdquo;</span>
          </div>
          <p className={styles.hint}>Use the input bar below or press the mic to get started.</p>
        </div>
      )}

      <PlanHistory
        label="Exercise Plan History"
        items={historyItems}
        loading={historyLoading}
        onRefresh={fetchHistory}
        onSelect={handleSelect}
        emptyText="No exercise plans yet. Ask the AI to create one."
      />

      {showPlan && currentPlan && (
        <ExercisePlanView plan={currentPlan} onClose={() => setShowPlan(false)} />
      )}

      {viewingPlan && (
        <ExercisePlanView plan={viewingPlan} onClose={() => setViewingPlan(null)} />
      )}
    </div>
  );
}
