import type { HandoffContract, VerificationVerdictReport } from '../../../shared/types';
import type {
  PipelineContext,
  PipelineHost,
  PipelinePhase,
  PipelineServices,
  VerifyPhaseOutcome,
} from '../types';

const MAX_VERIFY_RETRIES = 3;

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

function syntheticPassVerdict(taskId: string): VerificationVerdictReport {
  return {
    verdict: 'PASS',
    subtaskId: `verify_${taskId}`,
    criteria: [],
    risks: [],
    decision: 'ACCEPT',
  };
}

export class VerifyPhase implements PipelinePhase {
  readonly id = 'verify' as const;

  canRun(ctx: PipelineContext): boolean {
    return Boolean(ctx.contextPacket && ctx.artifacts.length >= 0);
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<VerifyPhaseOutcome> {
    if (!ctx.phases.includes('verify')) {
      const verdict = syntheticPassVerdict(ctx.taskId);
      ctx.verdict = verdict;
      host.emitPhaseLifecycle('verify', 'skipped', { reason: 'fast-track tier' });
      return { phase: 'verify', skipped: true, verdict, decision: 'accept' };
    }

    const started = Date.now();
    host.emitPhaseLifecycle('verify', 'started', { taskId: ctx.taskId });
    host.transitionPhase('verify');
    host.setAgent('verifier', 'working');

    const auditContract = buildAuditContract(ctx);
    const verifyContract: HandoffContract = {
      ...auditContract,
      subtaskId: `verify_${ctx.taskId}`,
      agentRole: 'verifier',
    };

    const verifyManifest = await services.verifier.execute(verifyContract, host.workspaceRoot);
    const verdict = JSON.parse(verifyManifest.artifacts[0].content) as VerificationVerdictReport;
    ctx.verdict = verdict;

    host.setAgent('verifier', 'done', verdict.verdict);
    host.eventBus.emit({
      type: 'VERIFICATION_RESULT',
      payload: { subtaskId: verifyContract.subtaskId, verdict: verdict.verdict, risks: verdict.risks },
    });

    const decision = verdict.decision ?? (verdict.verdict === 'PASS' ? 'ACCEPT' : 'REJECT');
    let loopDecision: VerifyPhaseOutcome['decision'] = 'accept';

    if (services.sharedMemory) {
      services.sharedMemory.recordEpisode(
        'verification',
        { verdict: verdict.verdict, decision, subtaskId: verifyContract.subtaskId, failedCriteria: verdict.failedCriteria },
        verdict.verdict === 'FAIL' ? 0.85 : 0.4
      );
    }

    if (decision === 'REJECT') {
      loopDecision = 'reject';
    } else if (decision === 'ESCALATE') {
      loopDecision = 'escalate';
      host.eventBus.emit({
        type: 'ERROR_OCCURRED',
        payload: {
          error: 'Verification escalated: ' + (verdict.feedback ?? 'manual review required'),
          phase: 'verify',
          recoverable: true,
        },
      });
    } else {
      host.chat('assistant', `Verification passed (decision: ${decision}).`);
    }

    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('verify', 'completed', { taskId: ctx.taskId, durationMs, decision: loopDecision });
    return { phase: 'verify', durationMs, verdict, decision: loopDecision };
  }
}

export const verifyPhase = new VerifyPhase();
export { MAX_VERIFY_RETRIES };
