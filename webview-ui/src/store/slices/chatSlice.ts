import type { StateCreator } from 'zustand';
import type { OmniActions, OmniState } from '../storeTypes';

/** Chat messages and verbosity slice. */
export type ChatSlice = Pick<
  OmniState,
  'messages' | 'chatVerbosity' | 'activityLog'
> &
  Pick<OmniActions, 'clearMessages' | 'setChatVerbosity'>;

export const createChatSlice: StateCreator<
  OmniState & OmniActions,
  [],
  [],
  ChatSlice
> = (set) => ({
  messages: [],
  chatVerbosity: 'normal',
  activityLog: [],
  clearMessages: () => set({ messages: [] }),
  setChatVerbosity: (v) => set({ chatVerbosity: v }),
});
