import type { VerificationVerdictReport } from '../../shared/types';
import type { BuildArtifact } from './buildRunner';
import { buildPhase } from './phases/BuildPhase';
import { auditSecurityPhase } from './phases/AuditSecurityPhase';
import { verifyPhase, MAX_VERIFY_RETRIES } from './phases/VerifyPhase';
import type { PipelineContext, PipelineHost, PipelineServices } from './types';

export interface BuildVerifyLoopOptions {
  maxRetries?: number;
  /** Reset agent graph/status before a verify-bounce rebuild. */
  onBeforeRetry?: () => void;
}

export interface BuildVerifyLoopResult {
  verdict: VerificationVerdictReport;
  artifacts: BuildArtifact[];
}

/**
 * Build → audit/security → verify cycle with verify-bounce retries.
 */
export async function runBuildVerifyLoop(
  host: PipelineHost,
  ctx: PipelineContext,
  services: PipelineServices,
  options: BuildVerifyLoopOptions = {}
): Promise<BuildVerifyLoopResult> {
  const maxRetries = options.maxRetries ?? MAX_VERIFY_RETRIES;
  let retries = 0;

  while (true) {
    host.assertNotCancelled();
    await buildPhase.run(host, ctx, services);
    await auditSecurityPhase.run(host, ctx, services);

    const verifyOutcome = await verifyPhase.run(host, ctx, services);
    const verdict = verifyOutcome.verdict;

    if (verifyOutcome.decision === 'accept') {
      return { verdict, artifacts: ctx.artifacts };
    }

    if (verifyOutcome.decision === 'escalate') {
      return { verdict, artifacts: ctx.artifacts };
    }

    // REJECT — bounce back to build with feedback
    if (retries < maxRetries) {
      host.eventBus.emit({
        type: 'VERIFY_BOUNCE',
        payload: {
          attempt: retries + 1,
          failedCriteria: verdict.failedCriteria ?? [],
          feedback: verdict.feedback ?? 'Verification rejected',
        },
      });
      retries++;
      host.chat('system', `Verification rejected (attempt ${retries}/${maxRetries}). Retrying with feedback...`);

      const bounce = {
        feedback: verdict.feedback ?? 'Verification rejected',
        failedCriteria: verdict.failedCriteria ?? [],
        previousArtifactPaths: ctx.artifacts.map((a) => a.filePath),
      };
      ctx.contextPacket = { ...ctx.contextPacket!, bounceContext: bounce };
      options.onBeforeRetry?.();
      continue;
    }

    host.eventBus.emit({
      type: 'ERROR_OCCURRED',
      payload: {
        error: `Verification rejected after ${maxRetries} attempts: ${verdict.feedback ?? 'unknown'}`,
        phase: 'verify',
        recoverable: true,
      },
    });
    return { verdict, artifacts: ctx.artifacts };
  }
}
