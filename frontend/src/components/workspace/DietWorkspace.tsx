import { useState, useEffect } from 'react';
import { useDietStore } from '../../store/dietStore';
import { DietPlanView } from '../DietPlanView/DietPlanView';
import styles from './FeatureWorkspace.module.css';

export function DietWorkspace() {
  const { currentPlan } = useDietStore();
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    if (currentPlan) setShowPlan(true);
  }, [currentPlan]);

  return (
    <div className={styles.workspace}>
      {currentPlan ? (
        <div className={styles.planCard}>
          <div className={styles.planCardIcon} aria-hidden="true">🥗</div>
          <h2 className={styles.planCardTitle}>Your Diet Plan</h2>
          <p className={styles.planCardSub}>
            {currentPlan.calorieTarget ?? '—'} kcal/day ·{' '}
            {currentPlan.bmi ? `BMI ${currentPlan.bmi.toFixed(1)}` : 'Custom plan'}
          </p>
          <div className={styles.macroRow}>
            <MacroChip label="Protein" value={currentPlan.macroSplit ? `${currentPlan.macroSplit.proteinG}g` : undefined} color="#6366f1" />
            <MacroChip label="Carbs"   value={currentPlan.macroSplit ? `${currentPlan.macroSplit.carbsG}g`   : undefined} color="#22c55e" />
            <MacroChip label="Fats"    value={currentPlan.macroSplit ? `${currentPlan.macroSplit.fatG}g`     : undefined} color="#f59e0b" />
          </div>
          <button className={styles.viewBtn} onClick={() => setShowPlan(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            View Full Plan
          </button>
        </div>
      ) : (
        <div className={styles.emptyFeature}>
          <div className={styles.emptyIcon} aria-hidden="true">🥗</div>
          <h2 className={styles.emptyTitle}>Diet Planner</h2>
          <p className={styles.emptyDesc}>
            Share your dietary goals, restrictions, and preferences and the AI will build you a
            personalised meal plan with macro breakdowns.
          </p>
          <div className={styles.examplePrompts}>
            <p className={styles.examplesLabel}>Try saying:</p>
            <span className={styles.prompt}>&ldquo;Create a high-protein diet plan for weight loss&rdquo;</span>
            <span className={styles.prompt}>&ldquo;I need a vegetarian 1800 kcal meal plan&rdquo;</span>
            <span className={styles.prompt}>&ldquo;Plan my meals for muscle gain&rdquo;</span>
          </div>
          <p className={styles.hint}>Use the input bar below or press the mic to get started.</p>
        </div>
      )}

      {showPlan && currentPlan && (
        <DietPlanView plan={currentPlan} onClose={() => setShowPlan(false)} />
      )}
    </div>
  );
}

function MacroChip({ label, value, color }: { label: string; value?: string; color: string }) {
  if (!value) return null;
  return (
    <div className={styles.macroChip} style={{ '--chip-color': color } as React.CSSProperties}>
      <span className={styles.macroLabel}>{label}</span>
      <span className={styles.macroVal}>{value}</span>
    </div>
  );
}
