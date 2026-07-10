import { BaseAgent } from './BaseAgent';
import type { HandoffContract, ArtifactManifest, VerificationVerdictReport } from '../../shared/types';
import type { EventBus } from '../core/EventBus';
import { ModelRouter } from '../routing/ModelRouter';
import { ResilientModelRouter } from '../core/ResilientModelRouter';
import * as path from 'path';
import * as fs from 'fs';

export function isStubContent(content: string): boolean {
  const c = content.toLowerCase();
  const markers = ['todo', 'scaffold', 'not implemented', 'not implemented yet', 'placeholder', 'your code here', 'actual implementation should be generated', 'build failed', 'coming soon', 'fixme', 'stub'];
  if (markers.some(m => c.includes(m))) return true;
  // Detect an effectively-empty function body: a function with only a comment / throw / console.log and no real statements.
  const stripped = c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/['"`].*?['"`]/g, '');
  const fnBody = stripped.match(/\{[\s]*\}/g);
  if (fnBody && fnBody.length > 0) return true; // empty { } body
  return false;
}

function extractSection(md: string, heading: string): string {
  const re = new RegExp(`##\\s*${heading}[\\s\\S]*?(?=\\n##\\s|$)`, 'i');
  const m = md.match(re);
  if (!m) return '';
  return m[0].replace(new RegExp(`##\\s*${heading}`, 'i'), '').trim();
}

export class VerificationAgent extends BaseAgent {
  constructor(
    private router?: ModelRouter | ResilientModelRouter,
    private apiKeys?: Record<string, string>,
    protected eventBus?: EventBus
  ) {
    super('verifier', eventBus);
  }

  async execute(contract: HandoffContract, workspaceRoot: string): Promise<ArtifactManifest> {
    const criteria: VerificationVerdictReport['criteria'] = [];
    const risks: VerificationVerdictReport['risks'] = [];

    if (contract.artifactTargets.length === 0) {
      criteria.push({ criterion: 'Has artifact targets', passed: false, notes: 'No targets specified' });
      risks.push({ level: 'high', description: 'Verification invoked with empty artifactTargets — likely a planning/coding failure' });
      const verdict: VerificationVerdictReport = {
        verdict: 'FAIL',
        subtaskId: contract.subtaskId,
        criteria,
        risks,
        remediationHints: ['Ensure the planner generates at least one subtask with an artifact target'],
        decision: 'REJECT',
        failedCriteria: criteria.filter(c => !c.passed).map(c => c.criterion),
        feedback: 'Verification failed: ' + criteria.filter(c => !c.passed).map(c => c.criterion).join('; '),
      };
      const content = JSON.stringify(verdict, null, 2);
      const relPath = `.omniflow/verification/${contract.subtaskId}/verdict.json`;
      const full = path.join(workspaceRoot, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf-8');
      return this.createManifest(contract.subtaskId, [{ filePath: relPath, content, hash: this.hash(content) }], verdict.verdict);
    }

    const excerpts: string[] = [];
    for (const target of contract.artifactTargets) {
      const full = path.join(workspaceRoot, target.filePath);
      const exists = fs.existsSync(full);
      criteria.push({ criterion: `Exists: ${target.filePath}`, passed: exists });
      if (!exists) continue;

      const content = fs.readFileSync(full, 'utf-8');
      criteria.push({ criterion: `Non-empty: ${target.filePath}`, passed: content.trim().length > 0 });

      if (/\.(ts|js)$/.test(target.filePath)) {
        const braces = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
        criteria.push({
          criterion: `Balanced braces: ${target.filePath}`,
          passed: braces === 0,
          notes: braces !== 0 ? 'Unbalanced braces' : undefined,
        });
      }

      if (!isStubContent(content)) {
        criteria.push({ criterion: `Real implementation (no stub/TODO): ${target.filePath}`, passed: true });
      } else {
        criteria.push({ criterion: `Real implementation (no stub/TODO): ${target.filePath}`, passed: false });
        risks.push({
          level: 'high',
          description: 'Stub/TODO detected in ' + target.filePath + ' — implementation is not real',
          mitigation: 'Re-run coder with explicit instruction to write complete code',
        });
      }

      excerpts.push(`- ${target.filePath}:\n"""${content.slice(0, 500)}"""`);
    }

    // Compass grounding: if the orchestrator provided a compass path, verify it
    // was produced and contains an explicit Acceptance Criteria section.
    if (contract.compassPath) {
      let passed = false;
      try {
        const compassFull = path.join(workspaceRoot, contract.compassPath);
        if (fs.existsSync(compassFull)) {
          const compassContent = fs.readFileSync(compassFull, 'utf-8');
          passed = compassContent.includes('## Acceptance Criteria');
        }
      } catch {
        passed = false;
      }
      criteria.push({ criterion: 'Compass acceptance criteria present', passed });
    }

    // Best-effort LLM semantic verification: judge goal-satisfaction of the whole deliverable.
    if (this.router && this.apiKeys) {
      try {
        let goal = contract.contextPacket.goal;
        let acceptance = '';
        if (contract.compassPath) {
          const compassFull = path.join(workspaceRoot, contract.compassPath);
          if (fs.existsSync(compassFull)) {
            const compassContent = fs.readFileSync(compassFull, 'utf-8');
            goal = extractSection(compassContent, 'Goal') || goal;
            acceptance = extractSection(compassContent, 'Acceptance Criteria');
          }
        }
        const prompt =
          'You are a strict QA reviewer. Given the user\'s GOAL and ACCEPTANCE CRITERIA, and the list of generated files with a short excerpt of each, decide if the deliverable actually fulfills the goal. Respond with JSON: {"satisfied": boolean, "missing": [string], "notes": string}.\n\n' +
          'GOAL:\n' + goal + '\n\n' +
          'ACCEPTANCE CRITERIA:\n' + (acceptance || '(none provided)') + '\n\n' +
          'GENERATED FILES:\n' + excerpts.join('\n');
        const res = await this.router.call(
          { phase: 'verify', agentRole: 'verifier', complexity: 'low' },
          prompt,
          'You are a strict QA reviewer. Respond ONLY with JSON.',
          this.apiKeys
        );
        const parsed = JSON.parse(this.extractJsonFromLLMResponse(res.content, undefined));
        if (parsed && parsed.satisfied === false) {
          const missing: string[] = Array.isArray(parsed.missing) ? parsed.missing : [];
          criteria.push({
            criterion: 'Meets goal & acceptance criteria',
            passed: false,
            notes: (parsed.notes || '') + (missing.length ? ' | missing: ' + missing.join(', ') : ''),
          });
          risks.push({
            level: 'medium',
            description: 'LLM reviewer determined the deliverable does not satisfy the goal/acceptance criteria',
            mitigation: 'Re-run coder with the goal and acceptance criteria emphasized',
          });
        } else {
          criteria.push({ criterion: 'Meets goal & acceptance criteria', passed: true });
        }
      } catch (e) {
        this.emitCommentary('verify', 'LLM verification unavailable: ' + (e instanceof Error ? e.message : String(e)));
      }
    }

    // Best-effort actual test/build execution (quality gate). Only meaningful for code projects.
    const hasCode = contract.artifactTargets.some((t) => /\.(ts|tsx|js|jsx|py|go)$/.test(t.filePath));
    let testReport: VerificationVerdictReport['testReport'];
    if (hasCode) {
      const test = this.runProjectTests(workspaceRoot);
      if (test.ran) {
        criteria.push({ criterion: `Tests/build pass (${test.command})`, passed: test.passed });
        if (!test.passed) {
          risks.push({
            level: 'high',
            description: `Test/build suite failed: ${test.command}`,
            mitigation: 'Re-run coder with the failing output to fix the code',
          });
        }
      } else {
        criteria.push({ criterion: 'Tests/build available', passed: true, notes: test.output });
      }
      // Surface test output into the verdict so a bounce loop can forward it to the coder.
      testReport = test;
    }

    const failed = criteria.filter((c) => !c.passed);
    const failedNames = failed.map(c => c.criterion);
    const verdict: VerificationVerdictReport = {
      verdict: failed.length ? 'FAIL' : risks.length ? 'NEEDS_REVIEW' : 'PASS',
      subtaskId: contract.subtaskId,
      criteria,
      risks,
      remediationHints: failed.length ? ['Fix missing or empty artifacts'] : undefined,
      decision: failed.length ? 'REJECT' : 'ACCEPT',
      failedCriteria: failed.length ? failedNames : undefined,
      feedback: failed.length ? 'Verification failed: ' + failedNames.join('; ') : undefined,
      ...(testReport ? { testReport } : {}),
    };

    if (testReport && !testReport.passed) {
      const snippet = ' | tests: ' + testReport.output.slice(0, 800);
      verdict.feedback = verdict.feedback ? verdict.feedback + snippet : ('Tests/build failed: ' + testReport.command + snippet);
    }

    const content = JSON.stringify(verdict, null, 2);
    const relPath = `.omniflow/verification/${contract.subtaskId}/verdict.json`;
    const full = path.join(workspaceRoot, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');

    return this.createManifest(contract.subtaskId, [{ filePath: relPath, content, hash: this.hash(content) }], verdict.verdict);
  }

  private runProjectTests(workspaceRoot: string): { command: string; ran: boolean; passed: boolean; output: string } {
    const pkgPath = path.join(workspaceRoot, 'package.json');
    let command = '';
    try {
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const scripts = (pkg && pkg.scripts) || {};
        if (scripts.test) command = 'npm test';
        else if (scripts.build) command = 'npm run build';
        else if (fs.existsSync(path.join(workspaceRoot, 'tsconfig.json'))) command = 'npx tsc --noEmit';
      } else if (fs.existsSync(path.join(workspaceRoot, 'pytest.ini')) || fs.existsSync(path.join(workspaceRoot, 'pyproject.toml')) || fs.existsSync(path.join(workspaceRoot, 'setup.py'))) {
        command = 'python -m pytest';
      } else if (fs.existsSync(path.join(workspaceRoot, 'go.mod'))) {
        command = 'go test ./...';
      }
    } catch { /* ignore */ }

    if (!command) return { command: '', ran: false, passed: false, output: 'No detectable test/build suite (no package.json scripts, pytest, go.mod, or tsconfig).' };

    try {
      const { execSync } = require('child_process');
      const out = execSync(command, { cwd: workspaceRoot, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
      return { command, ran: true, passed: true, output: out.slice(0, 4000) };
    } catch (e: any) {
      const stderr = (e && (e.stderr || e.stdout)) ? String(e.stderr || e.stdout) : String(e);
      return { command, ran: true, passed: false, output: stderr.slice(0, 4000) };
    }
  }
}
