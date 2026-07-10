import type { ContextPacket, ExecutionPlan, HandoffContract, ArtifactManifest } from '../../shared/types';
import { scheduleContracts } from '../core/BoundaryScheduler';
import type { ExecutionRouter } from '../core/ExecutionRouter';
import type { AgentSupervisor } from '../core/AgentSupervisor';

export type BuildArtifact = { filePath: string; content: string; hash: string };

export interface CoderRunOptions {
  workspaceRoot: string;
  useSupervisor: boolean;
  executionRouter: ExecutionRouter;
  supervisor: AgentSupervisor;
  emitArtifact: (taskId: string, filePath: string, agentId: string) => void;
}

function flattenCoderManifests(
  manifests: ArtifactManifest[],
  taskId: string,
  emitArtifact: CoderRunOptions['emitArtifact']
): BuildArtifact[] {
  const all: BuildArtifact[] = [];
  for (const manifest of manifests) {
    for (const a of manifest.artifacts) {
      emitArtifact(taskId, a.filePath, 'coder');
      all.push({ filePath: a.filePath, content: a.content, hash: a.hash });
    }
  }
  return all;
}

/**
 * Run coder subtasks with boundary-aware batching or supervisor orchestration.
 */
export async function runCodersParallel(
  opts: CoderRunOptions,
  plan: ExecutionPlan,
  ctx: ContextPacket
): Promise<BuildArtifact[]> {
  const contracts: HandoffContract[] = plan.subtasks.map((subtask) => ({
    ...subtask,
    contextPacket: ctx,
    boundary: (subtask.artifactTargets ?? []).map((t) => t.filePath),
  }));

  // Dedupe parallel coders that would target the same artifact file. Two coders
  // writing the same path causes duplicate / clobbering writes. Keep the first
  // contract per target filePath; warn once about any removed duplicates.
  const seenPaths = new Set<string>();
  const deduped: HandoffContract[] = [];
  for (const c of contracts) {
    const p = c.artifactTargets?.[0]?.filePath;
    if (!p || !seenPaths.has(p)) {
      if (p) seenPaths.add(p);
      deduped.push(c);
    } else {
      console.warn(`[Omni] runCodersParallel: skipping duplicate target "${p}" (keeping first)`);
    }
  }
  const finalContracts = deduped.length ? deduped : contracts;

  if (opts.useSupervisor) {
    const executors = {
      coder: {
        execute: (c: HandoffContract, workspaceRoot: string) =>
          opts.executionRouter.execute(c, workspaceRoot),
      },
    };
    const manifests = await opts.supervisor.orchestrate(
      finalContracts,
      ctx,
      executors,
      opts.workspaceRoot,
      'medium'
    );
    return flattenCoderManifests(manifests, ctx.taskId, opts.emitArtifact);
  }

  const batches = scheduleContracts(opts.workspaceRoot, finalContracts);
  const allArtifacts: BuildArtifact[] = [];
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map(async (contract) => {
        const manifest = await opts.executionRouter.execute(contract, opts.workspaceRoot);
        for (const a of manifest.artifacts) opts.emitArtifact(ctx.taskId, a.filePath, 'coder');
        return manifest.artifacts;
      })
    );
    for (const arts of results) allArtifacts.push(...arts);
  }
  return allArtifacts;
}
