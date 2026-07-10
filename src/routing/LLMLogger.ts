import * as vscode from 'vscode';
import type { AgentRole, Phase } from '../../shared/types';

export interface LLMCallInfo {
  provider: string;
  model: string;
  agentRole: AgentRole;
  phase: Phase;
  usedFallback: boolean;
  error?: string;
  endpoint?: string;
}

let outputChannel: vscode.OutputChannel | null = null;
let onCallListener: ((info: LLMCallInfo) => void) | null = null;

export function initLLMLogger(channel: vscode.OutputChannel): void {
  outputChannel = channel;
}

export function setLLMCallListener(listener: ((info: LLMCallInfo) => void) | null): void {
  onCallListener = listener;
}

export function logLLMCall(info: LLMCallInfo): void {
  const status = info.usedFallback ? 'FALLBACK' : 'HTTP';
  const line = `[${status}] ${info.agentRole} @ ${info.phase} → ${info.provider}/${info.model}${
    info.error ? ` (${info.error})` : ''
  }`;
  outputChannel?.appendLine(line);
  if (info.endpoint && !info.usedFallback) {
    outputChannel?.appendLine(`  ↳ POST ${info.endpoint}`);
  }
  if (info.usedFallback) {
    outputChannel?.appendLine('  ↳ No live router call — check API key or provider settings.');
  }
  onCallListener?.(info);
}
