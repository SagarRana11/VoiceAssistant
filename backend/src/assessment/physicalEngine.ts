/**
 * physicalEngine.ts
 * Physical Well-Being domain: 6-question assessment (0–18 scale)
 * Categories: Poor | Fair | Good | Excellent
 */

export interface AssessmentQuestion {
  id: string;
  domain: string;
  shortLabel: string;
  text: string;
}

export interface PhysicalScore {
  score: number;
  maxScore: 18;
  category: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  keyFactors: string[];
  interpretation: string;
  suggestions: string[];
  rawScores: Record<string, number>;
}

// ─── Question Bank ──────────────────────────────────────────────────────────

export const PHYSICAL_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'phys_energy',
    domain: 'physical',
    shortLabel: 'Energy & Fatigue',
    text: 'How would you describe your energy levels over the past week? Have you been feeling tired or fatigued throughout the day?',
  },
  {
    id: 'phys_sleep',
    domain: 'physical',
    shortLabel: 'Sleep Quality',
    text: 'How has your sleep been lately? Are you getting enough rest, and do you generally wake up feeling refreshed?',
  },
  {
    id: 'phys_pain',
    domain: 'physical',
    shortLabel: 'Pain & Discomfort',
    text: 'Have you been experiencing any physical pain, aches, or discomfort in the past week? If so, how has it been affecting you?',
  },
  {
    id: 'phys_exercise',
    domain: 'physical',
    shortLabel: 'Physical Activity',
    text: 'How often have you been physically active or exercising this past week? What kinds of activities have you been doing?',
  },
  {
    id: 'phys_diet',
    domain: 'physical',
    shortLabel: 'Diet & Nutrition',
    text: 'How would you describe your eating habits recently? Are you eating regular, balanced meals, or has your appetite or diet changed at all?',
  },
  {
    id: 'phys_function',
    domain: 'physical',
    shortLabel: 'Daily Functioning',
    text: 'Has your physical health been getting in the way of things you want or need to do — like work, household tasks, or spending time with others?',
  },
];

// ─── AI Scoring Prompt ──────────────────────────────────────────────────────

export function buildPhysicalScoringPrompt(answers: Record<string, string>): string {
  const qaPairs = PHYSICAL_QUESTIONS.map(
    (q) => `[${q.id}] Q: ${q.text}\nA: ${answers[q.id] ?? '(no response)'}`
  ).join('\n\n');

  return `You are a clinical health assessment scorer. Evaluate the user's answers and assign a score (0, 1, 2, or 3) for each physical well-being dimension.

SCORING GUIDE:

phys_energy — energy/fatigue level:
  3 = good/excellent energy, rarely tired
  2 = mostly fine, occasionally tired
  1 = often fatigued, low energy most days
  0 = severe persistent exhaustion

phys_sleep — sleep quality and restoration:
  3 = 7-9 hrs, wakes refreshed, consistent
  2 = mostly ok, some poor nights
  1 = frequently poor, tired on waking
  0 = very poor sleep, rarely rested

phys_pain — pain/discomfort level:
  3 = no significant pain or discomfort
  2 = mild, occasional, manageable
  1 = moderate, somewhat limiting
  0 = severe or chronic, significantly limiting

phys_exercise — physical activity frequency/intensity:
  3 = 4+ days/week of moderate-vigorous activity
  2 = 2-3 days/week of moderate activity
  1 = 1 day/week or only light walking
  0 = sedentary, no intentional exercise

phys_diet — nutritional quality and regularity:
  3 = balanced, regular meals, good variety
  2 = mostly healthy with some lapses
  1 = irregular, poor food choices often
  0 = very poor diet, skipping meals, junk food dominant

phys_function — physical health limiting daily activities:
  3 = no limitation
  2 = minor limitations, does most things
  1 = moderate limitation, missing activities
  0 = severely limited in daily activities

User Answers:
${qaPairs}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "rawScores": {
    "phys_energy": <0-3>,
    "phys_sleep": <0-3>,
    "phys_pain": <0-3>,
    "phys_exercise": <0-3>,
    "phys_diet": <0-3>,
    "phys_function": <0-3>
  },
  "keyFactors": ["<2-4 specific factors identified from responses>"],
  "interpretation": "<2-3 sentence clinical interpretation of their physical health status>"
}`;
}

// ─── Score Computation ──────────────────────────────────────────────────────

export function computePhysicalResult(
  rawScores: Record<string, number>,
  keyFactors: string[],
  interpretation: string
): PhysicalScore {
  const score = Object.values(rawScores).reduce((sum, s) => sum + (s ?? 0), 0);
  const maxScore = 18 as const;

  let category: PhysicalScore['category'];
  let suggestions: string[];

  if (score <= 5) {
    category = 'Poor';
    suggestions = [
      'Consider scheduling a check-up with your healthcare provider soon.',
      'Start with very gentle activity — even 5–10 minutes of walking daily is a meaningful step.',
      'Prioritize consistent sleep times to help regulate your energy throughout the day.',
      'Focus on simple, regular meals — small improvements in nutrition can have a noticeable impact.',
    ];
  } else if (score <= 10) {
    category = 'Fair';
    suggestions = [
      'Aim for 20–30 minutes of moderate activity at least 3 days per week.',
      'Try to establish a consistent sleep schedule — the same bedtime each night helps greatly.',
      'Add one more serving of vegetables or whole grains to your daily meals.',
      'If any pain persists beyond a week, consider speaking with a healthcare professional.',
    ];
  } else if (score <= 14) {
    category = 'Good';
    suggestions = [
      'You are doing well — keep building on your existing healthy habits.',
      'Consider adding variety to your exercise routine to stay motivated and engaged.',
      'Focus on sleep consistency to optimize your recovery and energy.',
      'Small nutritional tweaks can move you from good to excellent over time.',
    ];
  } else {
    category = 'Excellent';
    suggestions = [
      'You are maintaining excellent physical health — that is genuinely impressive.',
      'Focus on long-term sustainability and injury prevention in your exercise routine.',
      'Schedule regular preventive check-ups to stay ahead of any emerging issues.',
      'Consider sharing your healthy habits with those around you — your consistency is inspiring.',
    ];
  }

  return { score, maxScore, category, keyFactors, interpretation, suggestions, rawScores };
}
