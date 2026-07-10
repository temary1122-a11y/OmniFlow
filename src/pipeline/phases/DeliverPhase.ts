import type { DeliveryReport } from '../../../shared/types';
import { detectRunInstructions } from '../deliverUtils';
import type {
  DeliverPhaseOutcome,
  PipelineContext,
  PipelineHost,
  PipelinePhase,
  PipelineServices,
} from '../types';

export class DeliverPhase implements PipelinePhase {
  readonly id = 'deliver' as const;

  canRun(ctx: PipelineContext): boolean {
    return Boolean(ctx.verdict && ctx.goalPacket);
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<DeliverPhaseOutcome> {
    if (!this.canRun(ctx)) {
      host.emitPhaseLifecycle('deliver', 'skipped', { reason: 'no verdict or goal packet' });
      return { phase: 'deliver', skipped: true };
    }

    const started = Date.now();
    host.emitPhaseLifecycle('deliver', 'started', { taskId: ctx.taskId });
    host.transitionPhase('deliver');

    const verdict = ctx.verdict!;
    const artifacts = ctx.artifacts;
    const opened: DeliveryReport['artifacts'] = [];
    const deliverable = ctx.tier === 'LOW' || verdict.verdict !== 'FAIL';

    if (deliverable && artifacts[0]) {
      try {
        await services.artifacts.openInEditor(artifacts[0].filePath);
        opened.push({ filePath: artifacts[0].filePath, opened: true });
      } catch {
        opened.push({ filePath: artifacts[0].filePath, opened: false });
      }
    }

    const runInstructions = await detectRunInstructions({
      workspaceRoot: host.workspaceRoot,
      eventBus: host.eventBus,
      artifacts: services.artifacts,
    });

    const tierLabel =
      ctx.tier === 'LOW' ? ' [LOW/fast-track]' : ctx.tier === 'MEDIUM' ? ' [MEDIUM]' : '';
    const report: DeliveryReport = {
      taskId: ctx.goalPacket.taskId,
      artifacts: artifacts.map((a) => ({
        filePath: a.filePath,
        opened: opened.some((o) => o.filePath === a.filePath),
      })),
      verdict: verdict.verdict,
      durationMs: host.getElapsedMs(),
      ledgerPath: services.ledger.getLedgerPath(),
      runInstructions,
      summary: `Delivered ${artifacts.length} artifact(s). Verdict: ${verdict.verdict}${tierLabel}. ${runInstructions}`,
    };

    ctx.deliveryReport = report;
    host.eventBus.emit({ type: 'DELIVERY_COMPLETE', payload: { taskId: ctx.taskId, report } });
    host.chat('assistant', report.summary);
    services.ledger.append({ type: 'delivery', data: report as unknown as Record<string, unknown> });

    host.setAgent('orchestrator', 'done', 'Complete');
    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('deliver', 'completed', { taskId: ctx.taskId, durationMs });
    return { phase: 'deliver', durationMs, report };
  }
}

export const deliverPhase = new DeliverPhase();
