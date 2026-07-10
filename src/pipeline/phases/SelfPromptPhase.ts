import type { PipelineContext, PipelineHost, PipelinePhase, PipelineServices, PhaseOutcome } from '../types';

export class SelfPromptPhase implements PipelinePhase {
  readonly id = 'self-prompt' as const;

  canRun(ctx: PipelineContext): boolean {
    return Boolean(ctx.useSelfPrompting);
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<PhaseOutcome> {
    if (!this.canRun(ctx)) {
      host.emitPhaseLifecycle('self-prompt', 'skipped', { reason: 'self-prompting not enabled for tier' });
      return { phase: 'self-prompt', skipped: true };
    }

    const started = Date.now();
    host.emitPhaseLifecycle('self-prompt', 'started', { taskId: ctx.taskId, mode: 'self-prompt' });
    host.setAgent('orchestrator', 'working', 'Self-prompting refinement');

    try {
      const sp = await services.promptOrchestrator.runSelfPromptingLoop(ctx.refinedGoal);
      if (sp.converged && sp.finalGoal && sp.finalGoal.trim().length > 0) {
        ctx.refinedGoal = sp.finalGoal;
        host.chat('system', `Self-prompting converged in ${sp.rounds} rounds — goal refined.`);
      }
    } catch (err) {
      host.chat('system', 'Self-prompting skipped: ' + (err instanceof Error ? err.message : String(err)));
    }

    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('self-prompt', 'completed', { taskId: ctx.taskId, durationMs, mode: 'self-prompt' });
    return { phase: 'self-prompt', durationMs };
  }
}

export const selfPromptPhase = new SelfPromptPhase();
