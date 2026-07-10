import type { AgentRole, AgentStatus, Phase } from '@/types';

/** Canonical 8-role pipeline agents shown in the UI roster. */
export const CANONICAL_AGENT_ROLES = [
  'orchestrator',
  'clarifier',
  'researcher',
  'planner',
  'coder',
  'auditor',
  'security',
  'verifier',
] as const satisfies readonly AgentRole[];

export const AGENT_META: Record<AgentRole, { label: string; color: string; icon: string; description: string }> = {
  orchestrator: {
    label: 'Orchestrator',
    color: '#7c6af7',
    icon: '⬡',
    description: 'Main coordinator managing the full orchestration lifecycle',
  },
  clarifier: {
    label: 'Clarifier',
    color: '#a78bfa',
    icon: '◎',
    description: 'Goal refinement and clarifying question generation',
  },
  researcher: {
    label: 'Researcher',
    color: '#3b82f6',
    icon: '◈',
    description: 'Research and information gathering from external sources',
  },
  planner: {
    label: 'Planner',
    color: '#10b981',
    icon: '◻',
    description: 'Execution plan creation and task decomposition',
  },
  coder: {
    label: 'Coder',
    color: '#f59e0b',
    icon: '◆',
    description: 'Code implementation and file modifications',
  },
  auditor: {
    label: 'Auditor',
    color: '#ec4899',
    icon: '◉',
    description: 'Code review and quality assurance',
  },
  security: {
    label: 'Security',
    color: '#ef4444',
    icon: '⬟',
    description: 'Security analysis and vulnerability detection',
  },
  verifier: {
    label: 'Verifier',
    color: '#06b6d4',
    icon: '◐',
    description: 'Final verification and acceptance testing',
  },
  'pre-installer': {
    label: 'Pre-Installer',
    color: '#f59e0b',
    icon: '⚙',
    description: 'Pre-installs marketplace dependencies',
  },
  'tool-manager': {
    label: 'Tool Manager',
    color: '#ec4899',
    icon: '🛠',
    description: 'Manages and dispatches tools',
  },
  'context-agent': {
    label: 'Context Agent',
    color: '#8b5cf6',
    icon: '📚',
    description: 'Retrieves and governs context',
  },
};

type AgentMeta = { label: string; color: string; icon: string; description: string };

const FALLBACK_AGENT: AgentMeta = {
  label: 'Agent',
  color: '#7c6af7',
  icon: '◍',
  description: 'Agent',
};

/** Null-safe agent metadata lookup. The backend may emit auxiliary agent
 *  ids (e.g. 'pre-installer', 'tool-manager', 'context-agent') that are not
 *  part of the canonical 8-role set, so always fall back instead of throwing. */
export function getAgentMeta(role?: string | AgentRole): AgentMeta {
  const map = AGENT_META as Record<string, AgentMeta>;
  return role && map[role] ? map[role] : FALLBACK_AGENT;
}

export const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#6b7280',
  working: '#f59e0b',
  done: '#10b981',
  blocked: '#f97316',
  error: '#ef4444',
};

/** Null-safe status → color. Falls back to idle color for unknown statuses. */
export function getStatusColor(status?: AgentStatus | string): string {
  return (STATUS_COLORS as Record<string, string>)[status as string] ?? STATUS_COLORS.idle;
}

export const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  working: 'Working',
  done: 'Done',
  blocked: 'Blocked',
  error: 'Error',
};

export const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Idle',
  intake: 'Intake',
  research: 'Research',
  planning: 'Planning',
  build: 'Build',
  audit: 'Audit',
  security: 'Security',
  verify: 'Verify',
  deliver: 'Deliver',
  consult: 'Consult',
};

export const PHASE_COLORS: Record<Phase, string> = {
  idle: '#6b7280',
  intake: '#a78bfa',
  research: '#3b82f6',
  planning: '#10b981',
  build: '#f59e0b',
  audit: '#ec4899',
  security: '#ef4444',
  verify: '#06b6d4',
  deliver: '#10b981',
  consult: '#a78bfa',
};

export const TOOL_ICONS: Record<string, string> = {
  bash: '💻',
  execute_bash: '💻',
  browser: '🌐',
  search: '🔍',
  web_search: '🔍',
  read_file: '📄',
  write_file: '✍️',
  edit_file: '📝',
  todo: '✅',
  list_todo: '📋',
  memory: '🧠',
  think: '💭',
  default: '🔧',
};

export function getToolIcon(toolName: string): string {
  const lower = toolName.toLowerCase();
  const exact = TOOL_ICONS[lower];
  if (exact) return exact;
  for (const [key, icon] of Object.entries(TOOL_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return TOOL_ICONS.default;
}
