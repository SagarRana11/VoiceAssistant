/**
 * emotionDetector.ts
 * Infers emotional context from the user's message.
 * Drives speaking rate, pause duration, and filler frequency in TTS.
 */

export type EmotionState = 'supportive' | 'excited' | 'concerned' | 'neutral';
export type PaceState    = 'slow'       | 'normal'  | 'fast';
export type EnergyState  = 'low'        | 'medium'  | 'high';

export interface ConversationState {
  emotion: EmotionState;
  pace:    PaceState;
  energy:  EnergyState;
}

export const DEFAULT_STATE: ConversationState = {
  emotion: 'neutral',
  pace:    'normal',
  energy:  'medium',
};

// ─── Keyword sets ─────────────────────────────────────────────────────────────
const SAD_KEYWORDS = [
  'sad', 'depressed', 'depression', 'crying', 'cry', 'tears', 'lonely', 'alone',
  'hurt', 'pain', 'grief', 'hopeless', 'worthless', 'tired', 'exhausted', 'numb',
  'empty', 'broken', 'scared', 'anxious', 'anxiety', 'overwhelmed', 'lost',
  'can\'t cope', 'falling apart', 'giving up', 'no point',
];

const EXCITED_KEYWORDS = [
  'excited', 'amazing', 'great', 'awesome', 'fantastic', 'wonderful', 'love it',
  'happy', 'thrilled', 'motivated', 'pumped', 'ready', 'let\'s go', 'yes!',
  'perfect', 'nailed it', 'crushing it', 'can\'t wait', 'so good',
];

const CONCERNED_KEYWORDS = [
  'help', 'problem', 'issue', 'not sure', 'confused', 'don\'t know', 'struggling',
  'stuck', 'difficult', 'hard time', 'can\'t figure', 'failing', 'afraid',
  'nervous', 'worried', 'stress', 'stressed', 'pressure', 'overwhelm',
];

// ─── Detection ────────────────────────────────────────────────────────────────
export function detectConversationState(userMessage: string): ConversationState {
  const lower = userMessage.toLowerCase();

  const score = (keywords: string[]) =>
    keywords.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);

  const sadScore      = score(SAD_KEYWORDS);
  const excitedScore  = score(EXCITED_KEYWORDS);
  const concernedScore = score(CONCERNED_KEYWORDS);

  const max = Math.max(sadScore, excitedScore, concernedScore);
  if (max === 0) return DEFAULT_STATE;

  if (sadScore === max)       return { emotion: 'supportive', pace: 'slow',   energy: 'low' };
  if (excitedScore === max)   return { emotion: 'excited',    pace: 'fast',   energy: 'high' };
  if (concernedScore === max) return { emotion: 'concerned',  pace: 'slow',   energy: 'medium' };

  return DEFAULT_STATE;
}

// ─── TTS parameters from state ────────────────────────────────────────────────

/** Speech rate for SpeechSynthesisUtterance.rate */
export function getSpeakingRate(state: ConversationState): number {
  switch (state.pace) {
    case 'slow':  return 0.82;
    case 'fast':  return 1.05;
    default:      return 0.92;
  }
}

/** Pause in ms to insert between sentence chunks */
export function getInterChunkPause(state: ConversationState): number {
  switch (state.pace) {
    case 'slow':  return 600;
    case 'fast':  return 180;
    default:      return 320;
  }
}

/** Pitch for SpeechSynthesisUtterance.pitch */
export function getSpeakingPitch(state: ConversationState): number {
  switch (state.emotion) {
    case 'excited':    return 1.12;
    case 'supportive': return 0.95;
    case 'concerned':  return 0.98;
    default:           return 1.0;
  }
}

/** How often to inject filler words (0-1 probability) */
export function getFillerProbability(state: ConversationState): number {
  switch (state.energy) {
    case 'low':    return 0.45;
    case 'high':   return 0.2;
    default:       return 0.3;
  }
}
