import React from 'react';
import { ExercisePlan, DailyWorkout } from '../../store/plannerStore';
import styles from './ExercisePlanView.module.css';

interface Props {
  plan: ExercisePlan;
  onClose: () => void;
}

export const ExercisePlanView: React.FC<Props> = ({ plan, onClose }) => {
  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel}>
        {/* Header */}
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
            Your {plan.durationWeeks}-Week Workout Plan
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close plan">×</button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Summary */}
          {plan.planSummary && (
            <div className={styles.summary}>{plan.planSummary}</div>
          )}

          {/* Weekly schedule */}
          <div className={styles.weekGrid}>
            {plan.weeklySchedule.map((day, i) => (
              <DayCard key={i} day={day} />
            ))}
          </div>

          {/* Progression + Safety notes */}
          <div className={styles.notes}>
            {plan.progressionAdvice && (
              <div className={`${styles.noteCard} ${styles.progressCard}`}>
                <div className={styles.noteTitle}>Progression</div>
                <div className={styles.noteText}>{plan.progressionAdvice}</div>
              </div>
            )}
            {plan.safetyNotes && (
              <div className={`${styles.noteCard} ${styles.safetyCard}`}>
                <div className={styles.noteTitle}>Safety</div>
                <div className={styles.noteText}>{plan.safetyNotes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const DayCard: React.FC<{ day: DailyWorkout }> = ({ day }) => {
  const exercises = day.exercises ?? [];
  const preview   = exercises.slice(0, 3);
  const more      = exercises.length - preview.length;

  return (
    <div className={`${styles.dayCard} ${day.isRestDay ? styles.restDay : ''}`}>
      <div className={styles.dayHeader}>
        <span className={styles.dayName}>{day.day}</span>
        {!day.isRestDay && day.estimatedDuration && (
          <span className={styles.dayDuration}>{day.estimatedDuration}min</span>
        )}
      </div>

      {day.isRestDay ? (
        <>
          <div className={styles.dayFocus}>{day.focus}</div>
          <div className={styles.restLabel}>Rest &amp; recover</div>
        </>
      ) : (
        <>
          <div className={styles.dayFocus}>{day.focus}</div>
          <div className={styles.exerciseList}>
            {preview.map((ex, i) => (
              <div key={i} className={styles.exercise}>
                <span className={styles.exerciseName}>{ex.name}</span>
                <span className={styles.exerciseSpec}>
                  {ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : ex.duration ?? ''}
                </span>
              </div>
            ))}
            {more > 0 && (
              <div className={styles.moreExercises}>+{more} more exercises</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
