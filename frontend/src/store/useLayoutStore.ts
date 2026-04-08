import { create } from 'zustand';

export type FeatureId =
  | 'talk'
  | 'wellbeing'
  | 'exercise'
  | 'diet'
  | 'meditation'
  | 'profile'
  | 'settings';

interface LayoutStore {
  activeFeature: FeatureId;
  sidebarCollapsed: boolean;
  conversationPanelCollapsed: boolean;
  setActiveFeature: (feature: FeatureId) => void;
  toggleSidebar: () => void;
  toggleConversationPanel: () => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  activeFeature: 'talk',
  sidebarCollapsed: false,
  conversationPanelCollapsed: false,
  setActiveFeature: (feature) => set({ activeFeature: feature }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleConversationPanel: () =>
    set((s) => ({ conversationPanelCollapsed: !s.conversationPanelCollapsed })),
}));
