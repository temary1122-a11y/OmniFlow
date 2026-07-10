import * as fs from 'fs';
import * as path from 'path';
import type { HandoffContract, UserGoalPacket } from '../../../shared/types';
import {
  draftProjectDocs,
  isCleanProject,
  readProjectDocs,
  runIntake,
  type IntakeDeps,
} from '../intakeUtils';
import type {
  PipelineContext,
  PipelineHost,
  PipelinePhase,
  PipelineServices,
  PhaseOutcome,
} from '../types';

export class IntakePhase implements PipelinePhase {
  readonly id = 'intake' as const;

  canRun(ctx: PipelineContext): boolean {
    return true; // Intake always runs
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<PhaseOutcome> {
    const started = Date.now();
    host.emitPhaseLifecycle('intake', 'started', { taskId: ctx.taskId });
    host.transitionPhase('intake');
    host.setAgent('orchestrator', 'working', 'Intake');

    // Scan workspace
    const workspace = await host.scanWorkspace();
    ctx.workspace = workspace;

    // Refresh model index (non-critical)
    try {
      if (services.modelIndexer && services.router) {
        (services.modelIndexer as any).apiKeys = services.apiKeys;
        await services.modelIndexer.refreshIndex();
        services.router.syncModels(services.modelIndexer.getModels());
      }
    } catch (e) {
      host.chat('system', 'Model index refresh skipped: ' + (e instanceof Error ? e.message : String(e)));
    }

    // Bootstrap project docs if clean project
    if (isCleanProject(workspace)) {
      host.chat('system', 'Чистый проект без файлов — предлагаю создать AGENTS.md и OMNI.md для автономности.');

      const draft = await host.draftProjectDocs(ctx.rawGoal);
      const approval = await host.requestApproval({
        title: 'Создать AGENTS.md и OMNI.md?',
        tier: 'LOW',
        architecture: 'Project conventions + memory',
        stack: workspace.techStack,
        acceptanceCriteria: ['AGENTS.md created', 'OMNI.md created'],
        files: ['AGENTS.md', 'OMNI.md'],
        summary: 'Omni сгенерирует файлы конвенций проекта и памяти, чтобы опираться на них при работе.',
      });

      if (approval.approved) {
        const files: Array<[string, string]> = [
          ['AGENTS.md', draft.agentsMd],
          ['OMNI.md', draft.omniMd],
        ];
        for (const [name, content] of files) {
          const full = path.join(host.workspaceRoot, name);
          fs.writeFileSync(full, content, 'utf-8');
          host.emitArtifact(ctx.taskId, name, 'orchestrator');
        }
        host.chat('assistant', `Создал AGENTS.md и OMNI.md${approval.feedback ? ' (правки: ' + approval.feedback + ')' : ''}.`);
      }
    }

    ctx.projectDocs = host.readProjectDocs();

    // Create goal packet via clarifier
    const intakeContract: HandoffContract = {
      subtaskId: `intake_${ctx.taskId}`,
      agentRole: 'clarifier',
      successCriteria: ['Goal packet created'],
      artifactTargets: [{ filePath: `.omniflow/tasks/${ctx.taskId}/goal-packet.json`, contentType: 'config' }],
      contextPacket: { taskId: ctx.taskId, goal: ctx.rawGoal, workspaceSnapshot: workspace },
    };

    host.setAgent('clarifier', 'working');
    const goalManifest = await host.runPhaseSafely(
      () => services.clarifier.execute(intakeContract, host.workspaceRoot),
      'intake'
    );
    const goalPacket: UserGoalPacket = JSON.parse(goalManifest.artifacts[0].content);
    services.memory.setGoalPacket(goalPacket);
    ctx.goalPacket = goalPacket;
    host.setAgent('clarifier', 'done');
    host.emitArtifact(goalPacket.taskId, goalManifest.artifacts[0].filePath, 'clarifier');

    // Triage via RoleSelector
    const selection = services.roleSelector.select(goalPacket.goal, goalPacket.complexity);
    ctx.tier = selection.tier;
    ctx.phases = selection.phases;
    ctx.useSelfPrompting = selection.useSelfPrompting;

    host.chat('system', `Triage: tier=${ctx.tier} (complexity=${goalPacket.complexity}) roles=${selection.roles.join(',')}`);

    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('intake', 'completed', { taskId: ctx.taskId, durationMs });
    return { phase: 'intake', durationMs };
  }
}

export const intakePhase = new IntakePhase();
