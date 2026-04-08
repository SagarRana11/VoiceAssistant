// ─── Assistant State Machine ───────────────────────────────────────────────
export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

// ─── Roles ─────────────────────────────────────────────────────────────────
export type RoleId = 'therapist' | 'health' | 'career' | 'fitness';

export interface Role {
  id: RoleId;
  name: string;
  icon: string;
  description: string;
  tone: string;
  color: string;
}

// ─── Messages ──────────────────────────────────────────────────────────────
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ─── Auth ──────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
}

// ─── Navigation ────────────────────────────────────────────────────────────
export type AppPage = 'assistant' | 'profile';

// ─── Feature / Workspace IDs ────────────────────────────────────────────────
export type FeatureId =
  | 'talk'
  | 'wellbeing'
  | 'exercise'
  | 'diet'
  | 'meditation'
  | 'profile'
  | 'settings';

// ─── Zustand Store Shape ───────────────────────────────────────────────────
export interface AppStore {
  user: User | null;
  token: string | null;
  currentRole: RoleId;
  currentConversationId: string | null;
  messages: Message[];
  assistantState: AssistantState;
  error: string | null;
  currentPage: AppPage;

  login: (user: User, token: string) => void;
  logout: () => void;
  setRole: (role: RoleId) => void;
  setConversationId: (id: string | null) => void;
  addMessage: (message: Message) => void;
  setAssistantState: (state: AssistantState) => void;
  setError: (error: string | null) => void;
  clearSession: () => void;
  navigate: (page: AppPage) => void;
  voiceEnabled: boolean;
  toggleVoice: () => void;
}

// ─── Browser Speech API ambient types ─────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
