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

interface DietStore {
  currentPlan: DietPlan | null;
  planId: string | null;
  isGenerating: boolean;
  setPlan: (plan: DietPlan, id: string) => void;
  setGenerating: (v: boolean) => void;
  clearPlan: () => void;
}

export const useDietStore = create<DietStore>((set) => ({
  currentPlan: null,
  planId: null,
  isGenerating: false,

  setPlan: (plan, planId) => set({ currentPlan: plan, planId }),
  setGenerating: (isGenerating) => set({ isGenerating }),
  clearPlan: () => set({ currentPlan: null, planId: null }),
}));
