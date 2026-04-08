import { create } from 'zustand';

export interface MeditationStep {
  step: number;
  title: string;
  instruction: string;
  duration: string;
}

export interface WeeklyMeditationDay {
  day: string;
  sessionType: string;
  duration: number;
  isRestDay?: boolean;
  focus?: string;
}

export interface MeditationPlan {
  _id?: string;
  planId?: string;
  level: 'beginner' | 'moderate' | 'advanced';
  planDuration: 'daily' | 'weekly' | 'monthly';
  sessionDuration: number;
  weeklyStructure: WeeklyMeditationDay[];
  breathingExercises: string[];
  meditationType: string[];
  stepByStepGuide: MeditationStep[];
  environmentTips: string[];
  progressionAdvice: string;
  calmingMusicSuggestion: string[];
  planSummary: string;
  generatedAt?: string;
}

interface MeditationStore {
  currentPlan: MeditationPlan | null;
  planId: string | null;
  isGenerating: boolean;
  isMeditationModeActive: boolean;
  currentStep: number;
  setPlan: (plan: MeditationPlan, id: string) => void;
  setGenerating: (v: boolean) => void;
  clearPlan: () => void;
  startMeditationMode: () => void;
  exitMeditationMode: () => void;
  setCurrentStep: (step: number) => void;
}

export const useMeditationStore = create<MeditationStore>((set) => ({
  currentPlan: null,
  planId: null,
  isGenerating: false,
  isMeditationModeActive: false,
  currentStep: 0,

  setPlan: (plan, planId) => set({ currentPlan: plan, planId }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  clearPlan: () => set({ currentPlan: null, planId: null, isMeditationModeActive: false, currentStep: 0 }),
  startMeditationMode: () => set({ isMeditationModeActive: true, currentStep: 0 }),
  exitMeditationMode: () => set({ isMeditationModeActive: false, currentStep: 0 }),
  setCurrentStep: (currentStep) => set({ currentStep }),
}));
