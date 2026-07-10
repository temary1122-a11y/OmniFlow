import type {
  Phase,
  AgentRole,
  AgentStatus,
  WorkspaceSnapshot,
  UserGoalPacket,
  ResearchReport,
  ClarifyingQuestion,
  ClarifyingAnswer,
  HandoffContract,
  ArtifactManifest,
  ExecutionPlan,
  ContextPacket,
  ApprovalResponse,
  VerificationVerdictReport,
  DeliveryReport,
} from '../../shared/types';
import type { EventBus } from '../core/EventBus';
import type { PhaseEngine } from '../core/PhaseEngine';
import type { WorkingMemory } from '../memory/WorkingMemory';
import type { LedgerMemory } from '../memory/LedgerMemory';
import type { TaskCompass } from '../core/TaskCompass';
import type { ToolManager } from '../core/ToolManager';
import type { ArtifactManager } from '../artifacts/ArtifactManager';
import type { PromptOrchestrator } from '../core/PromptOrchestrator';
import type { ContextAgent } from '../agents/ContextAgent';
import type { ResearchAgent } from '../agents/ResearchAgent';
import type { ClarifierAgent } from '../agents/ClarifierAgent';
import type { PlannerAgent } from '../agents/PlannerAgent';
import type { AuditAgent } from '../agents/AuditAgent';
import type { SecurityAgent } from '../agents/SecurityAgent';
import type { VerificationAgent } from '../agents/VerificationAgent';
import type { BuildArtifact } from './buildRunner';
import type { RoleSelector } from '../core/RoleSelector';
import type { ModelIndexer } from '../routing/ModelIndexer';
import type { ModelRouter } from '../routing/ModelRouter';

export interface ApiKeyPromptPayload {
  tools: { toolName: string; envVar: string; signupUrl: string }[];
  fallbackAvailable: boolean;
  reason: string;
}

export interface ApiKeyPromptResponse {
  requestId: string;
  action: 'proceed' | 'skip' | 'fallback';
  keys?: Record<string, string>;
}

export interface PlanApprovalPayload {
  title: string;
  tier: string;
  architecture: string;
  stack: string[];
  acceptanceCriteria: string[];
  files: string[];
  summary: string;
}

/** Mutable state for one orchestration run (single source of truth). */
export interface PipelineContext {
  taskId: string;
  rawGoal: string;
  refinedGoal: string;
  workspace: WorkspaceSnapshot;
  goalPacket: UserGoalPacket;
  tier: 'LOW' | 'MEDIUM' | 'HIGH';
  phases: Phase[];
  researchReport?: ResearchReport;
  questions: ClarifyingQuestion[];
  answers: ClarifyingAnswer[];
  projectDocs?: { agentsMd?: string; omniMd?: string };
  plan?: ExecutionPlan;
  compassPath?: string;
  contextPacket?: ContextPacket;
  artifacts: BuildArtifact[];
  verdict?: VerificationVerdictReport;
  deliveryReport?: DeliveryReport;
  useSelfPrompting?: boolean;
  startedAt: number;
}

export function createPipelineContext(input: {
  taskId: string;
  rawGoal: string;
  workspace: WorkspaceSnapshot;
  goalPacket: UserGoalPacket;
  tier: 'LOW' | 'MEDIUM' | 'HIGH';
  phases: Phase[];
  projectDocs?: { agentsMd?: string; omniMd?: string };
}): PipelineContext {
  return {
    ...input,
    refinedGoal: input.rawGoal,
    questions: [],
    answers: [],
    artifacts: [],
    startedAt: Date.now(),
  };
}

/** Agents + infra (no UI). */
export interface PipelineServices {
  researcher: ResearchAgent;
  clarifier: ClarifierAgent;
  planner: PlannerAgent;
  toolManager: ToolManager;
  memory: WorkingMemory;
  taskCompass: TaskCompass;
  apiKeys: Record<string, string>;
  runCoders: (plan: ExecutionPlan, ctx: ContextPacket) => Promise<BuildArtifact[]>;
  auditor: AuditAgent;
  security: SecurityAgent;
  verifier: VerificationAgent;
  promptOrchestrator: PromptOrchestrator;
  contextAgent: ContextAgent;
  artifacts: ArtifactManager;
  ledger: LedgerMemory;
  roleSelector: RoleSelector;
  modelIndexer?: ModelIndexer;
  router?: ModelRouter;
}

/** Orchestrator UI hooks — phases never import OmniOrchestrator directly. */
export interface PipelineHost {
  workspaceRoot: string;
  eventBus: EventBus;
  phaseEngine: PhaseEngine;
  chat(role: 'user' | 'assistant' | 'system', content: string): void;
  setAgent(id: AgentRole, status: AgentStatus, message?: string): void;
  transitionPhase(phase: Phase): void;
  runPhaseSafely<T>(fn: () => Promise<T>, label: string, maxRetries?: number): Promise<T>;
  requestApiKeyPrompt(payload: ApiKeyPromptPayload): Promise<ApiKeyPromptResponse>;
  askClarifyingQuestions(questions: ClarifyingQuestion[]): Promise<ClarifyingAnswer[]>;
  refineGoal(goal: string, answers: ClarifyingAnswer[]): string;
  requestApproval(payload: PlanApprovalPayload): Promise<ApprovalResponse>;
  emitArtifact(taskId: string, filePath: string, agentId: string): void;
  emitPhaseLifecycle(
    phase: Phase,
    event: 'started' | 'completed' | 'skipped',
    extra?: Record<string, unknown>
  ): void;
  getElapsedMs(): number;
  scanWorkspace(): Promise<import('../../shared/types').WorkspaceSnapshot>;
  draftProjectDocs(goal: string): Promise<{ agentsMd: string; omniMd: string }>;
  readProjectDocs(): { agentsMd?: string; omniMd?: string };
}

export interface PhaseOutcome {
  phase: Phase;
  skipped?: boolean;
  durationMs?: number;
}

export type VerifyDecision = 'accept' | 'reject' | 'escalate';

export interface VerifyPhaseOutcome extends PhaseOutcome {
  verdict: VerificationVerdictReport;
  decision: VerifyDecision;
}

export interface DeliverPhaseOutcome extends PhaseOutcome {
  report?: DeliveryReport;
}

export interface PipelinePhase {
  readonly id: Phase;
  canRun(ctx: PipelineContext): boolean;
  run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<PhaseOutcome>;
}

export type ResearchExecutor = (
  contract: HandoffContract,
  workspaceRoot: string
) => Promise<ArtifactManifest>;
