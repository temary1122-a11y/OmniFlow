import type { AgentRole, Phase } from '@/types';

export type ChatVerbosity = 'minimal' | 'normal' | 'debug';

/** System chat lines that are useful even in minimal mode. */
const KEEP_SYSTEM = /error|failed|deliver|approval|clarif|triage|verdict|bounce|stopped|retry/i;

/** Noise to hide in minimal/normal modes. */
const SYSTEM_NOISE = /^(✓|⚠)?\s*(LLM provider|LLM call|LLM fallback|openrouter|kilo-gateway|codik)/i;

export function shouldShowSystemChat(content: string, verbosity: ChatVerbosity): boolean {
  if (verbosity === 'debug') return true;
  if (KEEP_SYSTEM.test(content)) return true;
  if (SYSTEM_NOISE.test(content)) return false;
  if (verbosity === 'minimal' && /Model index refresh skipped/i.test(content)) return false;
  return verbosity === 'normal';
}

export function shouldShowLlmCall(verbosity: ChatVerbosity): boolean {
  return verbosity === 'debug';
}

export function shouldShowReasoningInChat(verbosity: ChatVerbosity): boolean {
  return verbosity !== 'minimal';
}

export function shouldShowToolInChat(verbosity: ChatVerbosity, toolName: string): boolean {
  if (verbosity === 'debug') return true;
  if (verbosity === 'minimal') {
    return !/^(read_file|get_tool_schema|help)$/i.test(toolName);
  }
  return true;
}

export function shouldShowCommentary(
  verbosity: ChatVerbosity,
  message: string,
  agentId: AgentRole
): boolean {
  if (verbosity === 'debug') return true;
  if (agentId === 'orchestrator' && /LLM|provider|responded/i.test(message)) return false;
  if (verbosity === 'minimal' && /Code index unavailable|Resolved symbol/i.test(message)) return false;
  return true;
}

export function phaseLabel(phase: Phase): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}
