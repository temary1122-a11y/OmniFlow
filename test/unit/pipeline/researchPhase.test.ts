import { describe, expect, it, vi } from 'vitest';
import { ResearchPhase } from '../../../src/pipeline/phases/ResearchPhase';
import { createPipelineContext } from '../../../src/pipeline/types';
import type { PipelineHost, PipelineServices } from '../../../src/pipeline/types';
import type { ResearchReport } from '../../../shared/types';

function makeHost(overrides: Partial<PipelineHost> = {}): PipelineHost {
  return {
    workspaceRoot: '/tmp/ws',
    eventBus: { emit: vi.fn() } as unknown as PipelineHost['eventBus'],
    phaseEngine: {} as PipelineHost['phaseEngine'],
    chat: vi.fn(),
    setAgent: vi.fn(),
    transitionPhase: vi.fn(),
    runPhaseSafely: vi.fn(async (fn) => fn()),
    requestApiKeyPrompt: vi.fn(),
    askClarifyingQuestions: vi.fn(async () => []),
    refineGoal: vi.fn((goal) => goal),
    emitPhaseLifecycle: vi.fn(),
    ...overrides,
  };
}

function makeServices(overrides: Partial<PipelineServices> = {}): PipelineServices {
  const report: ResearchReport = {
    taskId: 't1',
    summary: 'ok',
    terms: [],
    bestPractices: [],
    patterns: [],
    sources: ['https://example.com'],
  };
  return {
    researcher: {
      execute: vi.fn(async () => ({
        artifacts: [{ content: JSON.stringify(report), filePath: 'r.json', contentType: 'doc' as const }],
      })),
      setSearchMode: vi.fn(),
      getLastLlmResponse: vi.fn(),
    } as unknown as PipelineServices['researcher'],
    clarifier: {
      generateCriticalQuestionsFromResearch: vi.fn(async () => []),
      getLastLlmResponse: vi.fn(),
    } as unknown as PipelineServices['clarifier'],
    toolManager: {
      autoInstallToolsForTask: vi.fn(async () => []),
      getToolsForAgent: vi.fn(() => []),
    } as unknown as PipelineServices['toolManager'],
    memory: {
      setResearchReport: vi.fn(),
      setGoalPacket: vi.fn(),
    } as unknown as PipelineServices['memory'],
    taskCompass: {
      checkAlignment: vi.fn(() => ({ aligned: true, driftScore: 0 })),
    } as unknown as PipelineServices['taskCompass'],
    apiKeys: {},
    ...overrides,
  };
}

describe('ResearchPhase', () => {
  it('skips when research not in tier phases', async () => {
    const phase = new ResearchPhase();
    const host = makeHost();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'goal',
      workspace: { root: '/tmp', files: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'low', constraints: [] },
      tier: 'LOW',
      phases: ['planning', 'build'],
    });
    const outcome = await phase.run(host, ctx, makeServices());

    expect(outcome.skipped).toBe(true);
    expect(ctx.refinedGoal).toBe('goal');
    expect(host.emitPhaseLifecycle).toHaveBeenCalledWith('research', 'skipped', expect.any(Object));
    expect(host.transitionPhase).not.toHaveBeenCalled();
  });

  it('runs research and updates context when phase is enabled', async () => {
    const phase = new ResearchPhase();
    const host = makeHost();
    const services = makeServices();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'Build API',
      workspace: { root: '/tmp', files: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'high', constraints: [] },
      tier: 'HIGH',
      phases: ['research', 'planning'],
    });

    const outcome = await phase.run(host, ctx, services);

    expect(outcome.skipped).toBeUndefined();
    expect(outcome.durationMs).toBeGreaterThanOrEqual(0);
    expect(ctx.researchReport?.summary).toBe('ok');
    expect(ctx.refinedGoal).toBe('Build API');
    expect(services.memory.setResearchReport).toHaveBeenCalled();
    expect(host.emitPhaseLifecycle).toHaveBeenCalledWith('research', 'started', expect.any(Object));
    expect(host.emitPhaseLifecycle).toHaveBeenCalledWith('research', 'completed', expect.any(Object));
  });
});
