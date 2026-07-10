import { describe, expect, it, vi } from 'vitest';
import { PlanningPhase } from '../../../src/pipeline/phases/PlanningPhase';
import { createPipelineContext } from '../../../src/pipeline/types';
import type { PipelineHost, PipelineServices } from '../../../src/pipeline/types';

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
    requestApproval: vi.fn(async () => ({ approved: true, requestId: 'a1' })),
    emitArtifact: vi.fn(),
    emitPhaseLifecycle: vi.fn(),
    ...overrides,
  };
}

function makeServices(overrides: Partial<PipelineServices> = {}): PipelineServices {
  const plan = {
    planId: 'plan_t1',
    stack: ['TypeScript'],
    architecture: 'Modular API',
    subtasks: [
      {
        subtaskId: 'c1',
        agentRole: 'coder' as const,
        successCriteria: ['API routes'],
        artifactTargets: [{ filePath: 'src/api.ts', contentType: 'code' as const }],
        contextPacket: { taskId: 't1', goal: 'g', workspaceSnapshot: { fileTree: [] } },
      },
    ],
    estimatedDuration: 0,
    totalSubtasks: 1,
  };
  return {
    researcher: {} as PipelineServices['researcher'],
    clarifier: {} as PipelineServices['clarifier'],
    planner: {
      execute: vi.fn(async () => ({
        artifacts: [{ content: JSON.stringify(plan), filePath: 'plan.json', contentType: 'config' as const }],
      })),
    } as unknown as PipelineServices['planner'],
    toolManager: {} as PipelineServices['toolManager'],
    memory: {
      setExecutionPlan: vi.fn(),
      setContextPacket: vi.fn(),
    } as unknown as PipelineServices['memory'],
    taskCompass: {
      checkAlignment: vi.fn(() => ({ aligned: true, driftScore: 0 })),
    } as unknown as PipelineServices['taskCompass'],
    apiKeys: {},
    runCoders: vi.fn(),
    ...overrides,
  };
}

describe('PlanningPhase', () => {
  it('creates fast-track plan when planning skipped', async () => {
    const phase = new PlanningPhase();
    const host = makeHost();
    const services = makeServices();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'Build app',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'low', constraints: [] },
      tier: 'LOW',
      phases: ['build'],
    });

    const outcome = await phase.run(host, ctx, services);

    expect(outcome.skipped).toBe(true);
    expect(ctx.plan?.subtasks).toHaveLength(1);
    expect(ctx.contextPacket?.goal).toBe('Build app');
    expect(services.memory.setExecutionPlan).toHaveBeenCalled();
  });

  it('runs planner and requests approval when planning enabled', async () => {
    const phase = new PlanningPhase();
    const host = makeHost();
    const services = makeServices();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'Build API',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'high', constraints: [] },
      tier: 'HIGH',
      phases: ['planning', 'build'],
    });

    const outcome = await phase.run(host, ctx, services);

    expect(outcome.skipped).toBeUndefined();
    expect(ctx.plan?.architecture).toBe('Modular API');
    expect(ctx.compassPath).toContain('compass.md');
    expect(host.requestApproval).toHaveBeenCalled();
    expect(host.emitPhaseLifecycle).toHaveBeenCalledWith('planning', 'completed', expect.any(Object));
  });
});
