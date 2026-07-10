import * as fs from 'fs';
import * as path from 'path';
import type { HandoffContract, ResearchReport } from '../../../shared/types';
import { validateResearchReport } from '../../artifacts/ArtifactValidator';
import { mergeResearchReports, splitGoalIntoAspects } from '../researchUtils';
import type {
  PipelineContext,
  PipelineHost,
  PipelinePhase,
  PipelineServices,
  PhaseOutcome,
} from '../types';

const RESEARCH_DELAY_MS = 500;

function emptyReport(taskId: string): ResearchReport {
  return { taskId, summary: '', terms: [], bestPractices: [], patterns: [], sources: [] };
}

function parseResearchManifest(content: string, taskId: string, host: PipelineHost): ResearchReport {
  try {
    return JSON.parse(content) as ResearchReport;
  } catch (e) {
    host.chat('system', 'Research parse failed: ' + (e instanceof Error ? e.message : String(e)));
    return emptyReport(taskId);
  }
}

async function runSingleResearch(
  host: PipelineHost,
  services: PipelineServices,
  contract: HandoffContract
): Promise<ResearchReport> {
  const taskId = contract.contextPacket.taskId;
  const manifest = await host.runPhaseSafely(
    () => services.researcher.execute(contract, host.workspaceRoot),
    'research'
  );
  let report = parseResearchManifest(manifest.artifacts[0]?.content ?? '', taskId, host);

  const validation = validateResearchReport(report);
  if (!validation.ok && (!report.sources || report.sources.length === 0)) {
    host.chat('system', '⚠ Research report invalid/empty — re-running research once');
    try {
      const reManifest = await services.researcher.execute(contract, host.workspaceRoot);
      const retry = parseResearchManifest(reManifest.artifacts[0]?.content ?? '', taskId, host);
      if (validateResearchReport(retry).ok || (retry.sources && retry.sources.length > 0)) {
        report = retry;
      }
    } catch (e2) {
      host.chat('system', 'Research re-run failed: ' + (e2 instanceof Error ? e2.message : String(e2)));
    }
  }

  if (!validateResearchReport(report).ok) {
    host.eventBus.emit({
      type: 'ERROR_OCCURRED',
      payload: { error: 'Research report invalid/empty', phase: 'research', recoverable: true },
    });
  }

  return report;
}

async function runParallelFacets(
  host: PipelineHost,
  services: PipelineServices,
  base: HandoffContract,
  taskId: string,
  rawGoal: string,
  aspects: string[]
): Promise<ResearchReport> {
  host.chat('system', `Research split into ${aspects.length} parallel facets`);
  const facetReports = await Promise.all(
    aspects.map(async (aspect, i) => {
      const aspectTaskId = `research_${taskId}_${i}`;
      const aspectContract: HandoffContract = {
        ...base,
        subtaskId: aspectTaskId,
        boundary: [`.omniflow/tasks/${aspectTaskId}/research-report.json`],
        contextPacket: { taskId: aspectTaskId, goal: aspect, workspaceSnapshot: base.contextPacket.workspaceSnapshot },
      };
      try {
        const m = await services.researcher.execute(aspectContract, host.workspaceRoot);
        return JSON.parse(m.artifacts[0].content) as ResearchReport;
      } catch (e) {
        host.chat('system', `Research facet ${i} failed: ` + (e instanceof Error ? e.message : String(e)));
        return null;
      }
    })
  );
  const valid = facetReports.filter((r): r is ResearchReport => r !== null);
  const merged = mergeResearchReports(taskId, rawGoal, valid);
  const canonicalPath = `.omniflow/tasks/${taskId}/research-report.json`;
  const full = path.join(host.workspaceRoot, canonicalPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

async function provisionResearchTools(host: PipelineHost, services: PipelineServices, rawGoal: string): Promise<void> {
  try {
    const toolResults = await services.toolManager.autoInstallToolsForTask('researcher', rawGoal);
    const installed = toolResults.filter((r) => r.success).map((r) => r.toolName);
    if (installed.length) {
      host.chat('system', 'ToolManager provisioned researcher tools: [' + installed.join(', ') + ']');
    }
  } catch (e) {
    host.chat('system', 'ToolManager researcher provisioning skipped: ' + (e instanceof Error ? e.message : String(e)));
  }
}

async function configureSearchApiKeys(host: PipelineHost, services: PipelineServices): Promise<void> {
  try {
    const missingSearch = services.toolManager.getToolsForAgent('researcher').filter(
      (t) =>
        t.apiKeyEnv &&
        t.signupUrl &&
        !(services.apiKeys[t.apiKeyEnv] || process.env[t.apiKeyEnv])
    );
    if (missingSearch.length === 0) return;

    const decision = await host.requestApiKeyPrompt({
      tools: missingSearch.map((t) => ({
        toolName: t.name,
        envVar: t.apiKeyEnv!,
        signupUrl: t.signupUrl!,
      })),
      fallbackAvailable: true,
      reason:
        'Researcher needs a web-search API key to ground research in real sources. Paste a key (private — never shown to the LLM), continue without web search, or try a keyless fallback.',
    });
    if (decision.action === 'skip') services.researcher.setSearchMode('skip');
    else if (decision.action === 'fallback') services.researcher.setSearchMode('fallback');
  } catch (e) {
    host.chat('system', 'API key prompt skipped: ' + (e instanceof Error ? e.message : String(e)));
  }
}

/**
 * Research phase: web research, TaskCompass alignment, clarify-after-research.
 */
export class ResearchPhase implements PipelinePhase {
  readonly id = 'research' as const;

  canRun(ctx: PipelineContext): boolean {
    return ctx.phases.includes('research');
  }

  async run(host: PipelineHost, ctx: PipelineContext, services: PipelineServices): Promise<PhaseOutcome> {
    if (!this.canRun(ctx)) {
      host.emitPhaseLifecycle('research', 'skipped', { reason: 'not in tier phases' });
      ctx.refinedGoal = ctx.rawGoal;
      return { phase: 'research', skipped: true };
    }

    const started = Date.now();
    host.emitPhaseLifecycle('research', 'started', { taskId: ctx.taskId });
    host.transitionPhase('research');
    host.setAgent('researcher', 'working');

    console.log('[ResearchPhase] Waiting %dms before research', RESEARCH_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, RESEARCH_DELAY_MS));

    await provisionResearchTools(host, services, ctx.rawGoal);
    await configureSearchApiKeys(host, services);

    const researchContractBase: HandoffContract = {
      subtaskId: `research_${ctx.taskId}`,
      agentRole: 'researcher',
      successCriteria: ['Research report'],
      artifactTargets: [{ filePath: `.omniflow/tasks/${ctx.taskId}/research-report.json`, contentType: 'doc' }],
      contextPacket: { taskId: ctx.taskId, goal: ctx.rawGoal, workspaceSnapshot: ctx.workspace },
    };

    const aspects = splitGoalIntoAspects(ctx.rawGoal);
    const report =
      aspects.length <= 1
        ? await runSingleResearch(host, services, researchContractBase)
        : await runParallelFacets(host, services, researchContractBase, ctx.taskId, ctx.rawGoal, aspects);

    ctx.researchReport = report;
    services.memory.setResearchReport(report);

    const researchAlignment = services.taskCompass.checkAlignment(
      `Research completed: ${report.summary}`,
      ctx.rawGoal
    );
    host.eventBus.emit({
      type: 'REASONING_TRACE',
      payload: {
        agentId: 'orchestrator',
        phase: 'research',
        thought: `Research alignment check: ${researchAlignment.aligned ? 'ALIGNED' : 'DRIFT DETECTED'} (drift: ${researchAlignment.driftScore.toFixed(2)})`,
        timestamp: Date.now(),
      },
    });

    host.setAgent('researcher', 'done');
    host.chat(
      'assistant',
      `Research summary: ${report.summary.slice(0, 240)}…\n` +
        `\nTerms: ${(report.terms ?? []).slice(0, 8).join(', ') || '—'}\n` +
        `Best practices: ${(report.bestPractices ?? []).slice(0, 5).join('; ') || '—'}\n` +
        `Patterns: ${(report.patterns ?? []).slice(0, 5).join('; ') || '—'}\n` +
        `Sources: ${(report.sources ?? []).slice(0, 5).join(', ') || '—'}`
    );

    // Clarify after research: critical gaps only
    host.setAgent('clarifier', 'working', 'Generating critical questions');
    ctx.questions = await services.clarifier.generateCriticalQuestionsFromResearch(
      ctx.rawGoal,
      report,
      ctx.workspace
    );
    const llmMeta = services.clarifier.getLastLlmResponse();
    if (llmMeta && !llmMeta.usedFallback) {
      host.chat(
        'assistant',
        `I found ${ctx.questions.length} critical missing detail(s) (via ${llmMeta.provider}/${llmMeta.model}):`
      );
    } else {
      host.chat('assistant', `I found ${ctx.questions.length} critical missing detail(s):`);
    }
    host.setAgent('clarifier', 'idle');

    if (ctx.questions.length > 0) {
      ctx.answers = await host.askClarifyingQuestions(ctx.questions);
    }

    ctx.refinedGoal = host.refineGoal(ctx.rawGoal, ctx.answers);

    if (ctx.answers.length > 0) {
      const decisionLines = ctx.answers
        .map((a) => {
          const val = a.customText || a.selectedOption || '';
          if (!val) return null;
          return `- ${a.questionId}: ${val}`;
        })
        .filter(Boolean)
        .join('\n');
      host.chat('assistant', `✅ Got the critical details. I'll apply them next:\n${decisionLines}`);
    }

    ctx.goalPacket.clarifications = ctx.answers;
    ctx.goalPacket.refinedGoal = ctx.refinedGoal;
    services.memory.setGoalPacket(ctx.goalPacket);

    const durationMs = Date.now() - started;
    host.emitPhaseLifecycle('research', 'completed', { taskId: ctx.taskId, durationMs });
    return { phase: 'research', durationMs };
  }
}

export const researchPhase = new ResearchPhase();
