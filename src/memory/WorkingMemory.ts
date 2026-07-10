import type {
  UserGoalPacket,
  ExecutionPlan,
  ContextPacket,
  ArtifactManifest,
  ResearchReport,
  SecurityReport,
} from '../../shared/types';
import { EpisodicMemory, EpisodeType } from './EpisodicMemory';

export class WorkingMemory {
  private goalPacket: UserGoalPacket | null = null;
  private researchReport: ResearchReport | null = null;
  private executionPlan: ExecutionPlan | null = null;
  private contextPacket: ContextPacket | null = null;
  private artifactManifest: ArtifactManifest | null = null;
  private securityReport: SecurityReport | null = null;
  private episodicMemory?: EpisodicMemory;

  setHierarchicalEpisodicMemory(memory: EpisodicMemory): void {
    this.episodicMemory = memory;
  }

  getHierarchicalEpisodicMemory(): EpisodicMemory | undefined {
    return this.episodicMemory;
  }

  recordEpisode(
    type: EpisodeType,
    data: Record<string, unknown>,
    importance = 0.5
  ): void {
    if (this.episodicMemory) {
      this.episodicMemory.add({ type, data, importance });
    }
  }

  searchEpisodes(query: string, limit = 10, minImportance = 0) {
    if (!this.episodicMemory) return [];
    return this.episodicMemory.search(query, limit, minImportance);
  }

  setGoalPacket(p: UserGoalPacket): void {
    this.goalPacket = p;
  }
  getGoalPacket(): UserGoalPacket | null {
    return this.goalPacket;
  }

  setResearchReport(r: ResearchReport): void {
    this.researchReport = r;
  }
  getResearchReport(): ResearchReport | null {
    return this.researchReport;
  }

  setExecutionPlan(p: ExecutionPlan): void {
    this.executionPlan = p;
  }
  getExecutionPlan(): ExecutionPlan | null {
    return this.executionPlan;
  }

  setContextPacket(p: ContextPacket): void {
    this.contextPacket = p;
  }
  getContextPacket(): ContextPacket | null {
    return this.contextPacket;
  }

  setArtifactManifest(m: ArtifactManifest): void {
    this.artifactManifest = m;
  }
  getArtifactManifest(): ArtifactManifest | null {
    return this.artifactManifest;
  }

  setSecurityReport(r: SecurityReport): void {
    this.securityReport = r;
  }
  getSecurityReport(): SecurityReport | null {
    return this.securityReport;
  }

  clear(): void {
    this.goalPacket = null;
    this.researchReport = null;
    this.executionPlan = null;
    this.contextPacket = null;
    this.artifactManifest = null;
    this.securityReport = null;
  }
}
