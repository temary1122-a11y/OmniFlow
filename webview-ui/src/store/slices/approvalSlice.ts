import type { StateCreator } from 'zustand';
import type { OmniActions, OmniState } from '../storeTypes';

/** Approval and clarifying questions slice. */
export type ApprovalSlice = Pick<
  OmniState,
  'pendingQuestions' | 'pendingApproval' | 'pendingApiKeyPrompt'
>;

export const createApprovalSlice: StateCreator<
  OmniState & OmniActions,
  [],
  [],
  ApprovalSlice
> = () => ({
  pendingQuestions: null,
  pendingApproval: null,
  pendingApiKeyPrompt: null,
});
