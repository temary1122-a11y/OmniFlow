import type { HandoffContract } from '../../../shared/types';
import type {
  PipelineContext,
  PipelineHost,
  PipelinePhase,
  PipelineServices,
  PhaseOutcome,
} from '../types';

function buildAuditContract(ctx: PipelineContext): HandoffContract {
  const artifactTargets = ctx.artifacts.map((a) => ({
    filePath: a.filePath,
    contentType: 'code' as const,
  }));
  return {
    subtaskId: `audit_${ctx.taskId}`,
    agentRole: 'auditor',
    successCriteria: ['Audit complete'],
    artifactTargets,
    contextPacket: ctx.contextPacket!,
    compassPath: ctx.compassPath,
  };
}

/**
 * Runs audit and security agents concurrently when tier phases include them.
 */
export class AuditSecurityPhase implements PipelinePhase {
  readonly id = 'audit' as const;

  canRun(ctx: PipelineContext): boolean {
    return ctx.phases.includes('audit') || ctx.phases.includes('security');
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<PhaseOutcome> {
    if (!this.canRun(ctx)) {
      host.emitPhaseLifecycle('audit', 'skipped', { reason: 'not in tier phases' });
      return { phase: 'audit', skipped: true };
    }

    const started = Date.now();
    host.emitPhaseLifecycle('audit', 'started', { taskId: ctx.taskId });

    const auditContract = buildAuditContract(ctx);
    const auditExecContract: HandoffContract = { ...auditContract, boundary: ['.omniflow/audit'] };
    const secExecContract: HandoffContract = {
      ...auditContract,
      subtaskId: `sec_${ctx.taskId}`,
      agentRole: 'security',
      boundary: ['.omniflow/security'],
    };

    if (ctx.phases.includes('audit')) {
      host.transitionPhase('audit');
      host.setAgent('auditor', 'working');
    } else if (ctx.phases.includes('security')) {
      host.transitionPhase('security');
      host.setAgent('security', 'working');
    }

    const auditPromise = ctx.phases.includes('audit')
      ? host
          .runPhaseSafely(() => services.auditor.execute(auditExecContract, host.workspaceRoot), 'audit')
          .then(() => {
            host.setAgent('auditor', 'done');
          })
      : Promise.resolve();

    const secPromise = ctx.phases.includes('security')
      ? host
          .runPhaseSafely(() => services.security.execute(secExecContract, host.workspaceRoot), 'security')
          .then((secManifest) => {
            const r = JSON.parse(secManifest.artifacts[0].content);
            services.memory.setSecurityReport(r);
            host.setAgent('security', r.passed ? 'done' : 'blocked', r.passed ? 'Clean' : 'Issues found');
          })
      : Promise.resolve();

    await Promise.all([auditPromise, secPromise]);

    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('audit', 'completed', { taskId: ctx.taskId, durationMs });
    return { phase: 'audit', durationMs };
  }
}

export const auditSecurityPhase = new AuditSecurityPhase();
