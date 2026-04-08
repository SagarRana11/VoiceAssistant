/**
 * reportGenerator.ts
 * Final consolidated Well-Being Report Generator
 *
 * Takes all 3 domain scores, calls OpenAI once to generate a structured
 * narrative report. Non-diagnostic, clinical tone, concise.
 */

import { PhysicalScore } from './physicalEngine';
import { MentalScore } from './mentalEngine';
import { EmotionalScore } from './emotionalEngine';

export interface FinalReport {
  overallCategory: 'Needs Attention' | 'Fair' | 'Good' | 'Thriving';
  overallSummary: string;
  strengthAreas: string[];
  concernAreas: string[];
  behaviouralSuggestions: string[];
  lifestyleRecommendations: string[];
  seekProfessionalHelp: string;
  generatedAt: string;
}

// ─── Overall Category Derivation ────────────────────────────────────────────

export function deriveOverallCategory(
  physical: PhysicalScore,
  mental: MentalScore,
  emotional: EmotionalScore
): FinalReport['overallCategory'] {
  // Normalize each domain to 0–100
  const physPct = (physical.score / physical.maxScore) * 100;
  const mentalPct =
    100 -
    (((mental.depressionScore / 27) * 100 + (mental.anxietyScore / 21) * 100) / 2);
  const emotPct = (emotional.totalScore / 24) * 100;

  const average = (physPct + mentalPct + emotPct) / 3;

  if (average < 35) return 'Needs Attention';
  if (average < 55) return 'Fair';
  if (average < 75) return 'Good';
  return 'Thriving';
}

// ─── AI Report Prompt ────────────────────────────────────────────────────────

export function buildFinalReportPrompt(
  physical: PhysicalScore,
  mental: MentalScore,
  emotional: EmotionalScore
): string {
  return `You are a clinical well-being report writer. Based on the three domain assessment scores below, generate a structured, concise, non-diagnostic wellness report. Write in a warm but professional clinical tone. Do NOT diagnose. Focus on observable patterns and actionable guidance.

=== ASSESSMENT RESULTS ===

PHYSICAL WELL-BEING:
  Score: ${physical.score}/18 — ${physical.category}
  Key Factors: ${physical.keyFactors.join(', ')}
  Interpretation: ${physical.interpretation}

MENTAL WELL-BEING:
  Depression (PHQ-9): ${mental.depressionScore}/27 — ${mental.categorySummary.depression}
  Anxiety (GAD-7): ${mental.anxietyScore}/21 — ${mental.categorySummary.anxiety}
  Key Symptoms: ${mental.keySymptoms.join(', ')}
  Risk Flag: ${mental.riskFlag ? 'YES — safety concern present' : 'No'}

EMOTIONAL WELL-BEING:
  Score: ${emotional.totalScore}/24 — ${emotional.category}
  Positive Affect: ${emotional.positiveScore}/18
  Negative Affect (raw): ${emotional.negativeScore}/6
  Key Factors: ${emotional.keyFactors.join(', ')}
  Interpretation: ${emotional.interpretation}

Generate a report with these exact fields. Each item in arrays should be 1-2 sentences max. overallSummary should be 3-4 sentences. seekProfessionalHelp should be 1-2 clear sentences indicating when/whether professional support is appropriate.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "overallSummary": "<3-4 sentence holistic summary of the person's well-being profile>",
  "strengthAreas": ["<2-3 genuine strength areas based on their scores>"],
  "concernAreas": ["<2-4 areas that need attention — or empty array if none>"],
  "behaviouralSuggestions": ["<3-4 concrete behaviour changes they can make this week>"],
  "lifestyleRecommendations": ["<3-4 medium-term lifestyle changes for sustained well-being>"],
  "seekProfessionalHelp": "<1-2 sentences: when/whether they should seek professional support>"
}`;
}

// ─── Mock Report (fallback when no API key) ──────────────────────────────────

export function buildMockFinalReport(
  physical: PhysicalScore,
  mental: MentalScore,
  emotional: EmotionalScore,
  overallCategory: FinalReport['overallCategory']
): FinalReport {
  return {
    overallCategory,
    overallSummary: `Based on your responses, your overall well-being is in the "${overallCategory}" range. Your physical health scored ${physical.score}/18 (${physical.category}), your mental health shows ${mental.categorySummary.depression.toLowerCase()} depression and ${mental.categorySummary.anxiety.toLowerCase()} anxiety, and your emotional well-being scored ${emotional.totalScore}/24 (${emotional.category}). This assessment provides a snapshot — your well-being is dynamic and can improve with consistent, intentional effort.`,
    strengthAreas: physical.category === 'Good' || physical.category === 'Excellent'
      ? ['Physical activity and energy management']
      : ['Commitment to self-reflection and awareness'],
    concernAreas: mental.depressionScore > 9
      ? ['Mental health requires attention — consider professional support']
      : [],
    behaviouralSuggestions: [
      'Establish a consistent sleep and wake time each day.',
      'Incorporate 20 minutes of physical activity at least 3 times this week.',
      'Reach out to one person in your support network this week.',
    ],
    lifestyleRecommendations: [
      'Build a sustainable sleep hygiene routine.',
      'Cultivate at least one daily mindfulness or relaxation practice.',
      'Review and reduce major stressors where possible.',
    ],
    seekProfessionalHelp: mental.depressionScore > 14 || mental.riskFlag
      ? 'Based on your responses, speaking with a mental health professional soon is strongly recommended.'
      : 'If any symptoms worsen or persist, please consult your primary care provider or a mental health professional.',
    generatedAt: new Date().toISOString(),
  };
}
