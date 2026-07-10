import { BaseAgent } from './BaseAgent';
import type { HandoffContract, ArtifactManifest, SecurityReport } from '../../shared/types';
import type { ConsultFn } from '../core/AgentConsultant';
import * as path from 'path';
import * as fs from 'fs';

const SECRET_PATTERNS = [
  /api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /password\s*[:=]\s*['"][^'"]+['"]/i,
  /secret\s*[:=]\s*['"][^'"]+['"]/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /Bearer\s+[a-zA-Z0-9._-]{20,}/,
];

export class SecurityAgent extends BaseAgent {
  private consultFn?: ConsultFn;
  constructor() {
    super('security');
  }

  setConsultFn(fn: ConsultFn): void {
    this.consultFn = fn;
  }

  async execute(contract: HandoffContract, workspaceRoot: string): Promise<ArtifactManifest> {
    const findings: SecurityReport['findings'] = [];

    for (const target of contract.artifactTargets) {
      const full = path.join(workspaceRoot, target.filePath);
      if (!fs.existsSync(full)) continue;
      const content = fs.readFileSync(full, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(line)) {
            findings.push({
              severity: 'high',
              file: target.filePath,
              issue: `Potential secret on line ${idx + 1}: ${line.trim().slice(0, 60)}…`,
            });
          }
        }
        if (/\.env\b/.test(line) && !/\.env\.example/.test(line)) {
          findings.push({ severity: 'low', file: target.filePath, issue: 'References .env file — ensure not committed' });
        }
      });
    }

    const report: SecurityReport = {
      taskId: contract.contextPacket.taskId,
      findings,
      passed: !findings.some((f) => f.severity === 'high'),
    };

    const content = JSON.stringify(report, null, 2);
    const relPath = `.omniflow/security/${contract.contextPacket.taskId}/security-report.json`;
    const full = path.join(workspaceRoot, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf-8');

    return this.createManifest(contract.subtaskId, [{ filePath: relPath, content, hash: this.hash(content) }], report.passed ? 'Security PASS' : 'Security issues found');
  }
}
