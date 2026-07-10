import { describe, expect, it, vi } from 'vitest';
import { AuditSecurityPhase } from '../../../src/pipeline/phases/AuditSecurityPhase';
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

describe('AuditSecurityPhase', () => {
  it('skips when audit and security not in phases', async () => {
    const phase = new AuditSecurityPhase();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'g',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'low', constraints: [] },
      tier: 'LOW',
      phases: ['build'],
    });
    ctx.artifacts = [{ filePath: 'a.ts', content: 'x', hash: 'h' }];
    ctx.contextPacket = { taskId: 't1', goal: 'g', workspaceSnapshot: { fileTree: [] } };

    const outcome = await phase.run(makeHost(), ctx, {} as PipelineServices);
    expect(outcome.skipped).toBe(true);
  });

  it('runs audit and security in parallel', async () => {
    const phase = new AuditSecurityPhase();
    const host = makeHost();
    const auditor = { execute: vi.fn(async () => ({ artifacts: [] })) };
    const security = {
      execute: vi.fn(async () => ({
        artifacts: [{ content: JSON.stringify({ passed: true }), filePath: 's.json', contentType: 'doc' as const }],
      })),
    };
    const services = {
      auditor,
      security,
      memory: { setSecurityReport: vi.fn() },
    } as unknown as PipelineServices;

    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'g',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'high', constraints: [] },
      tier: 'HIGH',
      phases: ['build', 'audit', 'security'],
    });
    ctx.artifacts = [{ filePath: 'a.ts', content: 'code', hash: 'h' }];
    ctx.contextPacket = { taskId: 't1', goal: 'g', workspaceSnapshot: { fileTree: [] } };

    await phase.run(host, ctx, services);

    expect(auditor.execute).toHaveBeenCalled();
    expect(security.execute).toHaveBeenCalled();
    expect(host.setAgent).toHaveBeenCalledWith('auditor', 'done');
  });
});
