import { describe, expect, it, vi } from 'vitest';
import { VerifyPhase } from '../../../src/pipeline/phases/VerifyPhase';
import { createPipelineContext } from '../../../src/pipeline/types';
import type { PipelineHost, PipelineServices } from '../../../src/pipeline/types';

function makeHost(): PipelineHost {
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
    refineGoal: vi.fn((g) => g),
    requestApproval: vi.fn(),
    emitArtifact: vi.fn(),
    emitPhaseLifecycle: vi.fn(),
  };
}

describe('VerifyPhase', () => {
  it('synthesizes PASS for fast-track tiers', async () => {
    const phase = new VerifyPhase();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'g',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'low', constraints: [] },
      tier: 'LOW',
      phases: ['build'],
    });
    ctx.artifacts = [];
    ctx.contextPacket = { taskId: 't1', goal: 'g', workspaceSnapshot: { fileTree: [] } };

    const outcome = await phase.run(makeHost(), ctx, {} as PipelineServices);

    expect(outcome.skipped).toBe(true);
    expect(outcome.decision).toBe('accept');
    expect(outcome.verdict.verdict).toBe('PASS');
  });

  it('returns reject decision from verifier', async () => {
    const phase = new VerifyPhase();
    const host = makeHost();
    const verdict = {
      verdict: 'FAIL',
      subtaskId: 'verify_t1',
      criteria: [],
      risks: [],
      decision: 'REJECT',
      feedback: 'missing tests',
      failedCriteria: ['Tests'],
    };
    const services = {
      verifier: {
        execute: vi.fn(async () => ({
          artifacts: [{ content: JSON.stringify(verdict), filePath: 'v.json', contentType: 'doc' as const }],
        })),
      },
    } as unknown as PipelineServices;

    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'g',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'high', constraints: [] },
      tier: 'HIGH',
      phases: ['build', 'verify'],
    });
    ctx.artifacts = [{ filePath: 'a.ts', content: 'x', hash: 'h' }];
    ctx.contextPacket = { taskId: 't1', goal: 'g', workspaceSnapshot: { fileTree: [] } };

    const outcome = await phase.run(host, ctx, services);

    expect(outcome.decision).toBe('reject');
    expect(ctx.verdict?.feedback).toBe('missing tests');
  });
});
