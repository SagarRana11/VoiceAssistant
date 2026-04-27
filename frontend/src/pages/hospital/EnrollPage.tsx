import { useState } from 'react';
import { HospitalLayout } from './HospitalLayout';
import { useHospitalStore } from '../../store/hospitalStore';
import { useAppStore }      from '../../store/useAppStore';
import { enrollPatient }    from '../../services/hospitalService';
import styles from './EnrollPage.module.css';

const DIAGNOSES   = ['NSTEMI', 'STEMI', 'CAD', 'Heart Failure', 'Arrhythmia', 'Triple Vessel Disease'];
const PROCEDURES  = ['Angiography', 'PCI', 'CABG', 'Medical Management'];
const DEMO_PRESETS = [
  { name: 'Rajesh Kumar',  age: 58, gender: 'Male',   diagnosis: 'STEMI',         plannedProcedure: 'PCI',         doctorName: 'Dr. Sharma',  riskFactors: 'Hypertension, Diabetes', preferredLanguage: 'English' },
  { name: 'Amit Verma',    age: 62, gender: 'Male',   diagnosis: 'CAD',           plannedProcedure: 'Angiography', doctorName: 'Dr. Mehta',   riskFactors: 'Smoking, High Cholesterol', preferredLanguage: 'English' },
  { name: 'Suresh Pillai', age: 70, gender: 'Male',   diagnosis: 'Heart Failure', plannedProcedure: 'Medical Management', doctorName: 'Dr. Rao', riskFactors: 'Obesity, Diabetes', preferredLanguage: 'English' },
];

export function EnrollPage() {
  const { setPatient, setSession } = useHospitalStore();
  const { navigate }               = useAppStore();
  const [loading, setLoading]      = useState(false);
  const [error,   setError]        = useState('');

  const [form, setForm] = useState({
    name:              '',
    age:               '',
    gender:            'Male',
    preferredLanguage: 'English',
    diagnosis:         DIAGNOSES[0],
    plannedProcedure:  PROCEDURES[0],
    doctorName:        '',
    riskFactors:       '',
  });

  function applyPreset(preset: typeof DEMO_PRESETS[0]) {
    setForm({ ...preset, age: String(preset.age) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.age) { setError('Name and age are required.'); return; }
    setError('');
    setLoading(true);
    try {
      const { patient, session } = await enrollPatient({ ...form, age: parseInt(form.age, 10) });
      setPatient(patient);
      setSession(session);
      navigate('hospital');
    } catch {
      setError('Enrollment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <HospitalLayout title="Patient Enrollment" subtitle="Register a new patient" showBack={false}>
      <div className={styles.page}>
        {/* ── Demo presets ─────────────────────────────────────────────── */}
        <div className={styles.presetSection}>
          <div className={styles.presetLabel}>Quick demo presets:</div>
          <div className={styles.presets}>
            {DEMO_PRESETS.map((p) => (
              <button key={p.name} className={styles.presetBtn} onClick={() => applyPreset(p)} type="button">
                <span className={styles.presetName}>{p.name}</span>
                <span className={styles.presetMeta}>{p.diagnosis} · {p.plannedProcedure}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Full Name *</label>
              <input className={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Patient full name" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Age *</label>
              <input className={styles.input} type="number" min="1" max="120" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="Age in years" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Gender</label>
              <select className={styles.select} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Preferred Language</label>
              <select className={styles.select} value={form.preferredLanguage} onChange={e => setForm(f => ({ ...f, preferredLanguage: e.target.value }))}>
                <option>English</option>
                <option>Hindi</option>
                <option>Tamil</option>
                <option>Telugu</option>
                <option>Marathi</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Diagnosis</label>
              <select className={styles.select} value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}>
                {DIAGNOSES.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Planned Procedure</label>
              <select className={styles.select} value={form.plannedProcedure} onChange={e => setForm(f => ({ ...f, plannedProcedure: e.target.value }))}>
                {PROCEDURES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Doctor Name</label>
              <input className={styles.input} value={form.doctorName} onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))} placeholder="Attending doctor" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Risk Factors</label>
              <input className={styles.input} value={form.riskFactors} onChange={e => setForm(f => ({ ...f, riskFactors: e.target.value }))} placeholder="e.g. Diabetes, Hypertension, Smoking" />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading ? 'Enrolling...' : 'Enroll Patient'}
          </button>
        </form>
      </div>
    </HospitalLayout>
  );
}
