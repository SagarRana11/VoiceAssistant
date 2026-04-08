/**
 * mentalEngine.ts
 * Mental Well-Being domain: PHQ-9 (depression) + GAD-7 (anxiety)
 *
 * PHQ-9: 9 questions, 0–27 scale
 * GAD-7: 7 questions, 0–21 scale
 *
 * SAFETY PROTOCOL: PHQ-9 Q9 (suicidal ideation) score > 0 triggers riskFlag
 */

import { AssessmentQuestion } from './physicalEngine';

export interface MentalScore {
  depressionScore: number;    // 0–27 (PHQ-9)
  anxietyScore: number;       // 0–21 (GAD-7)
  categorySummary: {
    depression: 'Minimal' | 'Mild' | 'Moderate' | 'Moderately Severe' | 'Severe';
    anxiety:    'Minimal' | 'Mild' | 'Moderate' | 'Severe';
  };
  keySymptoms: string[];
  suggestions: string[];
  riskFlag: boolean;          // true if Q9 suicidal ideation score > 0
  rawScores: Record<string, number>;
}

// ─── PHQ-9 Questions ────────────────────────────────────────────────────────

export const PHQ9_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'phq_anhedonia',
    domain: 'mental',
    shortLabel: 'Loss of Interest',
    text: 'Over the past two weeks, have you had little interest or pleasure in doing things you normally enjoy?',
  },
  {
    id: 'phq_mood',
    domain: 'mental',
    shortLabel: 'Low Mood',
    text: 'Have you been feeling down, depressed, or hopeless at all over the past two weeks?',
  },
  {
    id: 'phq_sleep',
    domain: 'mental',
    shortLabel: 'Sleep Disruption',
    text: 'Have you had trouble falling asleep, staying asleep, or sleeping too much?',
  },
  {
    id: 'phq_energy',
    domain: 'mental',
    shortLabel: 'Fatigue / Low Energy',
    text: 'Have you been feeling tired or having very little energy, even without much physical effort?',
  },
  {
    id: 'phq_appetite',
    domain: 'mental',
    shortLabel: 'Appetite Changes',
    text: 'Have you noticed a poor appetite, or perhaps been eating much more than usual?',
  },
  {
    id: 'phq_selfworth',
    domain: 'mental',
    shortLabel: 'Self-Worth',
    text: 'Have you been feeling bad about yourself — like you are a failure, or that you have let yourself or others down?',
  },
  {
    id: 'phq_concentration',
    domain: 'mental',
    shortLabel: 'Concentration',
    text: 'Have you had trouble concentrating on things, like reading, watching TV, or staying focused at work?',
  },
  {
    id: 'phq_psychomotor',
    domain: 'mental',
    shortLabel: 'Psychomotor Changes',
    text: 'Have you been moving or speaking more slowly than usual, or perhaps feeling unusually fidgety or restless?',
  },
  {
    id: 'phq_suicidality',
    domain: 'mental',
    shortLabel: 'Suicidal Ideation',
    // Phrased gently but clinically
    text: 'This next question is an important one I ask everyone. Have you had any thoughts that you would be better off not being here, or any thoughts of hurting yourself?',
  },
];

// ─── GAD-7 Questions ────────────────────────────────────────────────────────

export const GAD7_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'gad_nervousness',
    domain: 'mental',
    shortLabel: 'Nervousness',
    text: 'Have you been feeling nervous, anxious, or on edge lately?',
  },
  {
    id: 'gad_uncontrollable_worry',
    domain: 'mental',
    shortLabel: 'Uncontrollable Worry',
    text: 'Have you found it hard to stop or control your worrying, even when you try?',
  },
  {
    id: 'gad_excessive_worry',
    domain: 'mental',
    shortLabel: 'Excessive Worry',
    text: 'Have you been worrying too much about different things — work, health, relationships, or the future?',
  },
  {
    id: 'gad_relaxation',
    domain: 'mental',
    shortLabel: 'Trouble Relaxing',
    text: 'Have you been having trouble relaxing and unwinding, even when you have time to?',
  },
  {
    id: 'gad_restlessness',
    domain: 'mental',
    shortLabel: 'Restlessness',
    text: 'Have you been so restless or keyed up that it has been hard to sit still?',
  },
  {
    id: 'gad_irritability',
    domain: 'mental',
    shortLabel: 'Irritability',
    text: 'Have you been feeling easily annoyed, irritable, or snapping at people more than usual?',
  },
  {
    id: 'gad_fear',
    domain: 'mental',
    shortLabel: 'Sense of Fear',
    text: 'Have you been feeling afraid, as if something awful might happen — even if you cannot quite explain why?',
  },
];

export const MENTAL_QUESTIONS = [...PHQ9_QUESTIONS, ...GAD7_QUESTIONS];

// ─── AI Scoring Prompt ──────────────────────────────────────────────────────

export function buildMentalScoringPrompt(answers: Record<string, string>): string {
  const phq9Pairs = PHQ9_QUESTIONS.map(
    (q) => `[${q.id}] Q: ${q.text}\nA: ${answers[q.id] ?? '(no response)'}`
  ).join('\n\n');

  const gad7Pairs = GAD7_QUESTIONS.map(
    (q) => `[${q.id}] Q: ${q.text}\nA: ${answers[q.id] ?? '(no response)'}`
  ).join('\n\n');

  return `You are a licensed clinical assessment scorer applying validated psychiatric screening tools.

Score each answer 0, 1, 2, or 3 based on frequency/severity:
  0 = Not at all / Never
  1 = Several days / Rarely
  2 = More than half the days / Often
  3 = Nearly every day / Almost always

CRITICAL RULE: For phq_suicidality — if the user indicates ANY presence of suicidal ideation or self-harm thoughts (score > 0), set riskFlag to true.

=== PHQ-9 ANSWERS (Depression Screening) ===
${phq9Pairs}

=== GAD-7 ANSWERS (Anxiety Screening) ===
${gad7Pairs}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "rawScores": {
    "phq_anhedonia": <0-3>,
    "phq_mood": <0-3>,
    "phq_sleep": <0-3>,
    "phq_energy": <0-3>,
    "phq_appetite": <0-3>,
    "phq_selfworth": <0-3>,
    "phq_concentration": <0-3>,
    "phq_psychomotor": <0-3>,
    "phq_suicidality": <0-3>,
    "gad_nervousness": <0-3>,
    "gad_uncontrollable_worry": <0-3>,
    "gad_excessive_worry": <0-3>,
    "gad_relaxation": <0-3>,
    "gad_restlessness": <0-3>,
    "gad_irritability": <0-3>,
    "gad_fear": <0-3>
  },
  "riskFlag": <true|false>,
  "keySymptoms": ["<2-5 notable symptoms identified from responses>"],
  "interpretation": "<2-3 sentence clinical interpretation of their mental health status>"
}`;
}

// ─── Score Computation ──────────────────────────────────────────────────────

function classifyDepression(score: number): MentalScore['categorySummary']['depression'] {
  if (score <= 4)  return 'Minimal';
  if (score <= 9)  return 'Mild';
  if (score <= 14) return 'Moderate';
  if (score <= 19) return 'Moderately Severe';
  return 'Severe';
}

function classifyAnxiety(score: number): MentalScore['categorySummary']['anxiety'] {
  if (score <= 4)  return 'Minimal';
  if (score <= 9)  return 'Mild';
  if (score <= 14) return 'Moderate';
  return 'Severe';
}

export function computeMentalResult(
  rawScores: Record<string, number>,
  keySymptoms: string[],
  interpretation: string,
  riskFlag: boolean
): MentalScore {
  const phqKeys = PHQ9_QUESTIONS.map((q) => q.id);
  const gadKeys = GAD7_QUESTIONS.map((q) => q.id);

  const depressionScore = phqKeys.reduce((sum, k) => sum + (rawScores[k] ?? 0), 0);
  const anxietyScore    = gadKeys.reduce((sum, k) => sum + (rawScores[k] ?? 0), 0);

  const depressionCategory = classifyDepression(depressionScore);
  const anxietyCategory    = classifyAnxiety(anxietyScore);

  const suggestions = buildMentalSuggestions(depressionCategory, anxietyCategory, riskFlag);

  return {
    depressionScore,
    anxietyScore,
    categorySummary: { depression: depressionCategory, anxiety: anxietyCategory },
    keySymptoms,
    suggestions,
    riskFlag,
    rawScores,
  };
}

function buildMentalSuggestions(
  depression: MentalScore['categorySummary']['depression'],
  anxiety: MentalScore['categorySummary']['anxiety'],
  riskFlag: boolean
): string[] {
  const suggestions: string[] = [];

  if (riskFlag) {
    suggestions.push('Please reach out to a mental health professional or crisis line immediately — you deserve support.');
    suggestions.push('988 Suicide & Crisis Lifeline: call or text 9-8-8 (US). You are not alone.');
    return suggestions;
  }

  if (depression === 'Severe' || depression === 'Moderately Severe') {
    suggestions.push('These scores suggest significant depression — speaking with a psychiatrist or therapist soon is strongly recommended.');
  } else if (depression === 'Moderate') {
    suggestions.push('Consider scheduling an appointment with a mental health professional to discuss these feelings.');
  } else if (depression === 'Mild') {
    suggestions.push('Gentle self-care practices like journaling, physical activity, and social connection can meaningfully help mild depression.');
  } else {
    suggestions.push('Your mood indicators look healthy — continue nurturing the habits that support your mental wellness.');
  }

  if (anxiety === 'Severe' || anxiety === 'Moderate') {
    suggestions.push('Diaphragmatic breathing, progressive muscle relaxation, or working with a therapist on CBT techniques can significantly reduce anxiety.');
  } else if (anxiety === 'Mild') {
    suggestions.push('Mindfulness practices, limiting caffeine, and reducing screen time before bed can ease mild anxiety symptoms.');
  } else {
    suggestions.push('Your anxiety levels appear well-managed — maintain your stress-regulation habits.');
  }

  suggestions.push('Regular sleep, physical activity, and meaningful social connections are foundational to mental well-being.');

  return suggestions;
}
