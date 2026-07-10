/**
 * ContextAgent (Phase 3 Integration — Step 6)
 *
 * Lightweight pre-step agent that enriches a HandoffContract's contextPacket
 * with relevant memory episodes, skills, artifacts, and semantic knowledge
 * before the main worker agents (planner, coder, researcher) run.
 *
 * This keeps the worker agents' prompts clean while still providing them
 * with cross-session context from memory and the artifact index.
 *
 * Usage (in AgentSupervisor / OmniOrchestrator):
 *   const agent = new ContextAgent(memory, artifactManager, options);
 *   const enrichment = await agent.enrich(goal, context);
 *   // Attach enrichment.memoryContext to contextPacket of downstream agents
 */

import type { ContextPacket, HandoffContract } from '../../shared/types';
import type { MemoryFacade } from '../memory/MemoryFacade';
import type { ArtifactManager } from '../artifacts/ArtifactManager';
import type { EventBus } from '../core/EventBus';

export interface ContextAgentOptions {
  /** Max episodes to pull per section. Default: 3 */
  maxEpisodesPerSection?: number;
  /** Max artifact results. Default: 3 */
  maxArtifacts?: number;
  /** Max semantic nodes. Default: 5 */
  maxSemanticNodes?: number;
  /** Cache result for N ms to avoid redundant queries on parallel agent launch. Default: 5000 */
  cacheTTLMs?: number;
}

export interface ContextEnrichment {
  memoryContext: string;
  episodeCount: number;
  skillFound: boolean;
  artifactCount: number;
  semanticNodeCount: number;
}

export class ContextAgent {
  private cache: Map<string, { result: ContextEnrichment; expiresAt: number }> = new Map();

  constructor(
    private memory: MemoryFacade,
    private artifactManager: ArtifactManager,
    private eventBus: EventBus | null = null,
    private options: ContextAgentOptions = {}
  ) {}

  /**
   * Enrich context for the given goal.
   * Results are cached per goal string to avoid duplicate lookups
   * when multiple agents start simultaneously.
   */
  async enrich(goal: string, context?: ContextPacket): Promise<ContextEnrichment> {
    const cacheKey = goal.slice(0, 200);
    const ttl = this.options.cacheTTLMs ?? 5000;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result;
    }

    const maxEp = this.options.maxEpisodesPerSection ?? 3;
    const maxArt = this.options.maxArtifacts ?? 3;
    const maxSem = this.options.maxSemanticNodes ?? 5;

    const sections: string[] = [];

    // ── 1. Relevant episodes ──────────────────────────────────────────────
    const queryStr = `${goal} ${context?.planSummary ?? ''} ${context?.researchSummary ?? ''}`.trim();
    const episodes = this.memory.selectiveRetrieve(queryStr, maxEp, 0.3);
    if (episodes.length > 0) {
      const lines = episodes.map((r) => {
        const d = r.episode.data as any;
        return `  [${r.episode.type}] ${d.agentId ?? '?'}: ${(d.excerpt ?? JSON.stringify(d)).slice(0, 120)}`;
      });
      sections.push(`Past episodes:\n${lines.join('\n')}`);
    }

    // ── 2. Relevant skill ─────────────────────────────────────────────────
    const skill = this.memory.findBestSkill(goal);
    let skillFound = false;
    if (skill && skill.score > 0.4) {
      skillFound = true;
      sections.push(
        `Recalled skill: "${skill.skill.name}" (${(skill.skill.successRate * 100).toFixed(0)}% success) — ${skill.skill.description}`
      );
    }

    // ── 3. Relevant artifacts ─────────────────────────────────────────────
    const artifacts = this.artifactManager.searchArtifacts(goal, { limit: maxArt });
    if (artifacts.length > 0) {
      const lines = artifacts.map((a) => `  ${a.filePath} [${a.type}] — ${a.preview.slice(0, 80)}`);
      sections.push(`Related artifacts:\n${lines.join('\n')}`);
    }

    // ── 4. Semantic knowledge ─────────────────────────────────────────────
    const nodes = this.memory.semanticSearch(goal, maxSem);
    if (nodes.length > 0) {
      const labels = nodes.map((n) => `${n.label} (${n.type})`).join(', ');
      sections.push(`Known concepts: ${labels}`);
    }

    const memoryContext = sections.length > 0
      ? `=== Context Enrichment ===\n${sections.join('\n\n')}\n=========================`
      : '';

    const result: ContextEnrichment = {
      memoryContext,
      episodeCount: episodes.length,
      skillFound,
      artifactCount: artifacts.length,
      semanticNodeCount: nodes.length,
    };

    // Cache result
    this.cache.set(cacheKey, { result, expiresAt: Date.now() + ttl });

    // Emit trace
    if (this.eventBus) {
      this.eventBus.emit({
        type: 'REASONING_TRACE',
        payload: {
          agentId: 'context-agent' as any,
          phase: 'build',
          thought: `ContextAgent enriched: ${episodes.length} episodes, skill=${skillFound}, ${artifacts.length} artifacts, ${nodes.length} semantic nodes`,
          timestamp: Date.now(),
        },
      });
    }

    return result;
  }

  /** Attach enrichment to a HandoffContract's contextPacket. */
  applyToContract(
    contract: HandoffContract,
    enrichment: ContextEnrichment
  ): HandoffContract {
    if (!enrichment.memoryContext) return contract;
    return {
      ...contract,
      contextPacket: {
        ...contract.contextPacket,
        // Store enrichment in researchSummary prefix or as a new optional field
        researchSummary: enrichment.memoryContext +
          (contract.contextPacket?.researchSummary
            ? '\n\n' + contract.contextPacket.researchSummary
            : ''),
      },
    };
  }

  /** Clear the enrichment cache (e.g., after workspace switch). */
  clearCache(): void {
    this.cache.clear();
  }
}
