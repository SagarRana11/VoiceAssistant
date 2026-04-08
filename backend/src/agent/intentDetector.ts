export type AgentIntent =
  | 'exercise_plan'
  | 'diet_plan'
  | 'meditation'
  | 'well_being_assessment'
  | 'update_profile'
  | 'view_profile'
  | 'general_chat';

interface IntentPattern {
  intent: AgentIntent;
  patterns: RegExp[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'exercise_plan',
    patterns: [
      /\b(workout|exercise|training|gym|fitness)\s*(plan|routine|program|schedule)\b/i,
      /\bcreate\s*(me\s*)?(a\s*)?(workout|exercise|training|fitness)\b/i,
      /\bmake\s*(me\s*)?(a\s*)?(workout|exercise|training|fitness)\b/i,
      /\bget\s*(me\s*)?(in\s*)?shape\b/i,
      /\bstart\s*(working\s*out|exercising|training)\b/i,
      /\bweight\s*loss\s*plan\b/i,
      /\bmuscle\s*(gain|building|grow)\b/i,
      /\bbuild\s*(muscle|strength)\b/i,
      /\blose\s*weight\b/i,
      /\bexercise\s*plan\b/i,
      /\bfitness\s*plan\b/i,
    ],
  },
  {
    intent: 'diet_plan',
    patterns: [
      /\b(diet|meal|nutrition|eating|food)\s*(plan|program|schedule|prep)\b/i,
      /\bwhat\s*should\s*i\s*eat\b/i,
      /\bcalorie\s*(plan|deficit|surplus)\b/i,
      /\bmake\s*(me\s*)?(a\s*)?(diet|meal|nutrition)\b/i,
      /\bcreate\s*(me\s*)?(a\s*)?(diet|meal|nutrition)\b/i,
      /\bweekly\s*(diet|meal)\s*plan\b/i,
      /\bfat\s*loss\s*diet\b/i,
      /\bi\s*(am|want to be)\s*vegan\b/i,
      /\bvegan\s*suggest\b/i,
      /\bsuggested?\s*food\b/i,
      /\bweight\s*loss\s*(diet|food|eating)\b/i,
    ],
  },
  {
    intent: 'meditation',
    patterns: [
      /\bmeditat(e|ion|ing)\b/i,
      /\bmindfulness\b/i,
      /\bbreathing\s*exercise\b/i,
      /\bstart\s*meditation\b/i,
      /\bguided\s*(breathing|relax|meditation)\b/i,
      /\bsuggest\s*meditation\b/i,
      /\bi\s*(feel|am)\s*(stressed|anxious|stressed out|overwhelmed)\b/i,
      /\brelaxation\s*(plan|technique|exercise)\b/i,
      /\bweekly\s*meditation\s*(plan|routine)\b/i,
      /\bcreate\s*(me\s*)?(a\s*)?meditation\b/i,
      /\bmake\s*(me\s*)?(a\s*)?meditation\b/i,
      /\bstress\s*(relief|reduction|management)\s*(plan|technique)?\b/i,
    ],
  },
  {
    intent: 'update_profile',
    patterns: [
      /\b(update|change|edit|set|save|correct)\s*(my\s*)?(profile|weight|height|age|goal|fitness goal|activity)\b/i,
      /\bmy\s*(weight|height|age|goal)\s*is\b/i,
      /\bi\s*(weigh|am)\s*\d+\s*(kg|lbs|pounds|kilos|cm|centimeter)?\b/i,
      /\bi'm\s*\d+\s*(years\s*old|kg|lbs|cm)\b/i,
    ],
  },
  {
    intent: 'view_profile',
    patterns: [
      /\b(show|view|see|open|check)\s*(my\s*)?profile\b/i,
      /\bwhat\s*(do\s*you\s*know|have\s*you\s*saved|info\s*do\s*you\s*have)\s*about\s*me\b/i,
      /\bmy\s*health\s*data\b/i,
    ],
  },
  {
    intent: 'well_being_assessment',
    patterns: [
      /\b(start|begin|take|do|run)\s*(a\s*)?(well.?being|wellness|health|mental)\s*assessment\b/i,
      /\bhow\s*am\s*i\s*doing\b/i,
      /\bcheck\s*my\s*(mental|physical|emotional)\s*health\b/i,
    ],
  },
];

/**
 * Fast regex-based intent classifier.
 * Returns 'general_chat' when nothing matches.
 */
export function detectIntent(message: string): AgentIntent {
  const lower = message.trim();
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some(p => p.test(lower))) return intent;
  }
  return 'general_chat';
}
