import { useState } from 'react';
import { CathLabLayout } from './CathLabLayout';
import { enrollCathLabPatient } from '../../services/cathLabService';
import { useCathLabStore } from '../../store/cathLabStore';
import { useAppStore } from '../../store/useAppStore';
import styles from './CathLabEnrollPage.module.css';

export function CathLabEnrollPage() {
  const { navigate } = useAppStore();
  const { setPatient, setSession } = useCathLabStore();

  const [form, setForm] = useState({
    patientName: '',
    dob: '',
    mrn: '',
    procedureDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientName.trim()) {
      setError('Patient name is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { patient, session } = await enrollCathLabPatient(form);
      setPatient(patient);
      setSession(session);
      navigate('cathlab-interview');
    } catch {
      setError('Enrollment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CathLabLayout
      title="Patient Registration"
      subtitle="Cath Lab Pre-Procedural H&P"
      onBack={() => navigate('assistant')}
    >
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.avatarCircle}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 className={styles.cardTitle}>Register Patient</h2>
              <p className={styles.cardSubtitle}>
                Enter the patient's details to begin the H&P interview with Sofiya.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="patientName">
                Patient Name <span className={styles.required}>*</span>
              </label>
              <input
                id="patientName"
                name="patientName"
                className={styles.input}
                value={form.patientName}
                onChange={handleChange}
                placeholder="Full name"
                required
                autoFocus
              />
            </div>

            <div className={styles.row}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="dob">
                  Date of Birth
                </label>
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  className={styles.input}
                  value={form.dob}
                  onChange={handleChange}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="mrn">
                  MRN
                </label>
                <input
                  id="mrn"
                  name="mrn"
                  className={styles.input}
                  value={form.mrn}
                  onChange={handleChange}
                  placeholder="Medical record number"
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="procedureDate">
                Scheduled Procedure Date
              </label>
              <input
                id="procedureDate"
                name="procedureDate"
                type="date"
                className={styles.input}
                value={form.procedureDate}
                onChange={handleChange}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading ? 'Starting...' : 'Begin H&P Interview'}
              {!loading && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </form>
        </div>

        <div className={styles.info}>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>🎙️</span>
            <span>Voice-first interview — patient can speak or type responses</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>📋</span>
            <span>6 structured modules covering history, medications, testing, and consent</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>⚠️</span>
            <span>Clinical flags are automatically raised for high-risk findings</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>⏱️</span>
            <span>Estimated duration: 15–20 minutes</span>
          </div>
        </div>
      </div>
    </CathLabLayout>
  );
}
