/**
 * DynamicPromptBuilder
 * 
 * Builds prompts dynamically based on context, conversation history, and agent role
 * Replaces static hardcoded prompts with adaptive, context-aware prompts
 */

import type { AgentMessage } from './PromptOrchestrator';

export interface PromptContext {
  agentRole: string;
  currentGoal: string;
  conversationHistory: AgentMessage[];
  workspaceContext?: {
    techStack: string[];
    fileTree: string[];
    hasPackageJson: boolean;
  };
  userDecisions?: Record<string, string>;
  researchSummary?: string;
  planSummary?: string;
  /** TaskCompass context block (TRUE GOAL) to anchor the agent. */
  compassContextBlock?: string;
}

export interface PromptTemplate {
  base: string;
  contextInjectors: ContextInjector[];
  outputRequirements: OutputRequirement[];
}

export interface ContextInjector {
  name: string;
  condition: (context: PromptContext) => boolean;
  inject: (context: PromptContext) => string;
}

export interface OutputRequirement {
  type: 'json' | 'text' | 'code';
  format?: string;
  constraints: string[];
}

export class DynamicPromptBuilder {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default prompt templates for each agent role
   */
  private initializeDefaultTemplates(): void {
    // Clarifier template
    this.templates.set('clarifier', {
      base: `You are a project intake assistant. Your role is to identify missing implementation details by asking specific, non-technical questions.`,
      contextInjectors: [
        {
          name: 'language_detection',
          condition: (ctx) => /[а-яА-ЯёЁ]/.test(ctx.currentGoal),
          inject: (ctx) => `IMPORTANT: The user's goal is in Russian. Ask ALL questions in Russian.`,
        },
        {
          name: 'workspace_context',
          condition: (ctx) => Boolean(ctx.workspaceContext && ctx.workspaceContext.techStack.length > 0),
          inject: (ctx) => `Workspace context: Tech stack: ${ctx.workspaceContext!.techStack.join(', ')}. Files: ${ctx.workspaceContext!.fileTree.slice(0, 5).join(', ')}.`,
        },
        {
          name: 'user_decisions',
          condition: (ctx) => Boolean(ctx.userDecisions && Object.keys(ctx.userDecisions).length > 0),
          inject: (ctx) => `User has already decided: ${Object.entries(ctx.userDecisions!).map(([k, v]) => `${k}: ${v}`).join(', ')}.`,
        },
      ],
      outputRequirements: [
        {
          type: 'json',
          format: 'array',
          constraints: [
            'Return ONLY valid JSON array',
            'No markdown code blocks',
            'No text before or after JSON',
            'Each question must have: id, question, options, allowCustom, context',
            'Ask 2-3 specific questions about missing details',
            'Keep questions in plain language',
          ],
        },
      ],
    });

    // Researcher template
    this.templates.set('researcher', {
      base: `You are a technical research agent. Your role is to research the goal and provide technical guidance.`,
      contextInjectors: [
        {
          name: 'user_decisions_integration',
          condition: (ctx) => Boolean(ctx.userDecisions && Object.keys(ctx.userDecisions).length > 0),
          inject: (ctx) => `IMPORTANT: Use user decisions to steer research toward their intended outcome: ${JSON.stringify(ctx.userDecisions)}`,
        },
        {
          name: 'workspace_tech',
          condition: (ctx) => Boolean(ctx.workspaceContext && ctx.workspaceContext.techStack.length > 0),
          inject: (ctx) => `Workspace technology: ${ctx.workspaceContext!.techStack.join(', ')}`,
        },
      ],
      outputRequirements: [
        {
          type: 'json',
          format: 'object',
          constraints: [
            'Return ONLY valid JSON object',
            'No markdown code blocks',
            'Keys: summary, terms[], bestPractices[], patterns[], sources[]',
            'summary: 2-3 sentences',
            'terms: 5-10 technical terms',
            'bestPractices: 5-8 actionable practices',
            'patterns: 5-8 architectural patterns',
            'sources: 3-5 relevant sources',
          ],
        },
      ],
    });

    // Planner template
    this.templates.set('planner', {
      base: `You are a software architect. Your role is to create an MVP execution plan.`,
      contextInjectors: [
        {
          name: 'research_integration',
          condition: (ctx) => Boolean(ctx.researchSummary && ctx.researchSummary.length > 0),
          inject: (ctx) => `Research summary: ${ctx.researchSummary}`,
        },
        {
          name: 'user_decisions',
          condition: (ctx) => Boolean(ctx.userDecisions && Object.keys(ctx.userDecisions).length > 0),
          inject: (ctx) => `User decisions: ${JSON.stringify(ctx.userDecisions)}`,
        },
      ],
      outputRequirements: [
        {
          type: 'json',
          format: 'object',
          constraints: [
            'Return ONLY valid JSON object',
            'No markdown code blocks',
            'Keys: stack[], architecture, subtasks[]',
            'stack: array of technologies',
            'architecture: string describing architecture',
            'subtasks: 3-8 implementation steps',
            'Each subtask: description, filePath, contentType',
            'filePath relative to generated/',
            'contentType: code or doc',
          ],
        },
      ],
    });

    // Coder template
    this.templates.set('coder', {
      base: `You are an autonomous engineering agent. Your role is to implement the subtasks according to the plan.`,
      contextInjectors: [
        {
          name: 'plan_context',
          condition: (ctx) => Boolean(ctx.planSummary && ctx.planSummary.length > 0),
          inject: (ctx) => `Plan context: ${ctx.planSummary}`,
        },
        {
          name: 'workspace_context',
          condition: (ctx) => Boolean(ctx.workspaceContext && ctx.workspaceContext.fileTree.length > 0),
          inject: (ctx) => `Existing files: ${ctx.workspaceContext!.fileTree.slice(0, 8).join(', ')}`,
        },
      ],
      outputRequirements: [
        {
          type: 'code',
          constraints: [
            'Write production-ready code',
            'Follow existing code style',
            'Add necessary imports',
            'Handle errors appropriately',
            'Use tools: write_file, read_file, bash',
          ],
        },
      ],
    });
  }

  /**
   * Build a prompt for a specific agent based on context
   */
  buildPrompt(agentRole: string, context: PromptContext): string {
    const template = this.templates.get(agentRole);
    
    if (!template) {
      return this.buildFallbackPrompt(agentRole, context);
    }

    const parts: string[] = [];
    // Anchor the agent with the TRUE GOAL from TaskCompass, if provided.
    if (context.compassContextBlock) {
      parts.push(context.compassContextBlock);
    }
    parts.push(template.base);

    // Inject context
    for (const injector of template.contextInjectors) {
      if (injector.condition(context)) {
        parts.push(injector.inject(context));
      }
    }

    // Add output requirements
    if (template.outputRequirements.length > 0) {
      parts.push('\nCRITICAL OUTPUT REQUIREMENTS:');
      for (const req of template.outputRequirements) {
        parts.push(`- Format: ${req.type}${req.format ? ` (${req.format})` : ''}`);
        for (const constraint of req.constraints) {
          parts.push(`  ${constraint}`);
        }
      }
    }

    // Add the main goal
    parts.push(`\nGoal: ${context.currentGoal}`);

    return parts.join('\n\n');
  }

  /**
   * Build a fallback prompt if no template exists
   */
  private buildFallbackPrompt(agentRole: string, context: PromptContext): string {
    return [
      `You are a ${agentRole} agent.`,
      `Goal: ${context.currentGoal}`,
      context.workspaceContext ? `Workspace: ${context.workspaceContext.techStack.join(', ')}` : '',
      'Provide a helpful response.',
    ].filter(Boolean).join('\n');
  }

  /**
   * Build a prompt for self-prompting (agent-to-agent communication)
   */
  buildSelfPromptingPrompt(
    fromAgent: string,
    toAgent: string,
    goal: string,
    history: AgentMessage[]
  ): string {
    const recentHistory = history.slice(-5);
    
    return [
      `You are ${fromAgent} communicating with ${toAgent}.`,
      `Current goal: ${goal}`,
      recentHistory.length > 0 ? `Recent conversation:\n${recentHistory.map(h => `- ${h.from} → ${h.to}: ${h.prompt.slice(0, 100)}...`).join('\n')}` : '',
      `Generate a specific prompt for ${toAgent} that will help advance the goal.`,
      `Focus on what ${toAgent} needs to know or do next.`,
      `Keep it concise and actionable.`,
    ].filter(Boolean).join('\n\n');
  }

  /**
   * Register a custom template for an agent role
   */
  registerTemplate(agentRole: string, template: PromptTemplate): void {
    this.templates.set(agentRole, template);
  }

  /**
   * Get a template for an agent role
   */
  getTemplate(agentRole: string): PromptTemplate | undefined {
    return this.templates.get(agentRole);
  }

  /**
   * Check if a template exists for an agent role
   */
  hasTemplate(agentRole: string): boolean {
    return this.templates.has(agentRole);
  }
}
