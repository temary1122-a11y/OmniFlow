import type { StateCreator } from 'zustand';
import type { OmniActions, OmniState } from '../storeTypes';

/** Settings slice (provider info, model catalog, supervisor, budget). */
export type SettingsSlice = Pick<
  OmniState,
  'providerInfo' | 'modelCatalog' | 'useSupervisor' | 'budget'
> &
  Pick<OmniActions, 'setUseSupervisor' | 'setBudget' | 'updateSettings'>;

export const createSettingsSlice: StateCreator<
  OmniState & OmniActions,
  [],
  [],
  SettingsSlice
> = (set) => ({
  providerInfo: {},
  modelCatalog: {},
  useSupervisor: false,
  budget: 'normal',
  setUseSupervisor: (enabled) => set({ useSupervisor: enabled }),
  setBudget: (budget) => set({ budget }),
  updateSettings: (settings) => {
    set((s) => ({
      ...s,
      ...(settings.chatVerbosity !== undefined && { chatVerbosity: settings.chatVerbosity }),
      ...(settings.useSupervisor !== undefined && { useSupervisor: settings.useSupervisor }),
      ...(settings.budget !== undefined && { budget: settings.budget }),
    }));
  },
});
