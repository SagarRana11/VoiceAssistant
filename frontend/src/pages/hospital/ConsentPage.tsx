import { useState }             from 'react';
import { HospitalLayout }        from './HospitalLayout';
import { VoiceWizard }           from './VoiceWizard';
import { useHospitalStore }      from '../../store/hospitalStore';
import { streamConsentStep, streamHospitalChat, completeConsent } from '../../services/hospitalService';
import styles from './WizardPage.module.css';

const STEPS = [
  { label: 'Condition',    title: 'Understanding Your Condition' },
  { label: 'Why Urgent',   title: 'Why Treatment Is Needed Now' },
  { label: 'Procedure',    title: 'About Your Procedure' },
  { label: 'Benefits',     title: 'Benefits of Treatment' },
  { label: 'Risks',        title: 'Possible Risks' },
  { label: 'Alternatives', title: 'Your Options' },
  { label: 'Questions',    title: 'Do You Have Questions?' },
  { label: 'Consent',      title: 'Your Acknowledgement' },
];

export function ConsentPage() {
  const { patient, session, setSession } = useHospitalStore();
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [completed, setCompleted] = useState(false);

  if (!patient || !session) return null;

  if (completed) {
    return (
      <HospitalLayout title="Consent Complete">
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>Consent Acknowledged</h2>
          <p className={styles.successDesc}>
            {patient.name} has been educated about their condition and procedure.
            {questionsAsked > 0 ? ` They asked ${questionsAsked} question(s).` : ''}
          </p>
          <p className={styles.successSub}>The care team has been notified.</p>
        </div>
      </HospitalLayout>
    );
  }

  async function loadStep(step: number, onChunk: (c: string) => void) {
    await streamConsentStep(patient!._id, session!._id, step, questionsAsked, onChunk);
  }

  async function askQuestion(question: string, onChunk: (c: string) => void) {
    setQuestionsAsked(n => n + 1);
    await streamHospitalChat(patient!._id, session!._id, question, [], onChunk);
  }

  async function handleComplete() {
    await completeConsent(patient!._id, session!._id, questionsAsked);
    setSession({ ...session!, consentCompleted: true, stage: 'consent' });
    setCompleted(true);
  }

  return (
    <HospitalLayout title="Consent Education" subtitle={`${patient.name} · ${patient.diagnosis}`} fullWidth>
      <VoiceWizard
        steps={STEPS}
        patientName={patient.name}
        diagnosis={patient.diagnosis}
        subTitle={`Procedure: ${patient.plannedProcedure}`}
        onLoadStep={loadStep}
        onAskQuestion={askQuestion}
        onComplete={handleComplete}
        completeLabel="I Understand & Give Consent"
        minStepSeconds={5}
      />
    </HospitalLayout>
  );
}
