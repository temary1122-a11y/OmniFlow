import type { Phase } from '../../shared/types';

/** Declarative phase sets per tier (aligns with RoleSelector semantics). */
export const TIER_PHASE_MANIFEST: Record<'LOW' | 'MEDIUM' | 'HIGH', Phase[]> = {
  LOW: ['intake', 'research', 'planning', 'build', 'deliver'],
  MEDIUM: ['intake', 'research', 'planning', 'build', 'verify', 'deliver'],
  HIGH: ['intake', 'research', 'planning', 'build', 'audit', 'security', 'verify', 'deliver'],
};

export function tierIncludesPhase(tier: 'LOW' | 'MEDIUM' | 'HIGH', phase: Phase): boolean {
  return TIER_PHASE_MANIFEST[tier].includes(phase);
}
