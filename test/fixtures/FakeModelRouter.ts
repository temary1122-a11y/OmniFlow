import { ModelRouter } from '../../src/routing/ModelRouter';
import type { LLMResponse } from '../../src/routing/LLMClient';

export interface FakeStep {
  content?: string;
  toolCalls?: Array<{ name: string; arguments: any }>;
  reasoning?: string;
}

/**
 * Scripted ModelRouter used by the offline research-loop tests. It replays a queue of
 * steps instead of calling any network provider. When the queue is exhausted it returns
 * an empty final content (no tool calls) so the agent's ReAct loop terminates.
 */
export class FakeModelRouter extends ModelRouter {
  private steps: FakeStep[];
  callCount = 0;

  constructor(steps: FakeStep[], budget?: 'free' | 'low' | 'normal' | 'high', workspaceRoot?: string) {
    super(budget, workspaceRoot);
    this.steps = steps;
  }

  async call(
    _req: any,
    _prompt: string,
    _systemPrompt: string,
    _apiKeys: Record<string, string>,
    _forceProvider?: string,
    _tools?: any[]
  ): Promise<LLMResponse> {
    this.callCount++;
    const step = this.steps[this.callCount - 1];
    if (!step) {
      return { content: '', provider: 'fake', model: 'fake', usedFallback: false };
    }
    return {
      content: step.content ?? '',
      provider: 'fake',
      model: 'fake',
      usedFallback: false,
      reasoning: step.reasoning,
      toolCalls: (step.toolCalls ?? []).map((t, i) => ({
        id: 'call_' + i,
        name: t.name,
        arguments: t.arguments,
      })),
    };
  }
}
