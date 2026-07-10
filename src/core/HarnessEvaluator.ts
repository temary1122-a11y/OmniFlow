import { EventBus } from './EventBus';
import { LedgerMemory } from '../memory/LedgerMemory';

export interface HarnessMetrics {
  taskId: string;
  agentId: string;
  startTime: number;
  endTime: number;
  iterations: number;
  toolCalls: number;
  toolSuccesses: number;
  toolFailures: number;
  tokensUsed: number;
  completed: boolean;
  success: boolean;
}

export interface HarnessInsight {
  category: 'tool_selection' | 'prompt_engineering' | 'iteration_count' | 'context_usage';
  description: string;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
}

export class HarnessEvaluator {
  private eventBus: EventBus;
  private ledgerMemory: LedgerMemory;
  private metrics: HarnessMetrics[] = [];

  constructor(eventBus: EventBus, ledgerMemory: LedgerMemory) {
    this.eventBus = eventBus;
    this.ledgerMemory = ledgerMemory;
  }

  startTracking(taskId: string, agentId: string): void {
    this.metrics.push({
      taskId,
      agentId,
      startTime: Date.now(),
      endTime: 0,
      iterations: 0,
      toolCalls: 0,
      toolSuccesses: 0,
      toolFailures: 0,
      tokensUsed: 0,
      completed: false,
      success: false,
    });
  }

  recordIteration(taskId: string): void {
    const metric = this.getMetric(taskId);
    if (metric) {
      metric.iterations++;
    }
  }

  recordToolCall(taskId: string, success: boolean): void {
    const metric = this.getMetric(taskId);
    if (metric) {
      metric.toolCalls++;
      if (success) {
        metric.toolSuccesses++;
      } else {
        metric.toolFailures++;
      }
    }
  }

  recordTokens(taskId: string, tokens: number): void {
    const metric = this.getMetric(taskId);
    if (metric) {
      metric.tokensUsed += tokens;
    }
  }

  completeTask(taskId: string, success: boolean): void {
    const metric = this.getMetric(taskId);
    if (metric) {
      metric.endTime = Date.now();
      metric.completed = true;
      metric.success = success;
    }
  }

  getMetric(taskId: string): HarnessMetrics | undefined {
    return this.metrics.find(m => m.taskId === taskId);
  }

  getAllMetrics(): HarnessMetrics[] {
    return [...this.metrics];
  }

  async analyze(): Promise<HarnessInsight[]> {
    const insights: HarnessInsight[] = [];

    // Analyze tool success rates
    const toolFailureRate = this.metrics.reduce((sum, m) => sum + m.toolFailures, 0) /
      Math.max(1, this.metrics.reduce((sum, m) => sum + m.toolCalls, 0));

    if (toolFailureRate > 0.3) {
      insights.push({
        category: 'tool_selection',
        description: `High tool failure rate: ${(toolFailureRate * 100).toFixed(1)}%`,
        suggestion: 'Review tool definitions and add better error handling. Consider adding tool retry logic.',
        impact: 'high',
        confidence: 0.8,
      });
    }

    // Analyze iteration counts
    const avgIterations = this.metrics.reduce((sum, m) => sum + m.iterations, 0) /
      Math.max(1, this.metrics.length);

    if (avgIterations > 10) {
      insights.push({
        category: 'iteration_count',
        description: `High average iterations: ${avgIterations.toFixed(1)}`,
        suggestion: 'Consider improving system prompts or adding more explicit instructions to reduce iterations.',
        impact: 'medium',
        confidence: 0.7,
      });
    }

    // Analyze context usage
    const avgTokens = this.metrics.reduce((sum, m) => sum + m.tokensUsed, 0) /
      Math.max(1, this.metrics.length);

    if (avgTokens > 5000) {
      insights.push({
        category: 'context_usage',
        description: `High token usage: ${avgTokens.toFixed(0)} tokens average`,
        suggestion: 'Enable context compaction and review prompt lengths. Consider using cheaper models for simple tasks.',
        impact: 'high',
        confidence: 0.9,
      });
    }

    // Analyze success rate
    const successRate = this.metrics.filter(m => m.success).length /
      Math.max(1, this.metrics.length);

    if (successRate < 0.7) {
      insights.push({
        category: 'prompt_engineering',
        description: `Low success rate: ${(successRate * 100).toFixed(1)}%`,
        suggestion: 'Review and improve system prompts. Add more examples and clearer instructions.',
        impact: 'high',
        confidence: 0.85,
      });
    }

    return insights;
  }

  async getRecommendations(): Promise<string[]> {
    const insights = await this.analyze();
    return insights
      .filter((i: HarnessInsight) => i.confidence > 0.7)
      .sort((a: HarnessInsight, b: HarnessInsight) => {
        const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return impactOrder[a.impact] - impactOrder[b.impact];
      })
      .map((i: HarnessInsight) => i.suggestion);
  }

  reset(): void {
    this.metrics = [];
  }
}
