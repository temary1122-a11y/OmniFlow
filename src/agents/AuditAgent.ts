import { BaseAgent, type LlmReviewRouter } from './BaseAgent';
import type { HandoffContract, ArtifactManifest, VerificationVerdictReport } from '../../shared/types';
import type { ModelRouter } from '../routing/ModelRouter';
import type { ResilientModelRouter } from '../core/ResilientModelRouter';
import type { EventBus } from '../core/EventBus';
import * as path from 'path';
import * as fs from 'fs';

const MAX_LLM_FILES = 5;
const MAX_FILE_CONTENT_CHARS = 5000;

export class AuditAgent extends BaseAgent {
  private router?: ModelRouter | ResilientModelRouter | LlmReviewRouter;
  private apiKeys?: Record<string, string>;
  private enableLlm: boolean;

  constructor(
    router?: ModelRouter | ResilientModelRouter,
    apiKeys?: Record<string, string>,
    eventBus?: EventBus,
    enableLlm = false
  ) {
    super('auditor', eventBus);
    this.router = router;
    this.apiKeys = apiKeys;
    this.enableLlm = enableLlm;
  }

  async execute(contract: HandoffContract, workspaceRoot: string): Promise<ArtifactManifest> {
    const findings: { criterion: string; passed: boolean; notes?: string }[] = [];
    const risks: VerificationVerdictReport['risks'] = [];

    for (const target of contract.artifactTargets) {
      const full = path.join(workspaceRoot, target.filePath);
      if (!fs.existsSync(full)) {
        findings.push({ criterion: `${target.filePath} exists`, passed: false, notes: 'File missing' });
        continue;
      }
      const content = fs.readFileSync(full, 'utf-8');
      findings.push({ criterion: `${target.filePath} non-empty`, passed: content.trim().length > 0 });

      const stubs = (content.match(/\b(TODO|FIXME|STUB|placeholder)\b/gi) || []).length;
      if (stubs > 0) {
        risks.push({ level: 'medium', description: `${stubs} stub/placeholder markers in ${target.filePath}` });
      }
      if (target.filePath.endsWith('.json')) {
        try {
          JSON.parse(content);
          findings.push({ criterion: `${target.filePath} valid JSON`, passed: true });
        } catch {
          findings.push({ criterion: `${target.filePath} valid JSON`, passed: false });
        }
      }
    }

    // Heuristic-determined failures (missing/empty/invalid files) are HARD failures.
    const heuristicFailed = findings.filter((f) => !f.passed);

    if (this.enableLlm && this.router && this.apiKeys) {
      await this.runLlmReview(contract, workspaceRoot, findings, risks);
    }

    const verdict: VerificationVerdictReport = {
      verdict: heuristicFailed.length ? 'FAIL' : risks.length ? 'NEEDS_REVIEW' : 'PASS',
      subtaskId: contract.subtaskId,
      criteria: findings,
      risks,
    };

    const content = JSON.stringify(verdict, null, 2);
    const relPath = `.omniflow/audit/${contract.subtaskId}/audit-report.json`;
    const full = path.join(workspaceRoot, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');

    return this.createManifest(contract.subtaskId, [{ filePath: relPath, content, hash: this.hash(content) }], verdict.verdict);
  }

  private async runLlmReview(
    contract: HandoffContract,
    workspaceRoot: string,
    findings: { criterion: string; passed: boolean; notes?: string }[],
    risks: VerificationVerdictReport['risks']
  ): Promise<void> {
    const files = contract.artifactTargets
      .map((t) => ({ t, full: path.join(workspaceRoot, t.filePath) }))
      .filter((x) => fs.existsSync(x.full))
      .map((x) => ({ rel: x.t.filePath, content: fs.readFileSync(x.full, 'utf-8').slice(0, MAX_FILE_CONTENT_CHARS) }))
      .slice(0, MAX_LLM_FILES);
    if (files.length === 0) return;

    const fileBlock = files.map((f) => `### ${f.rel}\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
    const heuristicSummary = findings.map((f) => `- ${f.passed ? 'PASS' : 'FAIL'}: ${f.criterion}`).join('\n');

    const prompt =
      'You are a CODE QUALITY reviewer (NOT a goal/spec checker). Review the listed files for: ' +
      'structural smells, missing error handling, dead code, inconsistency with the plan, weak modularity. ' +
      'Do NOT fail on style or naming. Respond ONLY with JSON:\n' +
      '{"criteria":[{"criterion":"...","passed":true,"notes":"..."}],"risks":[{"level":"low|medium|high","description":"...","mitigation":"..."}],"verdict":"PASS|NEEDS_REVIEW|FAIL"}\n' +
      'Existing heuristic checks:\n' + heuristicSummary + '\n\nFiles:\n' + fileBlock;

    const res = await this.callLlmJsonReview(
      this.router as LlmReviewRouter,
      this.apiKeys,
      { phase: 'audit', agentRole: 'auditor', complexity: 'low' },
      prompt,
      'You are a code quality reviewer. Respond ONLY with JSON.'
    );
    if (!res || !res.parsed) return;

    const parsed = res.parsed as any;
    if (Array.isArray(parsed.risks)) {
      for (const r of parsed.risks) {
        const level = r.level === 'high' || r.level === 'low' ? r.level : 'medium';
        risks.push({ level, description: String(r.description || 'LLM review note'), mitigation: r.mitigation ? String(r.mitigation) : undefined });
      }
    }
    if (Array.isArray(parsed.criteria)) {
      for (const c of parsed.criteria) {
        // Advisory only: never let an LLM criterion flip the verdict to FAIL (that is
        // reserved for heuristic structural issues, to avoid double-rejecting the coder).
        findings.push({ criterion: `LLM: ${String(c.criterion || 'review note')}`, passed: c.passed !== false, notes: c.notes ? String(c.notes) : undefined });
      }
    }
  }
}
