import { BaseAgent } from './BaseAgent';
import type { HandoffContract, ArtifactManifest, VerificationVerdictReport } from '../../shared/types';
import * as path from 'path';
import * as fs from 'fs';

export class AuditAgent extends BaseAgent {
  constructor() {
    super('auditor');
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

    const failed = findings.filter((f) => !f.passed);
    const verdict: VerificationVerdictReport = {
      verdict: failed.length ? 'FAIL' : risks.length ? 'NEEDS_REVIEW' : 'PASS',
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
}
