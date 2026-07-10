import type { Phase, AgentRole, Complexity, HandoffContract } from '../../shared/types';

export interface PolicyRule {
  id: string;
  condition: (state: OrchestrationState) => boolean;
  actionFactory: (state: OrchestrationState) => OrchestrationAction;
  priority: number;
}

export interface OrchestrationState {
  currentPhase: Phase;
  completedAgents: AgentRole[];
  failedAgents: AgentRole[];
  pendingContracts: HandoffContract[];
  resourceBudget: { tokens: number; models: string[] };
  taskComplexity: Complexity;
}

export interface OrchestrationAction {
  type: 'parallel' | 'sequential' | 'skip' | 'retry' | 'fallback';
  agentRole?: AgentRole;
  params?: Record<string, any>;
}

export class OrchestrationPolicy {
  private rules: PolicyRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  evaluate(state: OrchestrationState): OrchestrationAction[] {
    const actions: OrchestrationAction[] = [];
    for (const rule of this.rules) {
      if (rule.condition(state)) {
        actions.push(rule.actionFactory(state));
      }
    }
    return actions;
  }

  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== ruleId);
    return this.rules.length !== initialLength;
  }

  private initializeDefaultRules(): void {
    this.addRule({
      id: 'parallel-no-deps',
      priority: 100,
      condition: (s) => {
        const buildContracts = s.pendingContracts.filter((c) => c.agentRole === 'coder');
        return (
          buildContracts.length > 1 &&
          buildContracts.every((c) => !c.dependsOn || c.dependsOn.length === 0)
        );
      },
      actionFactory: () => ({ type: 'parallel' }),
    });

    this.addRule({
      id: 'sequential-with-deps',
      priority: 90,
      condition: (s) => {
        const buildContracts = s.pendingContracts.filter((c) => c.agentRole === 'coder');
        return (
          buildContracts.length > 0 &&
          buildContracts.some((c) => c.dependsOn && c.dependsOn.length > 0)
        );
      },
      actionFactory: () => ({ type: 'sequential' }),
    });

    this.addRule({
      id: 'retry-on-failure',
      priority: 80,
      condition: (s) => s.failedAgents.length > 0 && s.failedAgents.length < 3,
      actionFactory: (s) => ({ type: 'retry', agentRole: s.failedAgents[0] }),
    });

    this.addRule({
      id: 'fallback-healthy',
      priority: 70,
      condition: (s) => {
        return s.failedAgents.length >= 3 && s.resourceBudget.models.length > 1;
      },
      actionFactory: () => ({ type: 'fallback' }),
    });

    this.addRule({
      id: 'low-complexity-serial',
      priority: 60,
      condition: (s) => s.taskComplexity === 'low' && s.pendingContracts.length <= 2,
      actionFactory: () => ({ type: 'sequential' }),
    });
  }
}