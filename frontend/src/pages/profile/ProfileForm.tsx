import React, { useState } from 'react';
import { UserProfile } from '../../store/profileStore';
import styles from './ProfilePage.module.css';

interface Props {
  profile: UserProfile;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
  isSaving: boolean;
}

const ACTIVITY_OPTIONS = [
  { value: 'sedentary',   label: 'Sedentary (little or no exercise)' },
  { value: 'light',       label: 'Light (1-3 days/week)' },
  { value: 'moderate',    label: 'Moderate (3-5 days/week)' },
  { value: 'active',      label: 'Active (6-7 days/week)' },
  { value: 'very_active', label: 'Very Active (twice/day or physical job)' },
];

const GOAL_OPTIONS = [
  { value: 'weight_loss',      label: 'Weight Loss' },
  { value: 'muscle_gain',      label: 'Muscle Gain' },
  { value: 'endurance',        label: 'Endurance & Cardio' },
  { value: 'flexibility',      label: 'Flexibility & Mobility' },
  { value: 'general_fitness',  label: 'General Fitness' },
];

const DIET_OPTIONS = [
  { value: 'omnivore',    label: 'Omnivore' },
  { value: 'vegetarian',  label: 'Vegetarian' },
  { value: 'vegan',       label: 'Vegan' },
  { value: 'keto',        label: 'Keto' },
  { value: 'paleo',       label: 'Paleo' },
  { value: 'other',       label: 'Other' },
];

const GENDER_OPTIONS = [
  { value: 'male',               label: 'Male' },
  { value: 'female',             label: 'Female' },
  { value: 'other',              label: 'Other' },
  { value: 'prefer_not_to_say',  label: 'Prefer not to say' },
];

export const ProfileForm: React.FC<Props> = ({ profile, onSave, isSaving }) => {
  const [form, setForm] = useState<Partial<UserProfile>>({ ...profile });
  const [allergyInput,  setAllergyInput]  = useState('');
  const [diseaseInput,  setDiseaseInput]  = useState('');
  const [injuryInput,   setInjuryInput]   = useState('');

  const set = (field: keyof UserProfile, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const addTag = (
    field: 'allergies' | 'diseases' | 'injuries',
    val: string,
    setter: (v: string) => void
  ) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    const existing = (form[field] as string[]) ?? [];
    if (!existing.includes(trimmed)) {
      set(field, [...existing, trimmed]);
    }
    setter('');
  };

  const removeTag = (field: 'allergies' | 'diseases' | 'injuries', idx: number) => {
    const existing = (form[field] as string[]) ?? [];
    set(field, existing.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Strip undefined/null values and _id fields before sending
    const clean: Partial<UserProfile> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v !== undefined && v !== null && k !== '_id' && k !== 'userId' && k !== 'completeness') {
        (clean as Record<string, unknown>)[k] = v;
      }
    }
    await onSave(clean);
  };

  const stressLevel = (form.stressLevel as number) ?? 3;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>

      {/* ── Body Metrics ──────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Body Metrics</h2>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Height (cm)</span>
            <input
              type="number"
              value={form.height ?? ''}
              onChange={e => set('height', e.target.value ? +e.target.value : undefined)}
              placeholder="175"
              min={50}
              max={300}
            />
          </label>
          <label className={styles.field}>
            <span>Weight (kg)</span>
            <input
              type="number"
              value={form.weight ?? ''}
              onChange={e => set('weight', e.target.value ? +e.target.value : undefined)}
              placeholder="70"
              min={20}
              max={500}
            />
          </label>
          <label className={styles.field}>
            <span>Age</span>
            <input
              type="number"
              value={form.age ?? ''}
              onChange={e => set('age', e.target.value ? +e.target.value : undefined)}
              placeholder="28"
              min={1}
              max={120}
            />
          </label>
        </div>
        <label className={styles.field}>
          <span>Gender</span>
          <select
            value={form.gender ?? ''}
            onChange={e => set('gender', e.target.value || undefined)}
          >
            <option value="">Select...</option>
            {GENDER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </section>

      {/* ── Fitness ───────────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Fitness</h2>
        <label className={styles.field}>
          <span>Activity Level</span>
          <select
            value={form.activityLevel ?? ''}
            onChange={e => set('activityLevel', e.target.value || undefined)}
          >
            <option value="">Select...</option>
            {ACTIVITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Fitness Goal</span>
          <select
            value={form.fitnessGoal ?? ''}
            onChange={e => set('fitnessGoal', e.target.value || undefined)}
          >
            <option value="">Select...</option>
            {GOAL_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Available Time per Day (minutes)</span>
          <input
            type="number"
            value={form.availableTimePerDay ?? ''}
            onChange={e => set('availableTimePerDay', e.target.value ? +e.target.value : undefined)}
            placeholder="45"
            min={5}
            max={480}
          />
        </label>
      </section>

      {/* ── Lifestyle ─────────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Lifestyle</h2>
        <label className={styles.field}>
          <span>Diet Preference</span>
          <select
            value={form.dietPreference ?? ''}
            onChange={e => set('dietPreference', e.target.value || undefined)}
          >
            <option value="">Select...</option>
            {DIET_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <div className={styles.row}>
          <label className={styles.field}>
            <span>Sleep Hours per Night</span>
            <input
              type="number"
              value={form.sleepHours ?? ''}
              onChange={e => set('sleepHours', e.target.value ? +e.target.value : undefined)}
              placeholder="7"
              min={1}
              max={24}
              step={0.5}
            />
          </label>
          <label className={`${styles.field} ${styles.stressField}`}>
            <span>Stress Level: <strong>{stressLevel}/5</strong></span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={stressLevel}
              onChange={e => set('stressLevel', +e.target.value)}
              className={styles.slider}
            />
            <div className={styles.sliderLabels}>
              <span>Low</span>
              <span>High</span>
            </div>
          </label>
        </div>
      </section>

      {/* ── Health Conditions ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Health Conditions</h2>

        {/* Allergies */}
        <div className={styles.field}>
          <span>Allergies</span>
          <div className={styles.tagInputRow}>
            <input
              value={allergyInput}
              onChange={e => setAllergyInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('allergies', allergyInput, setAllergyInput);
                }
              }}
              placeholder="Type and press Enter..."
            />
            <button
              type="button"
              className={styles.addTagBtn}
              onClick={() => addTag('allergies', allergyInput, setAllergyInput)}
            >
              Add
            </button>
          </div>
          <div className={styles.tags}>
            {(form.allergies ?? []).map((a, i) => (
              <span key={i} className={styles.tag}>
                {a}
                <button type="button" onClick={() => removeTag('allergies', i)}>×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Diseases */}
        <div className={styles.field}>
          <span>Medical Conditions / Diseases</span>
          <div className={styles.tagInputRow}>
            <input
              value={diseaseInput}
              onChange={e => setDiseaseInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('diseases', diseaseInput, setDiseaseInput);
                }
              }}
              placeholder="e.g. diabetes, hypertension..."
            />
            <button
              type="button"
              className={styles.addTagBtn}
              onClick={() => addTag('diseases', diseaseInput, setDiseaseInput)}
            >
              Add
            </button>
          </div>
          <div className={styles.tags}>
            {(form.diseases ?? []).map((d, i) => (
              <span key={i} className={`${styles.tag} ${styles.tagRed}`}>
                {d}
                <button type="button" onClick={() => removeTag('diseases', i)}>×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Injuries */}
        <div className={styles.field}>
          <span>Injuries / Physical Limitations</span>
          <div className={styles.tagInputRow}>
            <input
              value={injuryInput}
              onChange={e => setInjuryInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag('injuries', injuryInput, setInjuryInput);
                }
              }}
              placeholder="e.g. lower back pain, bad knees..."
            />
            <button
              type="button"
              className={styles.addTagBtn}
              onClick={() => addTag('injuries', injuryInput, setInjuryInput)}
            >
              Add
            </button>
          </div>
          <div className={styles.tags}>
            {(form.injuries ?? []).map((inj, i) => (
              <span key={i} className={`${styles.tag} ${styles.tagOrange}`}>
                {inj}
                <button type="button" onClick={() => removeTag('injuries', i)}>×</button>
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.saveRow}>
        <button
          type="submit"
          className={styles.saveBtn}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </form>
  );
};
