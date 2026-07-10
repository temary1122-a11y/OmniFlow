import { EventBus } from './EventBus';
import { ModelRouter } from '../routing/ModelRouter';

export interface ContextPriority {
  level: 'high' | 'medium' | 'low';
  reason: string;
}

export interface ContextItem {
  content: string;
  role: string;
  priority: ContextPriority;
  timestamp: number;
  source: 'user' | 'assistant' | 'system' | 'tool' | 'summary';
}

export interface GovernanceOptions {
  maxTokens: number;
  targetTokens: number;
  preserveRecentTurns: number;
  enableSelectiveRetrieval: boolean;
  enableHierarchicalSummarization: boolean;
  enableTokenBudgeting: boolean;
}

export interface RefreshStrategy {
  type: 'periodic' | 'event_driven' | 'adaptive';
  interval?: number; // iterations for periodic
  driftThreshold?: number; // for adaptive
}

export interface GovernanceResult {
  originalTokens: number;
  governedTokens: number;
  summary: string;
  preservedMessages: any[];
  retrievalStats: {
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    discarded: number;
  };
  refreshTriggered: boolean;
}

export class ContextGovernor {
  private eventBus: EventBus;
  private modelRouter: ModelRouter;
  private refreshStrategy: RefreshStrategy;
  private iterationCount: number = 0;
  private driftScore: number = 0;

  constructor(
    eventBus: EventBus,
    modelRouter: ModelRouter,
    refreshStrategy?: Partial<RefreshStrategy>
  ) {
    this.eventBus = eventBus;
    this.modelRouter = modelRouter;
    this.refreshStrategy = {
      type: 'adaptive',
      driftThreshold: 0.3,
      ...refreshStrategy,
    };
  }

  async govern(
    messages: any[],
    options: GovernanceOptions
  ): Promise<GovernanceResult> {
    this.iterationCount++;

    const originalTokens = this.estimateTokens(messages);

    if (originalTokens <= options.maxTokens) {
      return {
        originalTokens,
        governedTokens: originalTokens,
        summary: '',
        preservedMessages: messages,
        retrievalStats: { highPriority: messages.length, mediumPriority: 0, lowPriority: 0, discarded: 0 },
        refreshTriggered: false,
      };
    }

    // Phase 1: Priority-based assembly
    const prioritizedItems = this.assignPriorities(messages);
    const retrievalStats = this.calculateRetrievalStats(prioritizedItems);

    // Phase 2: Selective retrieval (three-line defense)
    const selectedItems = this.selectiveRetrieval(
      prioritizedItems,
      options,
      retrievalStats
    );

    // Phase 3: Hierarchical summarization if needed
    const { finalItems, summary } = await this.hierarchicalSummarization(
      selectedItems,
      options
    );

    // Phase 4: Token budgeting
    const governedMessages = this.applyTokenBudgeting(
      finalItems,
      options.targetTokens
    );

    const governedTokens = this.estimateTokens(governedMessages);
    const refreshTriggered = this.shouldRefresh();

    this.emitGovernanceTrace(originalTokens, governedTokens, retrievalStats, refreshTriggered);

    return {
      originalTokens,
      governedTokens,
      summary,
      preservedMessages: governedMessages,
      retrievalStats,
      refreshTriggered,
    };
  }

  private assignPriorities(messages: any[]): ContextItem[] {
    return messages.map((msg, index) => {
      const priority = this.determinePriority(msg, index, messages.length);
      return {
        content: msg.content,
        role: msg.role,
        priority,
        timestamp: Date.now() - (messages.length - index) * 1000, // Simulate timestamps
        source: this.determineSource(msg),
      };
    });
  }

  private determinePriority(msg: any, index: number, totalMessages: number): ContextPriority {
    // Recent messages are high priority
    if (index >= totalMessages - 3) {
      return { level: 'high', reason: 'Recent message' };
    }

    // System messages are high priority
    if (msg.role === 'system') {
      return { level: 'high', reason: 'System instruction' };
    }

    // Tool results are medium priority
    if (msg.role === 'tool' || (msg.content && msg.content.includes('Tool'))) {
      return { level: 'medium', reason: 'Tool result' };
    }

    // User messages are medium priority
    if (msg.role === 'user') {
      return { level: 'medium', reason: 'User input' };
    }

    // Old assistant messages are low priority
    return { level: 'low', reason: 'Old assistant response' };
  }

  private determineSource(msg: any): ContextItem['source'] {
    if (msg.role === 'system') return 'system';
    if (msg.role === 'user') return 'user';
    if (msg.role === 'assistant') return 'assistant';
    if (msg.role === 'tool') return 'tool';
    if (msg.content && msg.content.includes('summary')) return 'summary';
    return 'assistant';
  }

  private calculateRetrievalStats(items: ContextItem[]): GovernanceResult['retrievalStats'] {
    const stats = { highPriority: 0, mediumPriority: 0, lowPriority: 0, discarded: 0 };
    for (const item of items) {
      stats[`${item.priority}Priority` as keyof typeof stats]++;
    }
    return stats;
  }

  private selectiveRetrieval(
    items: ContextItem[],
    options: GovernanceOptions,
    stats: GovernanceResult['retrievalStats']
  ): ContextItem[] {
    if (!options.enableSelectiveRetrieval) {
      return items;
    }

    // Always keep high priority
    const highPriority = items.filter(i => i.priority.level === 'high');

    // Keep medium priority if space allows
    const mediumPriority = items.filter(i => i.priority.level === 'medium');

    // Keep low priority only if essential
    const lowPriority = items.filter(i => i.priority.level === 'low');

    // Estimate tokens for each priority level
    const highTokens = this.estimateTokensFromItems(highPriority);
    const mediumTokens = this.estimateTokensFromItems(mediumPriority);
    const lowTokens = this.estimateTokensFromItems(lowPriority);

    // Select based on budget
    const selected: ContextItem[] = [...highPriority];

    if (highTokens + mediumTokens <= options.targetTokens) {
      selected.push(...mediumPriority);
    } else {
      // Partially include medium priority
      const remainingBudget = options.targetTokens - highTokens;
      const mediumToKeep = this.selectByTokenBudget(mediumPriority, remainingBudget);
      selected.push(...mediumToKeep);
    }

    // Update stats
    stats.discarded = items.length - selected.length;

    return selected;
  }

  private estimateTokensFromItems(items: ContextItem[]): number {
    return this.estimateTokens(items.map(i => ({ role: i.role, content: i.content })));
  }

  private selectByTokenBudget(items: ContextItem[], budget: number): ContextItem[] {
    const selected: ContextItem[] = [];
    let currentTokens = 0;

    for (const item of items) {
      const itemTokens = this.estimateTokens([{ role: item.role, content: item.content }]);
      if (currentTokens + itemTokens <= budget) {
        selected.push(item);
        currentTokens += itemTokens;
      }
    }

    return selected;
  }

  private async hierarchicalSummarization(
    items: ContextItem[],
    options: GovernanceOptions
  ): Promise<{ finalItems: ContextItem[]; summary: string }> {
    if (!options.enableHierarchicalSummarization) {
      return { finalItems: items, summary: '' };
    }

    // Group by priority for hierarchical summarization
    const lowPriorityItems = items.filter(i => i.priority.level === 'low');
    
    if (lowPriorityItems.length === 0) {
      return { finalItems: items, summary: '' };
    }

    // Summarize low priority items
    const summary = await this.summarizeItems(lowPriorityItems);

    // Replace low priority items with summary
    const summaryItem: ContextItem = {
      content: `Summarized context: ${summary}`,
      role: 'system',
      priority: { level: 'medium', reason: 'Summary of low-priority items' },
      timestamp: Date.now(),
      source: 'summary',
    };

    const highMediumItems = items.filter(i => i.priority.level !== 'low');
    const finalItems = [...highMediumItems, summaryItem];

    return { finalItems, summary };
  }

  private async summarizeItems(items: ContextItem[]): Promise<string> {
    if (items.length === 0) return '';

    const text = items.map(i => `${i.role}: ${i.content}`).join('\n');

    try {
      const response = await this.modelRouter.call(
        { phase: 'build', agentRole: 'orchestrator', complexity: 'low' },
        `Summarize the following context concisely, preserving key information:\n\n${text}`,
        'You are a helpful assistant that summarizes context concisely.',
        {}
      );

      return response.content;
    } catch (error: any) {
      console.error('Hierarchical summarization failed:', error.message);
      return `Summarized ${items.length} context items.`;
    }
  }

  private applyTokenBudgeting(items: ContextItem[], targetTokens: number): any[] {
    const currentTokens = this.estimateTokensFromItems(items);

    if (currentTokens <= targetTokens) {
      return items.map(i => ({ role: i.role, content: i.content }));
    }

    // If still over budget, truncate from the end (oldest first)
    const messages: any[] = [];
    let accumulatedTokens = 0;

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const itemTokens = this.estimateTokens([{ role: item.role, content: item.content }]);

      if (accumulatedTokens + itemTokens <= targetTokens) {
        messages.unshift({ role: item.role, content: item.content });
        accumulatedTokens += itemTokens;
      }
    }

    return messages;
  }

  private shouldRefresh(): boolean {
    if (this.refreshStrategy.type === 'periodic') {
      return this.iterationCount % (this.refreshStrategy.interval || 5) === 0;
    } else if (this.refreshStrategy.type === 'adaptive') {
      return this.driftScore >= (this.refreshStrategy.driftThreshold || 0.3);
    }
    return false;
  }

  private emitGovernanceTrace(
    originalTokens: number,
    governedTokens: number,
    stats: GovernanceResult['retrievalStats'],
    refreshTriggered: boolean
  ): void {
    this.eventBus.emit({
      type: 'REASONING_TRACE',
      payload: {
        agentId: 'orchestrator',
        phase: 'build',
        thought: `Context governed: ${originalTokens} -> ${governedTokens} tokens (high: ${stats.highPriority}, medium: ${stats.mediumPriority}, low: ${stats.lowPriority}, discarded: ${stats.discarded})${refreshTriggered ? ', refresh triggered' : ''}`,
        timestamp: Date.now(),
      },
    });
  }

  private estimateTokens(messages: any[]): number {
    const totalChars = messages.reduce((sum, m) => {
      return sum + (m.content?.length || 0) + (m.role?.length || 0);
    }, 0);
    return Math.ceil(totalChars / 4);
  }

  setRefreshStrategy(strategy: Partial<RefreshStrategy>): void {
    this.refreshStrategy = { ...this.refreshStrategy, ...strategy };
  }

  getRefreshStrategy(): RefreshStrategy {
    return { ...this.refreshStrategy };
  }

  reset(): void {
    this.iterationCount = 0;
    this.driftScore = 0;
  }

  updateDriftScore(score: number): void {
    this.driftScore = score;
  }
}
