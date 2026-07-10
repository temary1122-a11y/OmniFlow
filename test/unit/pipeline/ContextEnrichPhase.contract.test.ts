import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ContextEnrichPhase } from '../../../src/pipeline/phases/ContextEnrichPhase';
import type { PipelineContext, PipelineHost, PipelineServices, PhaseOutcome } from '../../../src/pipeline/types';
import type { ContextEnrichment } from '../../../src/agents/ContextAgent';

describe('ContextEnrichPhase contract', () => {
  let phase: ContextEnrichPhase;
  let ctx: PipelineContext;
  let host: PipelineHost;
  let services: PipelineServices;

  beforeEach(() => {
    phase = new ContextEnrichPhase();

    ctx = {
      taskId: 'task-123',
      rawGoal: 'test goal',
      workspace: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
      goalPacket: {
        taskId: 'task-123',
        intent: 'build',
        complexity: 'low',
        goal: 'test goal',
        workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
      },
      tier: 'LOW',
      phases: ['context-enrich'],
      artifacts: [],
      contextPacket: {
        taskId: 'task-123',
        goal: 'test goal',
        workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
        planSummary: '',
        researchSummary: undefined,
        researchReport: undefined,
        bounceContext: undefined,
        agentsMd: undefined,
        omniMd: undefined,
        plannedStack: undefined,
        memoryContext: undefined,
      },
      compassPath: undefined,
      refinedGoal: 'refined test goal',
    };

    host = {
      workspaceRoot: '/workspace',
      emitPhaseLifecycle: vi.fn(),
      transitionTo: vi.fn(),
      setAgent: vi.fn(),
      transitionPhase: vi.fn(),
      runPhaseSafely: vi.fn(async (fn) => fn()),
      requestApiKeyPrompt: vi.fn(),
      askClarifyingQuestions: vi.fn(async () => []),
      refineGoal: vi.fn((g) => g),
      requestApproval: vi.fn(async () => ({ approved: true, feedback: '', requestId: 'req-1' })),
      emitArtifact: vi.fn(),
      getElapsedMs: () => 100,
      scanWorkspace: vi.fn(async () => ({ fileTree: ['src/'], hasPackageJson: true, hasReadme: false, techStack: ['typescript'] })),
      draftProjectDocs: vi.fn(async () => ({ agentsMd: '# AGENTS.md', omniMd: '# OMNI.md' })),
      readProjectDocs: () => ({ agentsMd: '# AGENTS.md', omniMd: '# OMNI.md' }),
      chat: vi.fn(),
    };

    services = {
      contextAgent: {
        enrich: vi.fn(),
      },
      memory: {
        setContextPacket: vi.fn(),
      },
      clarifier: { execute: vi.fn() },
      roleSelector: { select: vi.fn() },
      modelIndexer: undefined,
      router: undefined,
    } as unknown as PipelineServices;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('canRun', () => {
    it('returns true when contextPacket exists', () => {
      expect(phase.canRun(ctx)).toBe(true);
    });

    it('returns false when contextPacket is null', () => {
      ctx.contextPacket = null as any;
      expect(phase.canRun(ctx)).toBe(false);
    });

    it('returns false when contextPacket is undefined', () => {
      ctx.contextPacket = undefined as any;
      expect(phase.canRun(ctx)).toBe(false);
    });
  });

  describe('run', () => {
it('calls contextAgent.enrich with refinedGoal and contextPacket', async () => {
  const mockEnrichment: ContextEnrichment = {
    memoryContext: 'some memory context',
    episodeCount: 2,
    skillFound: true,
    artifactCount: 3,
    semanticNodeCount: 1,
  };
  (services.contextAgent.enrich as mock.Mock).mockResolvedValue(mockEnrichment);

  await phase.run(host, ctx, services);

  const expectedContextPacket = {
    taskId: 'task-123',
    goal: 'test goal',
    workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
    planSummary: '',
    researchSummary: undefined,
    researchReport: undefined,
    bounceContext: undefined,
    agentsMd: undefined,
    omniMd: undefined,
    plannedStack: undefined,
    memoryContext: undefined,
  };

  expect(services.contextAgent.enrich).toHaveBeenCalledWith(
    ctx.refinedGoal,
    expect.objectContaining(expectedContextPacket)
  );
});

    it('updates contextPacket.memoryContext and calls memory.setContextPacket when enrichment.memoryContext exists', async () => {
      const mockEnrichment: ContextEnrichment = {
        memoryContext: 'some memory context',
        episodeCount: 2,
        skillFound: true,
        artifactCount: 3,
        semanticNodeCount: 1,
      };
      (services.contextAgent.enrich as mock.Mock).mockResolvedValue(mockEnrichment);

      await phase.run(host, ctx, services);

      // Check that contextPacket was updated
      expect(ctx.contextPacket).toHaveProperty('memoryContext', 'some memory context');
      // Check that memory.setContextPacket was called with the updated contextPacket
      expect(services.memory.setContextPacket).toHaveBeenCalledWith(
        expect.objectContaining({ memoryContext: 'some memory context' })
      );
    });

it('does not update contextPacket or call memory.setContextPacket when enrichment.memoryContext is empty', async () => {
  const mockEnrichment: ContextEnrichment = {
    memoryContext: '',
    episodeCount: 0,
    skillFound: false,
    artifactCount: 0,
    semanticNodeCount: 0,
  };
  (services.contextAgent.enrich as mock.Mock).mockResolvedValue(mockEnrichment);

  await phase.run(host, ctx, services);

  // Check that the contextPacket has not been unexpectedly modified
  expect(ctx.contextPacket).toMatchObject({
    taskId: 'task-123',
    goal: 'test goal',
    workspaceSnapshot: { fileTree: [], hasPackageJson: false, hasReadme: false, techStack: [] },
    planSummary: '',
    researchSummary: undefined,
    researchReport: undefined,
    bounceContext: undefined,
    agentsMd: undefined,
    omniMd: undefined,
    plannedStack: undefined,
  });
  // Specifically ensure memoryContext is not present (undefined)
  expect(ctx.contextPacket.memoryContext).toBeUndefined();
  // memory.setContextPacket should not have been called
  expect(services.memory.setContextPacket).not.toHaveBeenCalled();
});

    it('calls host.chat with a message when enrichment.memoryContext exists', async () => {
      const mockEnrichment: ContextEnrichment = {
        memoryContext: 'some memory context',
        episodeCount: 2,
        skillFound: true,
        artifactCount: 3,
        semanticNodeCount: 1,
      };
      (services.contextAgent.enrich as mock.Mock).mockResolvedValue(mockEnrichment);

      await phase.run(host, ctx, services);

      expect(host.chat).toHaveBeenCalledWith(
        'system',
        expect.stringContaining('🧠 Memory context: 2 episodes, skill=true, 3 artifacts')
      );
    });

    it('does not call host.chat when enrichment.memoryContext is empty', async () => {
      const mockEnrichment: ContextEnrichment = {
        memoryContext: '',
        episodeCount: 0,
        skillFound: false,
        artifactCount: 0,
        semanticNodeCount: 0,
      };
      (services.contextAgent.enrich as mock.Mock).mockResolvedValue(mockEnrichment);

      await phase.run(host, ctx, services);

      expect(host.chat).not.toHaveBeenCalled();
    });
  });
});