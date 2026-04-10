/**
 * assessmentTypes.ts
 * Shared TypeScript types for the Well-Being Assessment feature (frontend)
 */

// ─── Domain identifiers ──────────────────────────────────────────────────────

export type DomainId = 'physical' | 'mental' | 'emotional';

// ─── State machine phases ────────────────────────────────────────────────────

export type AssessmentPhase =
  | 'idle'              // Not started
  | 'intro'             // Playing welcome introduction
  | 'domain_intro'      // Introducing current domain
  | 'asking'            // Assistant speaking the question
  | 'listening'         // Mic active, waiting for user answer
  | 'acknowledging'     // Assistant acknowledging the answer
  | 'scoring_domain'    // API call to score domain answers
  | 'domain_summary'    // Assistant reading domain result aloud
  | 'final_scoring'     // API call for final consolidated report
  | 'report'            // Displaying full final report
  | 'paused'            // User paused the assessment
  | 'error';            // Unrecoverable error

// ─── Question definition ──────────────────────────────────────────────────────

export interface AssessmentQuestion {
  id: string;
  domain: DomainId;
  shortLabel: string;    // Used in progress indicator e.g. "Sleep Quality"
  text: string;          // Full conversational question text (spoken by assistant)
  options?: string[];    // Selectable answer options for text mode (when voice is off)
}

// ─── Domain definition ────────────────────────────────────────────────────────

export interface AssessmentDomain {
  id: DomainId;
  label: string;          // "Physical Well-Being"
  icon: string;           // Emoji icon
  color: string;          // Theme color hex
  introText: string;      // Spoken by assistant before first question
  outroText: string;      // Spoken after domain scoring is done
  questions: AssessmentQuestion[];
}

// ─── Domain scores (mirrors backend engine outputs) ──────────────────────────

export interface PhysicalScore {
  score: number;
  maxScore: number;
  category: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  keyFactors: string[];
  interpretation: string;
  suggestions: string[];
  rawScores: Record<string, number>;
}

export interface MentalScore {
  depressionScore: number;
  anxietyScore: number;
  categorySummary: {
    depression: 'Minimal' | 'Mild' | 'Moderate' | 'Moderately Severe' | 'Severe';
    anxiety:    'Minimal' | 'Mild' | 'Moderate' | 'Severe';
  };
  keySymptoms: string[];
  suggestions: string[];
  riskFlag: boolean;
  rawScores: Record<string, number>;
}

export interface EmotionalScore {
  positiveScore: number;
  negativeScore: number;
  totalScore: number;
  category: 'Low' | 'Moderate' | 'High';
  keyFactors: string[];
  interpretation: string;
  suggestions: string[];
  rawScores: Record<string, number>;
}

export type DomainScore = PhysicalScore | MentalScore | EmotionalScore;

// ─── Final consolidated report ────────────────────────────────────────────────

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

// ─── Assessment session state ─────────────────────────────────────────────────

export interface AssessmentState {
  phase: AssessmentPhase;
  domainIndex: number;            // 0 = physical, 1 = mental, 2 = emotional
  questionIndex: number;          // within current domain
  answers: Record<string, string>;// questionId → user answer text
  interimTranscript: string;      // live partial speech-to-text
  domainResults: {
    physical?: PhysicalScore;
    mental?:   MentalScore;
    emotional?: EmotionalScore;
  };
  finalReport?: FinalReport;
  assessmentId?: string;          // MongoDB document ID after save
  error: string | null;
}

// ─── API response types ───────────────────────────────────────────────────────

export interface ScoreDomainResponse {
  success: boolean;
  domain: DomainId;
  result: DomainScore;
}

export interface GenerateReportResponse {
  success: boolean;
  assessmentId: string;
  overallCategory: FinalReport['overallCategory'];
  fullReport: FinalReport;
}

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseAssessmentReturn {
  assessmentState: AssessmentState;
  isActive: boolean;
  currentDomain: AssessmentDomain | null;
  currentQuestion: AssessmentQuestion | null;
  progress: { domainLabel: string; current: number; total: number } | null;
  startAssessment: () => void;
  pauseAssessment: () => void;
  resumeAssessment: () => void;
  stopAssessment: () => void;
  submitAnswer: (answer: string) => void;
  waitingForTextAnswer: boolean;
}
