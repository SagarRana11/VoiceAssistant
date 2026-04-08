import React, { useState } from 'react';
import { DietPlan, MacroSplit } from '../../store/dietStore';
import styles from './DietPlanView.module.css';

interface Props {
  plan: DietPlan;
  onClose: () => void;
}

const GOAL_COLORS: Record<string, string> = {
  weight_loss:    '#22c55e',
  muscle_gain:    '#f59e0b',
  endurance:      '#3b82f6',
  flexibility:    '#ec4899',
  general_fitness:'#8b5cf6',
};

function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#3b82f6' };
  if (bmi < 25)   return { label: 'Healthy',     color: '#22c55e' };
  if (bmi < 30)   return { label: 'Overweight',  color: '#f59e0b' };
  return                  { label: 'Obese',       color: '#ef4444' };
}

export const DietPlanView: React.FC<Props> = ({ plan, onClose }) => {
  const [activeTab, setActiveTab] = useState<'meals' | 'macros' | 'notes'>('meals');
  const bmiInfo = getBmiCategory(plan.bmi);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.panelHeader}>
          <div className={styles.headerLeft}>
            <span className={styles.durationBadge}>
              {plan.planDuration.charAt(0).toUpperCase() + plan.planDuration.slice(1)} Plan
            </span>
            <h2 className={styles.panelTitle}>Your Diet Plan</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Summary */}
        {plan.planSummary && (
          <div className={styles.summary}>{plan.planSummary}</div>
        )}

        {/* Key metrics row */}
        <div className={styles.metricsRow}>
          <div className={styles.metric}>
            <div className={styles.metricValue}>{plan.calorieTarget}</div>
            <div className={styles.metricLabel}>kcal / day</div>
          </div>
          <div className={styles.metricDivider} />
          <div className={styles.metric}>
            <div className={styles.metricValue} style={{ color: bmiInfo.color }}>{plan.bmi}</div>
            <div className={styles.metricLabel}>BMI · {bmiInfo.label}</div>
          </div>
          <div className={styles.metricDivider} />
          <div className={styles.metric}>
            <div className={styles.metricValue}>{plan.mealStructure}</div>
            <div className={styles.metricLabel}>Meal structure</div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {(['meals', 'macros', 'notes'] as const).map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'meals' ? '🍽 Meals' : tab === 'macros' ? '📊 Macros' : '📝 Notes'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className={styles.tabContent}>
          {activeTab === 'meals' && (
            <div className={styles.mealGrid}>
              <MealCard title="🌅 Breakfast" items={plan.breakfastOptions} accent="#f59e0b" />
              <MealCard title="☀️ Lunch"     items={plan.lunchOptions}     accent="#22c55e" />
              <MealCard title="🌙 Dinner"    items={plan.dinnerOptions}    accent="#6366f1" />
              <MealCard title="🍎 Snacks"    items={plan.snackOptions}     accent="#ec4899" />
              {/* Hydration */}
              {plan.hydrationAdvice && (
                <div className={`${styles.mealSection} ${styles.hydrationCard}`}>
                  <div className={styles.mealTitle}>💧 Hydration</div>
                  <p className={styles.hydrationText}>{plan.hydrationAdvice}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'macros' && (
            <div className={styles.macrosContainer}>
              <MacroBar label="Protein" grams={plan.macroSplit.proteinG} pct={plan.macroSplit.proteinPct} color="#f59e0b" />
              <MacroBar label="Carbs"   grams={plan.macroSplit.carbsG}   pct={plan.macroSplit.carbsPct}   color="#22c55e" />
              <MacroBar label="Fat"     grams={plan.macroSplit.fatG}     pct={plan.macroSplit.fatPct}     color="#6366f1" />

              <div className={styles.macroSummary}>
                <div className={styles.macroSummaryItem}>
                  <span>Total daily calories</span>
                  <strong>{plan.calorieTarget} kcal</strong>
                </div>
                <div className={styles.macroSummaryItem}>
                  <span>Protein</span>
                  <strong>{plan.macroSplit.proteinG}g ({plan.macroSplit.proteinPct}%)</strong>
                </div>
                <div className={styles.macroSummaryItem}>
                  <span>Carbohydrates</span>
                  <strong>{plan.macroSplit.carbsG}g ({plan.macroSplit.carbsPct}%)</strong>
                </div>
                <div className={styles.macroSummaryItem}>
                  <span>Fat</span>
                  <strong>{plan.macroSplit.fatG}g ({plan.macroSplit.fatPct}%)</strong>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className={styles.notesContainer}>
              {plan.restrictionNotes.length > 0 && (
                <div className={`${styles.noteCard} ${styles.restrictionCard}`}>
                  <div className={styles.noteTitle}>⚠️ Restrictions &amp; Medical Notes</div>
                  {plan.restrictionNotes.map((note, i) => (
                    <div key={i} className={styles.noteItem}>{note}</div>
                  ))}
                </div>
              )}
              {plan.substitutionSuggestions.length > 0 && (
                <div className={`${styles.noteCard} ${styles.subCard}`}>
                  <div className={styles.noteTitle}>🔄 Smart Substitutions</div>
                  {plan.substitutionSuggestions.map((sub, i) => (
                    <div key={i} className={styles.noteItem}>{sub}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const MealCard: React.FC<{ title: string; items: string[]; accent: string }> = ({ title, items, accent }) => (
  <div className={styles.mealSection} style={{ borderColor: `${accent}25` }}>
    <div className={styles.mealTitle} style={{ color: accent }}>{title}</div>
    <div className={styles.mealList}>
      {items.map((item, i) => (
        <div key={i} className={styles.mealItem}>{item}</div>
      ))}
    </div>
  </div>
);

const MacroBar: React.FC<{ label: string; grams: number; pct: number; color: string }> = ({ label, grams, pct, color }) => (
  <div className={styles.macroRow}>
    <div className={styles.macroLabel}>{label}</div>
    <div className={styles.macroBarTrack}>
      <div className={styles.macroBarFill} style={{ width: `${pct}%`, background: color }} />
    </div>
    <div className={styles.macroGrams}>{grams}g</div>
    <div className={styles.macroPct} style={{ color }}>{pct}%</div>
  </div>
);
