import * as fs from 'fs';
import * as path from 'path';
import type { PipelineContext, PipelineHost, PipelinePhase, PipelineServices, PhaseOutcome } from '../types';

const BUILD_DELAY_MS = 500;

async function provisionCoderTools(
  host: PipelineHost,
  services: PipelineServices,
  rawGoal: string
): Promise<void> {
  try {
    const toolResults = await services.toolManager.autoInstallToolsForTask('coder', rawGoal);
    const installed = toolResults.filter((r) => r.success).map((r) => r.toolName);
    if (installed.length) {
      host.chat('system', 'ToolManager provisioned coder tools: [' + installed.join(', ') + ']');
    }
  } catch (e) {
    host.chat('system', 'ToolManager coder provisioning skipped: ' + (e instanceof Error ? e.message : String(e)));
  }
}

function resetGeneratedDir(host: PipelineHost): void {
  const genDir = path.join(host.workspaceRoot, 'generated');
  try {
    fs.rmSync(genDir, { recursive: true, force: true });
    fs.mkdirSync(genDir, { recursive: true });
    host.chat('system', 'Cleared generated/ for a clean task build.');
  } catch (e) {
    host.chat('system', 'Could not reset generated/ dir: ' + (e instanceof Error ? e.message : String(e)));
  }
}

export class BuildPhase implements PipelinePhase {
  readonly id = 'build' as const;

  canRun(ctx: PipelineContext): boolean {
    return Boolean(ctx.plan && ctx.contextPacket);
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<PhaseOutcome> {
    if (!this.canRun(ctx)) {
      host.emitPhaseLifecycle('build', 'skipped', { reason: 'no plan or context' });
      return { phase: 'build', skipped: true };
    }

    const started = Date.now();
    const plan = ctx.plan!;
    const contextPacket = ctx.contextPacket!;

    host.emitPhaseLifecycle('build', 'started', { taskId: ctx.taskId });
    host.transitionPhase('build');
    host.setAgent('coder', 'working', `Building ${plan.subtasks.length} file(s)`);

    console.log('[BuildPhase] Waiting %dms before build', BUILD_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, BUILD_DELAY_MS));

    await provisionCoderTools(host, services, ctx.rawGoal);
    resetGeneratedDir(host);

    const artifacts = await host.runPhaseSafely(
      () => services.runCoders(plan, contextPacket),
      'build'
    );
    ctx.artifacts = artifacts;

    services.memory.setArtifactManifest({
      artifacts,
      subtaskId: `build_${ctx.taskId}`,
      completedAt: Date.now(),
      selfVerification: 'done',
    });

    const buildAlignment = services.taskCompass.checkAlignment(
      `Build complete: ${artifacts.length} artifacts generated`,
      ctx.refinedGoal
    );
    host.eventBus.emit({
      type: 'REASONING_TRACE',
      payload: {
        agentId: 'orchestrator',
        phase: 'build',
        thought: `Build alignment check: ${buildAlignment.aligned ? 'ALIGNED' : 'DRIFT DETECTED'} (drift: ${buildAlignment.driftScore.toFixed(2)})`,
        timestamp: Date.now(),
      },
    });

    host.setAgent('coder', 'done');
    host.chat(
      'assistant',
      `Build complete. Generated ${artifacts.length} artifact(s):\n` +
        artifacts
          .map((a) => `  - ${a.filePath}`)
          .slice(0, 30)
          .join('\n') +
        (artifacts.length > 30 ? `\n  … +${artifacts.length - 30} more` : '')
    );

    if (artifacts.length === 0) {
      const msg =
        '⚠ Build produced 0 artifacts. Likely causes: LLM providers unavailable, or the coder stalled (stack conflict / environment issue). Check provider health and the planner stack decision, then retry.';
      host.chat('system', msg);
      host.eventBus.emit({
        type: 'ERROR_OCCURRED',
        payload: { error: msg, phase: 'build', recoverable: true },
      });
    }

    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('build', 'completed', { taskId: ctx.taskId, durationMs, artifactCount: artifacts.length });
    return { phase: 'build', durationMs };
  }
}

export const buildPhase = new BuildPhase();
