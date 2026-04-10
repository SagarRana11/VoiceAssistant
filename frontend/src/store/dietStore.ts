import { create } from 'zustand';

export interface MacroSplit {
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

export interface DietPlan {
  _id?: string;
  planId?: string;
  planDuration: 'daily' | 'weekly' | 'monthly';
  calorieTarget: number;
  bmi: number;
  macroSplit: MacroSplit;
  mealStructure: string;
  breakfastOptions: string[];
  lunchOptions: string[];
  dinnerOptions: string[];
  snackOptions: string[];
  hydrationAdvice: string;
  restrictionNotes: string[];
  substitutionSuggestions: string[];
  planSummary: string;
  generatedAt?: string;
}

export interface DietPlanSummary {
  _id: string;
  planSummary: string;
  calorieTarget: number;
  bmi: number;
  planDuration: string;
  generatedAt: string;
  createdAt: string;
}

interface DietStore {
  currentPlan: DietPlan | null;
  planId: string | null;
  isGenerating: boolean;
  history: DietPlanSummary[];
  historyLoading: boolean;
  setPlan: (plan: DietPlan, id: string) => void;
  setGenerating: (v: boolean) => void;
  clearPlan: () => void;
  setHistory: (h: DietPlanSummary[]) => void;
  setHistoryLoading: (v: boolean) => void;
}

export const useDietStore = create<DietStore>((set) => ({
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
