import { describe, expect, it, vi } from 'vitest';
import { BuildPhase } from '../../../src/pipeline/phases/BuildPhase';
import { createPipelineContext } from '../../../src/pipeline/types';
import { createFastTrackPlan } from '../../../src/pipeline/planUtils';
import { buildContextPacket } from '../../../src/pipeline/planUtils';
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
    requestApproval: vi.fn(),
    emitArtifact: vi.fn(),
    emitPhaseLifecycle: vi.fn(),
    ...overrides,
  };
}

describe('BuildPhase', () => {
  it('skips when plan or context missing', async () => {
    const phase = new BuildPhase();
    const host = makeHost();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'g',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'low', constraints: [] },
      tier: 'LOW',
      phases: ['build'],
    });
    const services = {
      toolManager: { autoInstallToolsForTask: vi.fn(async () => []) },
      taskCompass: { checkAlignment: vi.fn(() => ({ aligned: true, driftScore: 0 })) },
      memory: { setArtifactManifest: vi.fn() },
      runCoders: vi.fn(),
    } as unknown as PipelineServices;

    const outcome = await phase.run(host, ctx, services);
    expect(outcome.skipped).toBe(true);
    expect(services.runCoders).not.toHaveBeenCalled();
  });

  it('runs coders and stores artifacts', async () => {
    const phase = new BuildPhase();
    const host = makeHost();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'Build app',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'low', constraints: [] },
      tier: 'LOW',
      phases: ['build'],
    });
    ctx.plan = createFastTrackPlan('t1', 'Build app', 'Build app', ctx.workspace);
    ctx.contextPacket = buildContextPacket(ctx);

    const artifacts = [{ filePath: 'src/app.ts', content: 'code', hash: 'h1' }];
    const services = {
      toolManager: { autoInstallToolsForTask: vi.fn(async () => []) },
      taskCompass: { checkAlignment: vi.fn(() => ({ aligned: true, driftScore: 0 })) },
      memory: { setArtifactManifest: vi.fn() },
      runCoders: vi.fn(async () => artifacts),
    } as unknown as PipelineServices;

    const outcome = await phase.run(host, ctx, services);

    expect(outcome.skipped).toBeUndefined();
    expect(ctx.artifacts).toEqual(artifacts);
    expect(services.runCoders).toHaveBeenCalled();
    expect(host.emitPhaseLifecycle).toHaveBeenCalledWith('build', 'completed', expect.objectContaining({ artifactCount: 1 }));
  });
});
