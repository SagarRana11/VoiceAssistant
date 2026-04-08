import { create } from 'zustand';

export interface UserProfile {
  _id?: string;
  userId?: string;
  height?: number;
  weight?: number;
  age?: number;
  gender?: string;
  activityLevel?: string;
  fitnessGoal?: string;
  dietPreference?: string;
  allergies?: string[];
  diseases?: string[];
  sleepHours?: number;
  stressLevel?: number;
  availableTimePerDay?: number;
  injuries?: string[];
  completeness?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ProfileStore {
  profile: UserProfile | null;
  isLoading: boolean;
  lastFetchedAt: number | null;
  setProfile: (p: UserProfile) => void;
  updateField: (field: keyof UserProfile, value: unknown) => void;
  setLoading: (v: boolean) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileStore>((set) => ({
  profile: null,
  isLoading: false,
  lastFetchedAt: null,

  setProfile: (profile) =>
    set({ profile, lastFetchedAt: Date.now() }),

  updateField: (field, value) =>
    set((state) => ({
      profile: state.profile
        ? { ...state.profile, [field]: value }
        : ({ [field]: value } as UserProfile),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  clearProfile: () => set({ profile: null, lastFetchedAt: null }),
}));
