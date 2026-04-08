/**
 * emotionalEngine.ts
 * Emotional Well-Being domain: 8-question assessment (0–24 scale)
 * Measures positive/negative affect balance + life satisfaction
 * Categories: Low | Moderate | High
 */

import { AssessmentQuestion } from './physicalEngine';

export interface EmotionalScore {
  positiveScore: number;    // Sum of positive affect items (cheerfulness, calmness, optimism)
  negativeScore: number;    // Sum of negative affect items (irritation, stress) — raw
  totalScore: number;       // 0–24 (positive items + inverted negative items + satisfaction items)
  category: 'Low' | 'Moderate' | 'High';
  keyFactors: string[];
  interpretation: string;
  suggestions: string[];
  rawScores: Record<string, number>;
}

// ─── Question Bank ──────────────────────────────────────────────────────────
// Items marked (P) contribute positively; items marked (N) are inverted in scoring.

export const EMOTIONAL_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'emo_cheerfulness',
    domain: 'emotional',
    shortLabel: 'Cheerfulness',
    text: 'How often have you felt genuinely cheerful or happy this past week — even if just for moments?',
  },
  {
    id: 'emo_calmness',
    domain: 'emotional',
    shortLabel: 'Inner Calmness',
    text: 'Have you been able to feel calm and at peace inside, or have you been feeling emotionally unsettled most of the time?',
  },
  {
    id: 'emo_optimism',
    domain: 'emotional',
    shortLabel: 'Optimism',
    text: 'Do you feel hopeful and positive about your future right now, or does it feel uncertain or bleak?',
  },
  {
    id: 'emo_irritation',
    domain: 'emotional',
    shortLabel: 'Irritation (N)',
    text: 'How often have you been feeling irritable, frustrated, or easily annoyed this week?',
  },
  {
    id: 'emo_stress',
    domain: 'emotional',
    shortLabel: 'Stress Level (N)',
    text: 'How much emotional stress or pressure have you been carrying this past week?',
  },
  {
    id: 'emo_satisfaction',
    domain: 'emotional',
    shortLabel: 'Life Satisfaction',
    text: 'Overall, how satisfied are you with your life right now — your relationships, purpose, and day-to-day experience?',
  },
  {
    id: 'emo_connection',
    domain: 'emotional',
    shortLabel: 'Social Connection',
    text: 'Do you feel connected to the people in your life — like you belong and are genuinely cared for?',
  },
  {
    id: 'emo_purpose',
    domain: 'emotional',
    shortLabel: 'Sense of Purpose',
    text: 'Do you feel a sense of meaning or purpose in your daily life — like what you do matters?',
  },
];

// Items where higher raw score = better emotional state
const POSITIVE_ITEMS = ['emo_cheerfulness', 'emo_calmness', 'emo_optimism', 'emo_satisfaction', 'emo_connection', 'emo_purpose'];
// Items where higher raw score = worse emotional state (these are inverted for total score)
const NEGATIVE_ITEMS = ['emo_irritation', 'emo_stress'];

// ─── AI Scoring Prompt ──────────────────────────────────────────────────────

export function buildEmotionalScoringPrompt(answers: Record<string, string>): string {
  const qaPairs = EMOTIONAL_QUESTIONS.map(
    (q) => `[${q.id}] Q: ${q.text}\nA: ${answers[q.id] ?? '(no response)'}`
  ).join('\n\n');

  return `You are a clinical emotional well-being assessment scorer.

Score each answer 0, 1, 2, or 3 based on how frequently/intensely the user experiences each state:

For POSITIVE items (emo_cheerfulness, emo_calmness, emo_optimism, emo_satisfaction, emo_connection, emo_purpose):
  3 = Very often / strongly present
  2 = Often / moderately present
  1 = Rarely / slightly present
  0 = Almost never / absent

For NEGATIVE items (emo_irritation, emo_stress) — score the INTENSITY of the negative state:
  3 = Very often / very high
  2 = Often / moderately high
  1 = Rarely / low
  0 = Almost never / not present

User Answers:
${qaPairs}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "rawScores": {
    "emo_cheerfulness": <0-3>,
    "emo_calmness": <0-3>,
    "emo_optimism": <0-3>,
    "emo_irritation": <0-3>,
    "emo_stress": <0-3>,
    "emo_satisfaction": <0-3>,
    "emo_connection": <0-3>,
    "emo_purpose": <0-3>
  },
  "keyFactors": ["<2-4 notable emotional factors identified from responses>"],
  "interpretation": "<2-3 sentence clinical interpretation of their emotional well-being"
}`;
}

// ─── Score Computation ──────────────────────────────────────────────────────

export function computeEmotionalResult(
  rawScores: Record<string, number>,
  keyFactors: string[],
  interpretation: string
): EmotionalScore {
  const positiveScore = POSITIVE_ITEMS.reduce((sum, k) => sum + (rawScores[k] ?? 0), 0);
  const negativeScore = NEGATIVE_ITEMS.reduce((sum, k) => sum + (rawScores[k] ?? 0), 0);

  // Total: positive items contribute directly; negative items are inverted (3 - raw)
  const totalPositive = positiveScore;
  const totalNegativeInverted = NEGATIVE_ITEMS.reduce((sum, k) => sum + (3 - (rawScores[k] ?? 0)), 0);
  const totalScore = totalPositive + totalNegativeInverted; // max = 6*3 + 2*3 = 24

  let category: EmotionalScore['category'];
  let suggestions: string[];

  if (totalScore <= 8) {
    category = 'Low';
    suggestions = [
      'It sounds like you are going through a emotionally difficult time — please consider speaking with a counsellor or therapist.',
      'Small daily rituals of self-compassion — journaling, gentle movement, moments of gratitude — can begin to shift your emotional landscape.',
      'Reaching out to one trusted person in your life, even briefly, can make a real difference.',
      'Remind yourself: difficult feelings are temporary. You are not your worst moments.',
    ];
  } else if (totalScore <= 16) {
    category = 'Moderate';
    suggestions = [
      'Your emotional well-being is in a middle zone — nurturing it proactively will help maintain stability.',
      'Practices like mindfulness, intentional social connection, and creative expression can deepen positive affect.',
      'Check in with your stress sources — are there situations you can reduce, delegate, or reframe?',
      'A consistent routine with adequate sleep and physical activity significantly supports emotional regulation.',
    ];
  } else {
    category = 'High';
    suggestions = [
      'You show strong emotional well-being — that is worth acknowledging and protecting.',
      'Continue investing in relationships and activities that give you meaning and joy.',
      'Practice preventive self-care to maintain this balance during future stressful periods.',
      'Consider ways to share your emotional resilience with those around you who may be struggling.',
    ];
  }

  return {
    positiveScore,
    negativeScore,
    totalScore,
    category,
    keyFactors,
    interpretation,
    suggestions,
    rawScores,
  };
}
