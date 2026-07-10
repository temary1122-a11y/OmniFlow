import type { AgentRole, Phase, Complexity } from '../../shared/types';

export interface RoleSelection {
  tier: 'LOW' | 'MEDIUM' | 'HIGH';
  /** Ordered list of agents that should run for this goal. No longer hardcoded. */
  roles: AgentRole[];
  /** Phase flags derived from `roles` (kept for backward-compatible gating in the orchestrator). */
  phases: Phase[];
  /** Whether to run the self-prompting convergence loop (reserved for hard/high-value tasks). */
  useSelfPrompting: boolean;
}

export const ALL_AGENT_ROLES: AgentRole[] = [
  'clarifier', 'researcher', 'planner', 'coder', 'auditor', 'security', 'verifier',
];

const ROLE_TO_PHASE: Partial<Record<AgentRole, Phase>> = {
  researcher: 'research',
  planner: 'planning',
  coder: 'build',
  auditor: 'audit',
  security: 'security',
  verifier: 'verify',
};

/**
 * Decides WHICH agents run for a goal.
 *
 * Replaces the previous hardcoded `switch (complexity)` in OmniOrchestrator.
 * Role selection is driven by task complexity (low/medium/high) plus lightweight
 * goal signals (security / audit / planning keywords).
 *
 * Hard / high-value tasks run the FULL pipeline at maximum power (all agents + the
 * self-prompting convergence loop). Easy tasks stay lean.
 */
export class RoleSelector {
  select(goal: string, complexity: Complexity): RoleSelection {
    const g = (goal || '').toLowerCase();

    // Goal signals can force-include specialist roles even on lower tiers.
    const wantsSecurity = /secur|auth|login|token|encrypt|owasp|vulnerab|sanitiz|secret|password/i.test(g);
    const wantsAudit = /audit|quality|lint|refactor|legacy|improve|clean(ing)?\s*up/i.test(g);
    const wantsPlan = /architect|design|plan|scale|microservice|system|enterprise/i.test(g);

    if (complexity === 'low') {
      const roles: AgentRole[] = ['clarifier', 'coder', 'verifier'];
      if (wantsSecurity) roles.splice(roles.indexOf('verifier'), 0, 'security');
      return this.finalize('LOW', roles, false);
    }

    if (complexity === 'medium') {
      const roles: AgentRole[] = ['clarifier', 'researcher', 'planner', 'coder', 'verifier'];
      if (wantsSecurity) roles.splice(roles.indexOf('coder'), 0, 'security');
      if (wantsAudit) roles.push('auditor');
      if (wantsPlan) roles.splice(roles.indexOf('planner'), 0, 'researcher');
      return this.finalize('MEDIUM', roles, false);
    }

    // HIGH — full power: every agent + self-prompting convergence loop.
    return this.finalize('HIGH', [...ALL_AGENT_ROLES], true);
  }

  private finalize(tier: 'LOW' | 'MEDIUM' | 'HIGH', roles: AgentRole[], useSelfPrompting: boolean): RoleSelection {
    const phases = roles
      .map((r) => ROLE_TO_PHASE[r])
      .filter((p): p is Phase => Boolean(p));
    return { tier, roles, phases, useSelfPrompting };
  }
}
