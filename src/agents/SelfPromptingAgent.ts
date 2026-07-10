/**
 * SelfPromptingAgent interface and base implementation
 * 
 * Enables agents to participate in self-prompting loops
 * Agents can prompt each other dynamically based on context
 */

import type { AgentMessage, AgentResponse } from '../core/PromptOrchestrator';

/**
 * Interface for agents that can participate in self-prompting
 */
export interface SelfPromptingAgent {
  agentId: string;
  generatePromptFor(goal: string, targetAgent: string, context: AgentMessage[]): Promise<string>;
  respondToPrompt(prompt: string, context: AgentMessage[]): Promise<AgentResponse>;
  evaluateConversation(history: AgentMessage[]): Promise<number>;
}

/**
 * Base implementation of SelfPromptingAgent that can be extended
 */
export abstract class BaseSelfPromptingAgent implements SelfPromptingAgent {
  abstract agentId: string;

  /**
   * Generate a prompt for another agent
   * Default implementation - can be overridden
   */
  async generatePromptFor(goal: string, targetAgent: string, context: AgentMessage[]): Promise<string> {
    const recentContext = context.slice(-3);
    
    return [
      `You are ${this.agentId} communicating with ${targetAgent}.`,
      `Current goal: ${goal}`,
      recentContext.length > 0 ? `Recent conversation:\n${recentContext.map(h => `- ${h.from} → ${h.to}: ${h.prompt.slice(0, 100)}...`).join('\n')}` : '',
      `Generate a specific prompt for ${targetAgent} that will help advance the goal.`,
      `Focus on what ${targetAgent} needs to know or do next.`,
      `Keep it concise and actionable.`,
    ].filter(Boolean).join('\n\n');
  }

  /**
   * Respond to a prompt from another agent
   * Default implementation - must be overridden by concrete agents
   */
  abstract respondToPrompt(prompt: string, context: AgentMessage[]): Promise<AgentResponse>;

  /**
   * Evaluate conversation quality and convergence
   * Default implementation - can be overridden
   */
  async evaluateConversation(history: AgentMessage[]): Promise<number> {
    if (history.length === 0) return 0;

    // Simple heuristic: confidence increases with conversation length
    // and decreases if there are repeated questions
    const lengthScore = Math.min(history.length / 10, 1);
    
    // Check for repetition
    const prompts = history.map(h => h.prompt);
    const uniquePrompts = new Set(prompts);
    const repetitionScore = uniquePrompts.size / prompts.length;

    return (lengthScore + repetitionScore) / 2;
  }
}
