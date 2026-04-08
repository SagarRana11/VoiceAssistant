/**
 * assessmentQuestions.ts
 * Complete question bank and domain definitions for the Well-Being Assessment.
 * These mirror the backend engine question arrays for UI-side orchestration.
 */

import { AssessmentDomain, AssessmentQuestion } from './assessmentTypes';

// ─── Physical Questions ───────────────────────────────────────────────────────

const PHYSICAL_QUESTIONS: AssessmentQuestion[] = [
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

// ─── Mental Questions (PHQ-9 + GAD-7) ────────────────────────────────────────

const MENTAL_QUESTIONS: AssessmentQuestion[] = [
  // PHQ-9 (Depression)
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
    text: 'Have you had trouble falling asleep, staying asleep, or found yourself sleeping too much?',
  },
  {
    id: 'phq_energy',
    domain: 'mental',
    shortLabel: 'Low Energy',
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
    text: 'Have you had trouble concentrating on things, like reading, watching something, or staying focused at work?',
  },
  {
    id: 'phq_psychomotor',
    domain: 'mental',
    shortLabel: 'Restlessness',
    text: 'Have you been moving or speaking more slowly than usual, or perhaps feeling unusually fidgety or restless?',
  },
  {
    id: 'phq_suicidality',
    domain: 'mental',
    shortLabel: 'Safety Check',
    text: 'This is an important question I ask everyone. Have you had any thoughts that you would be better off not being here, or any thoughts of hurting yourself?',
  },
  // GAD-7 (Anxiety)
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
    text: 'Have you been worrying a lot about different things — work, health, relationships, or the future?',
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
    shortLabel: 'Physical Restlessness',
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
    shortLabel: 'Sense of Dread',
    text: 'Have you been feeling afraid, as if something awful might happen — even if you cannot quite explain why?',
  },
];

// ─── Emotional Questions ──────────────────────────────────────────────────────

const EMOTIONAL_QUESTIONS: AssessmentQuestion[] = [
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
    shortLabel: 'Irritation',
    text: 'How often have you been feeling irritable, frustrated, or easily annoyed this week?',
  },
  {
    id: 'emo_stress',
    domain: 'emotional',
    shortLabel: 'Emotional Stress',
    text: 'How much emotional stress or pressure have you been carrying this past week?',
  },
  {
    id: 'emo_satisfaction',
    domain: 'emotional',
    shortLabel: 'Life Satisfaction',
    text: 'Overall, how satisfied are you with your life right now — your relationships, your sense of purpose, your day-to-day experience?',
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

// ─── Domain Definitions ───────────────────────────────────────────────────────

export const ASSESSMENT_DOMAINS: AssessmentDomain[] = [
  {
    id: 'physical',
    label: 'Physical Well-Being',
    icon: '🫀',
    color: '#ef4444',
    introText:
      "Let's start with your physical health. I'll ask you a few questions about your energy, sleep, and how your body has been feeling lately. Just share what's been true for you this past week.",
    outroText:
      "Thank you for sharing that. I've got a good picture of how your body has been doing. Let me move on to your mental well-being now.",
    questions: PHYSICAL_QUESTIONS,
  },
  {
    id: 'mental',
    label: 'Mental Well-Being',
    icon: '🧠',
    color: '#8b5cf6',
    introText:
      "Now let's gently explore your mental well-being. These questions are based on standard clinical assessments — they help me understand your mood, thought patterns, and anxiety levels. Please answer as honestly as you can. There is no right or wrong.",
    outroText:
      "Thank you for your openness — that took courage. I'll now check in on your emotional well-being.",
    questions: MENTAL_QUESTIONS,
  },
  {
    id: 'emotional',
    label: 'Emotional Well-Being',
    icon: '💛',
    color: '#f59e0b',
    introText:
      "Finally, let's look at your emotional well-being — how you've been feeling inside, your sense of connection to others, and your relationship with life right now. Take your time with each answer.",
    outroText:
      "That's really helpful. Thank you for walking through all of this with me. Let me put together your complete well-being picture now.",
    questions: EMOTIONAL_QUESTIONS,
  },
];

// ─── Acknowledgment pools (randomised per answer) ────────────────────────────

export const ACKNOWLEDGMENTS = {
  general: [
    "I hear you, thank you for sharing that.",
    "Thank you for being open with me.",
    "That's helpful to know, I appreciate it.",
    "Okay, I've noted that — thank you.",
    "I appreciate you sharing that with me.",
    "Thank you for your honesty.",
  ],
  mental: [
    "Thank you for sharing something so personal.",
    "I really appreciate your honesty — that takes courage.",
    "I hear you, and what you're feeling is completely valid.",
    "Thank you for trusting me with that.",
    "That's important for me to know — thank you for telling me.",
  ],
  emotional: [
    "That really tells me something important — thank you.",
    "I appreciate you reflecting on that.",
    "Thank you for sharing how you feel.",
    "I hear you, thank you.",
    "That's meaningful to acknowledge — thank you.",
  ],
};

// ─── Safety Protocol ──────────────────────────────────────────────────────────

export const SAFETY_MESSAGE =
  "Thank you for being so honest with me — what you just shared is really important, and I want you to know I take it seriously. " +
  "If you're having thoughts of hurting yourself, please know that support is available right now. " +
  "You can reach the 988 Suicide and Crisis Lifeline by calling or texting 9-8-8. You are not alone in this. " +
  "I'm pausing our assessment here because your safety is what matters most right now. Please reach out.";

// ─── Helper: pick random acknowledgment ──────────────────────────────────────

export function getAcknowledgment(domain: AssessmentDomain['id']): string {
  const pool =
    domain === 'mental'   ? ACKNOWLEDGMENTS.mental :
    domain === 'emotional' ? ACKNOWLEDGMENTS.emotional :
    ACKNOWLEDGMENTS.general;
  return pool[Math.floor(Math.random() * pool.length)];
}
