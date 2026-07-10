import type { HandoffContract, ArtifactManifest } from '../../shared/types';
import { ClineAgentWrapper, ClineConfigurationError } from '../agents/ClineAgentWrapper';
import { CoderAgent } from '../agents/CoderAgent';

export type ExecutionBackend = 'cline' | 'legacy';

export interface ExecutionRouterOptions {
  cline: ClineAgentWrapper;
  legacy: CoderAgent;
}

/**
 * Chooses between Cline-powered ReAct execution and legacy single-pass execution.
 *
 * Falls back to legacy on Cline configuration/runtime errors so orchestration
 * can continue without blocking the user.
 */
export class ExecutionRouter {
  constructor(private readonly options: ExecutionRouterOptions) {}

  async execute(
    contract: HandoffContract,
    workspaceRoot: string
  ): Promise<ArtifactManifest> {
    const backend = this.selectBackend(contract);
    this.log(contract, backend);

    if (backend !== 'cline') {
      return this.options.legacy.execute(contract, workspaceRoot);
    }

    try {
      return await this.options.cline.execute(
        contract.contextPacket.goal,
        contract
      );
    } catch (error) {
      if (error instanceof ClineConfigurationError) {
        console.warn(`[ExecutionRouter] Cline backend failed for ${contract.subtaskId}, falling back to legacy: ${error.message}`);
      } else {
        console.warn(`[ExecutionRouter] Unexpected Cline error for ${contract.subtaskId}, falling back to legacy`, error);
      }
      return this.options.legacy.execute(contract, workspaceRoot);
    }
  }

  private selectBackend(contract: HandoffContract): ExecutionBackend {
    const explicit =
      (contract.contextPacket as any)?.executionBackend as
        | ExecutionBackend
        | undefined;

    if (explicit === 'cline' || explicit === 'legacy') {
      return explicit;
    }

    // FIX: If Cline SDK is not loaded, always use legacy backend
    // This prevents 7+ error attempts per task when @cline/sdk is not installed
    if (!this.options.cline.isLoaded()) {
      return 'legacy';
    }

    const description = (contract.description ?? '').toLowerCase();
    const isBuildLike =
      contract.artifactTargets.some((t) => t.contentType === 'code') ||
      description.includes('build') ||
      description.includes('implement') ||
      description.includes('create') ||
      description.includes('generate');

    return isBuildLike ? 'cline' : 'legacy';
  }

  private log(contract: HandoffContract, backend: ExecutionBackend): void {
    console.info(`[ExecutionRouter] ${contract.subtaskId} -> ${backend}`);
  }
}
