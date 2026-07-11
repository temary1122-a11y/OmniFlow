import type { StateCreator } from 'zustand';
import type { OmniActions, OmniState } from '../storeTypes';

/** Shell UI slice (tabs, sidebar). */
export type UiSlice = Pick<OmniState, 'activeTab' | 'sidebarOpen'> &
  Pick<OmniActions, 'setActiveTab' | 'setSidebarOpen'>;

export const createUiSlice: StateCreator<OmniState & OmniActions, [], [], UiSlice> = (set) => ({
  activeTab: 'chat',
  sidebarOpen: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
});
