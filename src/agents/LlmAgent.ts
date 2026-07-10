import type { Phase, AgentRole } from '../../shared/types';
import { BaseAgent } from './BaseAgent';
import type { SelfPromptingAgent } from './SelfPromptingAgent';
import type { AgentMessage, AgentResponse } from '../core/PromptOrchestrator';
import type { ModelRouter } from '../routing/ModelRouter';
import type { EventBus } from '../core/EventBus';
import type { LayeredPromptBuilder, PromptContext } from '../core/LayeredPromptBuilder';
import { SandboxTool } from '../shell/SandboxTool';
import { SemanticEditor } from '../shell/SemanticEditor';
import { ToolRegistry, createDefaultTools, type ToolDefinition } from '../core/ToolRegistry';

/**
 * Base class for LLM-backed agents: shared sandbox injection, layered prompts,
 * and default SelfPromptingAgent behaviour (no per-agent copy-paste).
 */
export abstract class LlmAgent extends BaseAgent implements SelfPromptingAgent {
  abstract agentId: string;
  protected promptBuilder?: LayeredPromptBuilder;
  protected sharedSandboxTool?: SandboxTool;
  protected sharedSemanticEditor?: SemanticEditor;

  constructor(
    agentId: string,
    protected router: ModelRouter,
    protected apiKeys: Record<string, string>,
    eventBus?: EventBus
  ) {
    super(agentId, eventBus);
  }

  setApiKeys(keys: Record<string, string>): void {
    this.apiKeys = keys;
  }

  setPromptBuilder(builder: LayeredPromptBuilder): void {
    this.promptBuilder = builder;
  }

  setSharedTools(sandbox: SandboxTool, editor?: SemanticEditor): void {
    this.sharedSandboxTool = sandbox;
    if (editor) this.sharedSemanticEditor = editor;
  }

  protected getSandboxTool(workspaceRoot: string): SandboxTool {
    if (this.sharedSandboxTool) return this.sharedSandboxTool;
    return new SandboxTool({ workspaceRoot, eventBus: this.eventBus! });
  }

  protected getSemanticEditor(workspaceRoot: string): SemanticEditor {
    if (this.sharedSemanticEditor) return this.sharedSemanticEditor;
    return new SemanticEditor(workspaceRoot);
  }

  protected createToolRegistry(
    workspaceRoot: string,
    toolFilter?: string[]
  ): { registry: ToolRegistry; tools: ToolDefinition[] } {
    const sandboxTool = this.getSandboxTool(workspaceRoot);
    const semanticEditor = this.getSemanticEditor(workspaceRoot);
    const { tools, executors } = createDefaultTools(sandboxTool, semanticEditor, workspaceRoot);
    const selected = toolFilter ? tools.filter((t) => toolFilter.includes(t.name)) : tools;

    const registry = new ToolRegistry(this.eventBus!);
    for (const tool of selected) {
      registry.register(tool.name, tool, executors[tool.name]);
    }
    return { registry, tools: selected };
  }

  protected composeSystemPrompt(phase: Phase, goal: string, roleExtension: string, extra?: Partial<PromptContext>): string {
    if (!this.promptBuilder) return roleExtension;
    return this.promptBuilder.composeSystemPrompt(roleExtension, {
      agentId: this.agentId,
      phase,
      goal,
      ...extra,
    });
  }

  async generatePromptFor(goal: string, targetAgent: string, context: AgentMessage[]): Promise<string> {
    const recentContext = context.slice(-3);
    return [
      `You are ${this.agentId} communicating with ${targetAgent}.`,
      `Current goal: ${goal}`,
      recentContext.length > 0
        ? `Recent conversation:\n${recentContext.map((h) => `- ${h.from} → ${h.to}: ${h.prompt.slice(0, 100)}...`).join('\n')}`
        : '',
      `Generate a specific prompt for ${targetAgent} that will help advance the goal.`,
      `Focus on what ${targetAgent} needs to know or do next.`,
      `Keep it concise and actionable.`,
    ].filter(Boolean).join('\n\n');
  }

  async respondToPrompt(prompt: string, _context: AgentMessage[]): Promise<AgentResponse> {
    try {
      const llm = await this.router.call(
        { phase: this.currentPhase, agentRole: this.agentId as AgentRole, complexity: 'medium' },
        prompt,
        `You are ${this.agentId} responding to a prompt from another agent. Provide a helpful response.`,
        this.apiKeys
      );
      return {
        content: llm.content || '',
        confidence: llm.usedFallback ? 0.5 : 0.8,
        needsMoreInfo: false,
        metadata: { usedFallback: llm.usedFallback },
      };
    } catch (error) {
      return {
        content: `Error processing prompt: ${error}`,
        confidence: 0,
        needsMoreInfo: true,
      };
    }
  }

  async evaluateConversation(history: AgentMessage[]): Promise<number> {
    if (history.length === 0) return 0;
    const lengthScore = Math.min(history.length / 10, 1);
    const prompts = history.map((h) => h.prompt);
    const uniquePrompts = new Set(prompts);
    const repetitionScore = uniquePrompts.size / prompts.length;
    return (lengthScore + repetitionScore) / 2;
  }
}
