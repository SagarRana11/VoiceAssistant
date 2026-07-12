import { create } from 'zustand';
import { AppStore, AppPage, AssistantState, AvatarProvider, Message, RoleId, User } from '../types';
import { DEFAULT_ROLE } from '../constants/roles';

const TOKEN_KEY    = 'va_token';
const VOICE_KEY    = 'va_voice_enabled';
// Bumped to _v2 to force all existing users onto the new default (MuseTalk),
// ignoring any provider previously stored under the old key.
const AVATAR_KEY   = 'va_avatar_provider_v2';

export const useAppStore = create<AppStore>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  currentRole: DEFAULT_ROLE,
  currentConversationId: null,
  messages: [],
  assistantState: 'idle' as AssistantState,
  error: null,
  currentPage: 'assistant' as AppPage,
  voiceEnabled: localStorage.getItem(VOICE_KEY) !== 'false',
  avatarProvider: (localStorage.getItem(AVATAR_KEY) ?? 'musetalk') as AvatarProvider,

  login: (user: User, token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ user, token, error: null });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({
      user: null,
      token: null,
      messages: [],
      currentConversationId: null,
      assistantState: 'idle',
      error: null,
      currentRole: DEFAULT_ROLE,
      currentPage: 'assistant',
    });
  },

  // Role change always starts a fresh session
  setRole: (role: RoleId) =>
    set({
      currentRole: role,
      messages: [],
      currentConversationId: null,
      assistantState: 'idle',
      error: null,
    }),

  setConversationId: (id: string | null) => set({ currentConversationId: id }),

  addMessage: (message: Message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setAssistantState: (assistantState: AssistantState) =>
    set({ assistantState }),

  setError: (error: string | null) => set({ error }),

  clearSession: () =>
    set({
      messages: [],
      currentConversationId: null,
      assistantState: 'idle',
      error: null,
    }),

  navigate: (page: AppPage) => set({ currentPage: page }),

  toggleVoice: () =>
    set((state) => {
      const next = !state.voiceEnabled;
      localStorage.setItem(VOICE_KEY, String(next));
      return { voiceEnabled: next };
    }),

  setAvatarProvider: (p: AvatarProvider) => {
    localStorage.setItem(AVATAR_KEY, p);
    set({ avatarProvider: p });
  },
}));
