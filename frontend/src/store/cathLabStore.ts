import { create } from 'zustand';

export interface CathLabPatient {
  _id: string;
  patientName: string;
  dob: string;
  mrn: string;
  procedureDate: string;
}

export interface CathLabSession {
  _id: string;
  patientId: string;
  currentModule: number;
  currentStep: string;
  status: 'in_progress' | 'completed';
  verbalConsentGiven: 'yes' | 'no' | 'deferred' | null;
}

export interface CathLabFlag {
  type: string;
  message: string;
  module: number;
  raisedAt: string;
}

export interface CathLabHPRecord {
  // Module 2
  chiefComplaint: string;
  painCharacter: string;
  painLocation: string;
  painRadiation: string;
  painSeverity: string;
  onset: string;
  durationPerEpisode: string;
  exertionalVsRest: string;
  exertionalQuantified: string;
  relievingFactors: string;
  aggravatingFactors: string;
  dyspnea: string;
  orthopnea: string;
  pnd: string;
  edema: string;
  palpitations: string;
  presyncope: string;
  syncope: string;
  fatigue: string;
  // Module 3
  htn: string;
  hyperlipidemia: string;
  diabetes: string;
  knownCAD: string;
  priorMI: string;
  priorPCI_CABG: string;
  heartFailure: string;
  priorCath: string;
  cva_tia: string;
  ckd: string;
  pad: string;
  thyroidDisease: string;
  bleedingHistory: string;
  tobacco: string;
  diet: string;
  exercise: string;
  alcohol: string;
  recreationalDrugUse: string;
  familyHistory: string;
  ros_constitutional: string;
  ros_neuro: string;
  ros_pulmonary: string;
  ros_gi: string;
  ros_gu: string;
  ros_msk: string;
  ros_heme: string;
  ros_endocrine: string;
  additionalConcerns: string;
  // Module 4
  medications: string;
  anticoagulants: string;
  pde5Inhibitors: string;
  allergies: string;
  contrastAllergy: string;
  // Module 5
  echoResults: string;
  stressTestResults: string;
  cctaResults: string;
  labConcerns: string;
  // Module 6
  patientConcerns: string;
  verbalConsent: string;
}

interface CathLabStore {
  patient: CathLabPatient | null;
  session: CathLabSession | null;
  hpRecord: Partial<CathLabHPRecord>;
  flags: CathLabFlag[];
  capturedCount: number;

  setPatient: (p: CathLabPatient) => void;
  setSession: (s: CathLabSession) => void;
  updateHPField: (field: string, value: string) => void;
  addFlag: (flag: CathLabFlag) => void;
  advanceStep: (nextStep: string, nextModule: number) => void;
  clearAll: () => void;
}

export const useCathLabStore = create<CathLabStore>((set) => ({
  patient: null,
  session: null,
  hpRecord: {},
  flags: [],
  capturedCount: 0,

  setPatient: (patient) => set({ patient }),

  setSession: (session) => set({ session }),

  updateHPField: (field, value) =>
    set((state) => ({
      hpRecord: { ...state.hpRecord, [field]: value },
      capturedCount: state.capturedCount + (state.hpRecord[field as keyof CathLabHPRecord] ? 0 : 1),
    })),

  addFlag: (flag) =>
    set((state) => {
      if (state.flags.some((f) => f.type === flag.type)) return state;
      return { flags: [...state.flags, flag] };
    }),

  advanceStep: (nextStep, nextModule) =>
    set((state) => ({
      session: state.session
        ? { ...state.session, currentStep: nextStep, currentModule: nextModule }
        : null,
    })),

  clearAll: () =>
    set({ patient: null, session: null, hpRecord: {}, flags: [], capturedCount: 0 }),
}));
