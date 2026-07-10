import type { StateCreator } from 'zustand';
import type { OmniActions, OmniState } from '../storeTypes';

/** Workspace tree and artifacts slice. */
export type WorkspaceSlice = Pick<
  OmniState,
  'workspaceTree' | 'workspaceRoot' | 'artifacts'
>;

export const createWorkspaceSlice: StateCreator<
  OmniState & OmniActions,
  [],
  [],
  WorkspaceSlice
> = () => ({
  workspaceTree: [],
  workspaceRoot: '',
  artifacts: [],
});
