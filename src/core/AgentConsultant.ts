import type { EventBus } from './EventBus';
import type { AgentRole, Phase, Complexity } from '../../shared/types';

export type ConsultFn = (agentRole: string, question: string, from?: string) => Promise<string>;

export interface AgentConsultantCallLlm {
  (
    req: { phase: Phase; agentRole: AgentRole; complexity: Complexity },
    prompt: string,
    systemPrompt: string,
    apiKeys: Record<string, string>
  ): Promise<{ content: string; usedFallback?: boolean }>;
}

export class AgentConsultant {
  private depth = 0;

  constructor(
    private agents: Partial<Record<AgentRole, any>>,
    private callLlm: AgentConsultantCallLlm,
    private getApiKeys: () => Record<string, string>,
    private eventBus: EventBus
  ) {}

  async consult(agentRole: string, question: string, from?: string): Promise<string> {
    if (this.depth > 0) {
      return '[consultation nesting blocked: ask_agent cannot be nested]';
    }

    this.depth++;

    try {
      this.eventBus.emit({
        type: 'AGENT_CONSULT',
        payload: { from: from ?? 'unknown', to: agentRole as AgentRole, question },
      });

      let answer = '';

      const targetAgent = this.agents[agentRole as AgentRole];
      if (targetAgent && typeof targetAgent.respondToPrompt === 'function') {
        const r = await targetAgent.respondToPrompt(question, []);
        answer = r.content;
      } else {
        const llm = await this.callLlm(
          { phase: 'consult', agentRole: agentRole as AgentRole, complexity: 'low' },
          question,
          `You are the ${agentRole} agent. Answer the consulting question concisely and factually.`,
          this.getApiKeys()
        );
        answer = llm.content || '';
      }

      this.eventBus.emit({
        type: 'AGENT_CONSULT',
        payload: { from: from ?? 'unknown', to: agentRole as AgentRole, question, answer },
      });

      return answer;
    } finally {
      this.depth--;
    }
  }
}