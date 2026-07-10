import type { PipelineContext, PipelineHost, PipelinePhase, PipelineServices, PhaseOutcome } from '../types';

export class ContextEnrichPhase implements PipelinePhase {
  readonly id = 'context-enrich' as const;

  canRun(ctx: PipelineContext): boolean {
    return Boolean(ctx.contextPacket);
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<PhaseOutcome> {
    if (!this.canRun(ctx)) {
      host.emitPhaseLifecycle('context-enrich', 'skipped', { reason: 'no context packet' });
      return { phase: 'context-enrich', skipped: true };
    }

    const started = Date.now();
    host.emitPhaseLifecycle('context-enrich', 'started', { taskId: ctx.taskId });

    const enrichment = await services.contextAgent.enrich(ctx.refinedGoal, ctx.contextPacket);
    if (enrichment.memoryContext && ctx.contextPacket) {
      ctx.contextPacket = {
        ...ctx.contextPacket,
        memoryContext: enrichment.memoryContext,
      };
      services.memory.setContextPacket(ctx.contextPacket);
    }
    if (enrichment.memoryContext) {
      host.chat(
        'system',
        `🧠 Memory context: ${enrichment.episodeCount} episodes, skill=${enrichment.skillFound}, ${enrichment.artifactCount} artifacts`
      );
    }

    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('context-enrich', 'completed', { taskId: ctx.taskId, durationMs });
    return { phase: 'context-enrich', durationMs };
  }
}

export const contextEnrichPhase = new ContextEnrichPhase();
