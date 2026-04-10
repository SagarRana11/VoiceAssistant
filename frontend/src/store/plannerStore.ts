import { create } from 'zustand';

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
  restTime?: string;
  notes?: string;
}

export interface DailyWorkout {
  day: string;
  focus: string;
  isRestDay?: boolean;
  warmup?: string;
  exercises?: Exercise[];
  cooldown?: string;
  estimatedDuration?: number;
}

export interface ExercisePlan {
  _id?: string;
  planId?: string;
  weeklySchedule: DailyWorkout[];
  progressionAdvice: string;
  safetyNotes: string;
  planSummary: string;
  durationWeeks: number;
  generatedAt?: string;
}

export interface ExercisePlanSummary {
  _id: string;
  planSummary: string;
  durationWeeks: number;
  generatedAt: string;
  createdAt: string;
}

interface PlannerStore {
  currentPlan: ExercisePlan | null;
  planId: string | null;
  isGenerating: boolean;
  history: ExercisePlanSummary[];
  historyLoading: boolean;
  setPlan: (plan: ExercisePlan, id: string) => void;
  setGenerating: (v: boolean) => void;
  clearPlan: () => void;
  setHistory: (h: ExercisePlanSummary[]) => void;
  setHistoryLoading: (v: boolean) => void;
}

export const usePlannerStore = create<PlannerStore>((set) => ({
  currentPlan: null,
  planId: null,
  isGenerating: false,
  history: [],
  historyLoading: false,

  setPlan: (plan, planId) => set({ currentPlan: plan, planId }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  clearPlan: () => set({ currentPlan: null, planId: null }),
  setHistory: (history) => set({ history }),
  setHistoryLoading: (historyLoading) => set({ historyLoading }),
}));
