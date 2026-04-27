import { create } from 'zustand';

export interface HospitalPatient {
  _id: string;
  name: string;
  age: number;
  gender: string;
  preferredLanguage: string;
  diagnosis: string;
  plannedProcedure: string;
  doctorName: string;
  riskFactors: string;
}

export interface HospitalSession {
  _id: string;
  patientId: string;
  stage: 'enrolled' | 'consent' | 'procedure_done' | 'discharge' | 'followup';
  consentCompleted: boolean;
  dischargeCompleted: boolean;
}

interface HospitalStore {
  patient:   HospitalPatient | null;
  session:   HospitalSession | null;
  setPatient: (p: HospitalPatient) => void;
  setSession: (s: HospitalSession) => void;
  clearPatient: () => void;
}

export const useHospitalStore = create<HospitalStore>((set) => ({
  patient: null,
  session: null,

  setPatient: (patient) => set({ patient }),
  setSession: (session) => set({ session }),

  clearPatient: () => set({ patient: null, session: null }),
}));
