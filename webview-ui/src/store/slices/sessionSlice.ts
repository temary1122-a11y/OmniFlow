import type { StateCreator } from 'zustand';
import type { OmniActions, OmniState } from '../storeTypes';

/** Session management slice (goal, mode, running state). */
export type SessionSlice = Pick<
  OmniState,
  'sessionId' | 'goal' | 'mode' | 'isStreaming' | 'isRunning'
> &
  Pick<OmniActions, 'setStreaming' | 'resetSession'>;

export const createSessionSlice: StateCreator<
  OmniState & OmniActions,
  [],
  [],
  SessionSlice
> = (set) => ({
  sessionId: '',
  goal: '',
  mode: 'code',
  isStreaming: false,
  isRunning: false,
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  resetSession: () => {
    set({
      sessionId: '',
      goal: '',
      isRunning: false,
      isStreaming: false,
      messages: [],
      artifacts: [],
      completedPhases: [],
      currentPhase: 'idle',
      lastError: null,
      pendingQuestions: null,
      pendingApproval: null,
    });
  },
});
