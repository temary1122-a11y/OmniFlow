import type { StateCreator } from 'zustand';
import type { OmniActions, OmniState } from '../storeTypes';
import type { AgentRole } from '@/types';

/** Agent status, graph, and reasoning traces slice. */
export type AgentsSlice = Pick<
  OmniState,
  'agentStatuses' | 'agentGraph' | 'reasoningTraces' | 'selectedAgentId'
> &
  Pick<OmniActions, 'setSelectedAgent'>;

export const createAgentsSlice: StateCreator<
  OmniState & OmniActions,
  [],
  [],
  AgentsSlice
> = (set) => ({
  agentStatuses: {} as Record<AgentRole, 'idle' | 'working' | 'done' | 'blocked' | 'error'>,
  agentGraph: { nodes: [], edges: [] },
  reasoningTraces: {} as Record<AgentRole, string[]>,
  selectedAgentId: null,
  setSelectedAgent: (agentId) => set({ selectedAgentId: agentId }),
});
