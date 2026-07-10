import { describe, expect, it, vi } from 'vitest';
import { DeliverPhase } from '../../../src/pipeline/phases/DeliverPhase';
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
    getElapsedMs: () => 5000,
  };
}

describe('DeliverPhase', () => {
  it('delivers artifacts and emits DELIVERY_COMPLETE', async () => {
    const phase = new DeliverPhase();
    const host = makeHost();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'g',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'low', constraints: [] },
      tier: 'HIGH',
      phases: ['deliver'],
    });
    ctx.verdict = { verdict: 'PASS', subtaskId: 'v1', criteria: [], risks: [], decision: 'ACCEPT' };
    ctx.artifacts = [{ filePath: 'src/app.ts', content: 'code', hash: 'h' }];

    const services = {
      artifacts: { openInEditor: vi.fn(async () => {}), listGenerated: vi.fn(() => []) },
      ledger: { getLedgerPath: vi.fn(() => '/ledger.jsonl'), append: vi.fn() },
    } as unknown as PipelineServices;

    const outcome = await phase.run(host, ctx, services);

    expect(outcome.report?.verdict).toBe('PASS');
    expect(ctx.deliveryReport).toBeDefined();
    expect(host.eventBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DELIVERY_COMPLETE' })
    );
    expect(services.ledger.append).toHaveBeenCalled();
  });

  it('skips open editor on FAIL for HIGH tier', async () => {
    const phase = new DeliverPhase();
    const host = makeHost();
    const ctx = createPipelineContext({
      taskId: 't1',
      rawGoal: 'g',
      workspace: { fileTree: [] },
      goalPacket: { taskId: 't1', intent: 'build', complexity: 'high', constraints: [] },
      tier: 'HIGH',
      phases: ['deliver'],
    });
    ctx.verdict = { verdict: 'FAIL', subtaskId: 'v1', criteria: [], risks: [] };
    ctx.artifacts = [{ filePath: 'src/app.ts', content: 'code', hash: 'h' }];

    const openInEditor = vi.fn();
    const services = {
      artifacts: { openInEditor, listGenerated: vi.fn(() => []) },
      ledger: { getLedgerPath: vi.fn(() => '/ledger.jsonl'), append: vi.fn() },
    } as unknown as PipelineServices;

    await phase.run(host, ctx, services);
    expect(openInEditor).not.toHaveBeenCalled();
  });
});
