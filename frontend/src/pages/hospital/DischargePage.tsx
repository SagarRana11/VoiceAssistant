import { useState }             from 'react';
import { HospitalLayout }        from './HospitalLayout';
import { VoiceWizard }           from './VoiceWizard';
import { useHospitalStore }      from '../../store/hospitalStore';
import { streamDischargeStep, streamHospitalChat } from '../../services/hospitalService';
import styles from './WizardPage.module.css';

const STEPS = [
  { label: 'What Happened',  title: 'Your Hospital Stay' },
  { label: 'Treatment',      title: 'What Was Done For You' },
  { label: 'Medicines',      title: 'Your Medicines at Home' },
  { label: 'Activity',       title: 'Activity & Exercise' },
  { label: 'Diet',           title: 'Diet Guidance' },
  { label: 'Warning Signs',  title: 'When To Seek Help Immediately' },
  { label: 'Follow-Up',      title: 'Your Follow-Up Schedule' },
  { label: 'Check Learning', title: "Let's Check Your Understanding" },
];

export function DischargePage() {
  const { patient, session, setSession } = useHospitalStore();
  const [completed, setCompleted] = useState(false);

  if (!patient || !session) return null;

  if (completed) {
    return (
      <HospitalLayout title="Discharge Education Complete">
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>Ready for Home</h2>
          <p className={styles.successDesc}>
            {patient.name} has completed all discharge education modules. They know their medicines,
            activity guidelines, diet plan, warning signs, and follow-up schedule.
          </p>
          <p className={styles.successSub}>Safe discharge summary has been logged.</p>
        </div>
      </HospitalLayout>
    );
  }

  async function loadStep(step: number, onChunk: (c: string) => void) {
    await streamDischargeStep(patient!._id, session!._id, step, onChunk);
  }

  async function askQuestion(question: string, onChunk: (c: string) => void) {
    await streamHospitalChat(patient!._id, session!._id, question, [], onChunk);
  }

  function handleComplete() {
    setSession({ ...session!, dischargeCompleted: true, stage: 'discharge' });
    setCompleted(true);
  }

  return (
    <HospitalLayout title="Discharge Education" subtitle={`${patient.name} · ${patient.diagnosis}`} fullWidth>
      <VoiceWizard
        steps={STEPS}
        patientName={patient.name}
        diagnosis={patient.diagnosis}
        subTitle={`Procedure: ${patient.plannedProcedure} · Dr. ${patient.doctorName}`}
        onLoadStep={loadStep}
        onAskQuestion={askQuestion}
        onComplete={handleComplete}
        completeLabel="Complete Discharge Education"
      />
    </HospitalLayout>
  );
}
