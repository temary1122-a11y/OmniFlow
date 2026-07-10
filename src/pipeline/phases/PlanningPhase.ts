import * as fs from 'fs';
import * as path from 'path';
import type { ExecutionPlan } from '../../../shared/types';
import { validateExecutionPlan } from '../../artifacts/ArtifactValidator';
import { buildCompassMarkdown } from '../../core/CompassArtifact';
import {
  buildContextPacket,
  compassQuestionsFromClarifications,
  createFastTrackPlan,
  emptyExecutionPlan,
} from '../planUtils';
import type {
  PipelineContext,
  PipelineHost,
  PipelinePhase,
  PipelineServices,
  PhaseOutcome,
  PlanApprovalPayload,
} from '../types';

const PLANNING_DELAY_MS = 500;

function parsePlanManifest(content: string, taskId: string, host: PipelineHost): ExecutionPlan {
  try {
    return JSON.parse(content) as ExecutionPlan;
  } catch (e) {
    host.chat('system', 'Plan parse failed: ' + (e instanceof Error ? e.message : String(e)));
    return emptyExecutionPlan(taskId);
  }
}

async function runFullPlanning(
  host: PipelineHost,
  ctx: PipelineContext,
  services: PipelineServices
): Promise<ExecutionPlan> {
  const planContract = {
    subtaskId: `plan_${ctx.taskId}`,
    agentRole: 'planner' as const,
    successCriteria: ['Execution plan'],
    artifactTargets: [
      { filePath: `.omniflow/tasks/${ctx.taskId}/execution-plan.json`, contentType: 'config' as const },
    ],
    contextPacket: {
      taskId: ctx.taskId,
      goal: ctx.refinedGoal,
      workspaceSnapshot: ctx.workspace,
      researchSummary: ctx.researchReport?.summary,
      researchReport: ctx.researchReport,
    },
  };

  const planManifest = await host.runPhaseSafely(
    () => services.planner.execute(planContract, host.workspaceRoot),
    'planning'
  );
  const plan = parsePlanManifest(planManifest.artifacts[0]?.content ?? '', ctx.taskId, host);
  services.memory.setExecutionPlan(plan);

  const validation = validateExecutionPlan(plan);
  if (!validation.ok) {
    host.eventBus.emit({
      type: 'ERROR_OCCURRED',
      payload: {
        error: 'Execution plan invalid: ' + validation.errors.join('; '),
        phase: 'planning',
        recoverable: true,
      },
    });
  }

  const compassPath = `.omniflow/tasks/${ctx.taskId}/compass.md`;
  const compassQuestions = compassQuestionsFromClarifications(ctx.questions, ctx.answers);
  const compassMarkdown = buildCompassMarkdown(ctx.goalPacket, plan, ctx.researchReport, compassQuestions);
  const compassFull = path.join(host.workspaceRoot, compassPath);
  fs.mkdirSync(path.dirname(compassFull), { recursive: true });
  fs.writeFileSync(compassFull, compassMarkdown, 'utf-8');

  for (const subtask of plan.subtasks) {
    subtask.compassPath = compassPath;
  }
  ctx.compassPath = compassPath;

  const acceptanceCriteria: string[] = [];
  for (const s of plan.subtasks) for (const c of s.successCriteria) acceptanceCriteria.push(c);

  const approvalPayload: PlanApprovalPayload = {
    title: 'План готов — одобрить?',
    tier: ctx.tier,
    architecture: plan.architecture,
    stack: plan.stack,
    acceptanceCriteria,
    files: plan.subtasks.map((s) => s.artifactTargets?.[0]?.filePath ?? 'artifact'),
    summary: `Цель: ${ctx.refinedGoal}\nАрхитектура: ${plan.architecture}\nСтек: ${plan.stack.join(', ')}`,
  };

  const approval = await host.requestApproval(approvalPayload);
  if (!approval.approved) {
    host.chat(
      'system',
      'План отклонён пользователем. Останавливаюсь до уточнений.' +
        (approval.feedback ? ' Правки: ' + approval.feedback : '')
    );
    host.eventBus.emit({
      type: 'ERROR_OCCURRED',
      payload: {
        error: 'Plan rejected by user' + (approval.feedback ? ': ' + approval.feedback : ''),
        phase: 'planning',
        recoverable: true,
      },
    });
    throw new Error('Plan rejected by user' + (approval.feedback ? ': ' + approval.feedback : ''));
  }
  if (approval.feedback) {
    host.chat('assistant', `Учту правки при сборке: ${approval.feedback}`);
  }

  const planAlignment = services.taskCompass.checkAlignment(
    `Plan created: ${plan.architecture}`,
    ctx.refinedGoal
  );
  host.eventBus.emit({
    type: 'REASONING_TRACE',
    payload: {
      agentId: 'orchestrator',
      phase: 'planning',
      thought: `Plan alignment check: ${planAlignment.aligned ? 'ALIGNED' : 'DRIFT DETECTED'} (drift: ${planAlignment.driftScore.toFixed(2)})`,
      timestamp: Date.now(),
    },
  });

  host.setAgent('planner', 'done');
  host.chat(
    'assistant',
    `Plan: ${plan.architecture} (${plan.stack.join(', ')})\n` +
      `Subtasks (${plan.subtasks.length}):\n` +
      plan.subtasks
        .slice(0, 6)
        .map(
          (s, i) =>
            `  ${i + 1}. ${s.description} → ${s.artifactTargets?.[0]?.filePath ?? 'artifact'}`
        )
        .join('\n') +
      (plan.subtasks.length > 6 ? `\n  … +${plan.subtasks.length - 6} more` : '')
  );

  return plan;
}

export class PlanningPhase implements PipelinePhase {
  readonly id = 'planning' as const;

  canRun(ctx: PipelineContext): boolean {
    return ctx.phases.includes('planning');
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<PhaseOutcome> {
    const started = Date.now();

    if (!this.canRun(ctx)) {
      host.emitPhaseLifecycle('planning', 'skipped', { reason: 'fast-track tier' });
      const plan = createFastTrackPlan(ctx.taskId, ctx.rawGoal, ctx.refinedGoal, ctx.workspace);
      ctx.plan = plan;
      services.memory.setExecutionPlan(plan);
      ctx.contextPacket = buildContextPacket(ctx);
      services.memory.setContextPacket(ctx.contextPacket);
      return { phase: 'planning', skipped: true };
    }

    host.emitPhaseLifecycle('planning', 'started', { taskId: ctx.taskId });
    host.transitionPhase('planning');
    host.setAgent('planner', 'working');

    console.log('[PlanningPhase] Waiting %dms before planning', PLANNING_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, PLANNING_DELAY_MS));

    ctx.plan = await runFullPlanning(host, ctx, services);
    ctx.contextPacket = buildContextPacket(ctx);
    services.memory.setContextPacket(ctx.contextPacket);

    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('planning', 'completed', { taskId: ctx.taskId, durationMs });
    return { phase: 'planning', durationMs };
  }
}

export const planningPhase = new PlanningPhase();
