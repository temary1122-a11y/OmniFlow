import { X, Brain } from 'lucide-react';
import { useOmniStore } from '@/store/omniStore';
import { AGENT_META, STATUS_LABELS, getAgentMeta, getStatusColor } from '@/utils/agentConfig';
import type { AgentRole } from '@/types';

/**
 * AgentDetail
 * ---------------------------------------------------------------------------
 * Drill-down panel for the currently selected agent: identity, live status,
 * and its reasoning traces. Self-hides when nothing is selected.
 */

export function AgentDetail() {
  const selectedAgentId = useOmniStore((s) => s.selectedAgentId);
  const showAgentDetail = useOmniStore((s) => s.showAgentDetail);
  const reasoningTraces = useOmniStore((s) => s.reasoningTraces);
  const agentStatuses = useOmniStore((s) => s.agentStatuses);
  const setShowAgentDetail = useOmniStore((s) => s.setShowAgentDetail);

  if (!selectedAgentId || !showAgentDetail) return null;

  const role = selectedAgentId as AgentRole;
  const meta = getAgentMeta(role);
  const status = agentStatuses[role];
  const statusColor = getStatusColor(status);
  const traces = reasoningTraces[role] ?? [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderBottom: '1px solid var(--vscode-panel-border, #30363d)',
          borderTop: `2px solid ${meta.color}`,
        }}
      >
        <span style={{ fontSize: 20, color: meta.color }}>{meta.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: meta.color }}>{meta.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 9999,
                background: statusColor,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 11, color: statusColor }}>{STATUS_LABELS[status]}</span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close agent detail"
          onClick={() => setShowAgentDetail(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 6,
            cursor: 'pointer',
            color: 'var(--vscode-descriptionForeground, #8b949e)',
            background: 'transparent',
            border: '1px solid transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--vscode-widget-background, #161b22)';
            e.currentTarget.style.color = 'var(--vscode-foreground, #e6e6e6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--vscode-descriptionForeground, #8b949e)';
          }}
        >
          <X size={14} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--vscode-descriptionForeground, #8b949e)' }}>
          {meta.description}
        </p>

        <section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'var(--vscode-descriptionForeground, #8b949e)',
            }}
          >
            <Brain size={12} style={{ color: meta.color }} /> Reasoning
          </div>
          {traces.length === 0 ? (
            <p style={{ margin: 0, paddingLeft: 4, fontSize: 12, color: 'var(--vscode-descriptionForeground, #8b949e)' }}>
              No thoughts yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {traces.map((trace, i) => (
                <div
                  key={i}
                  style={{
                    borderLeft: `2px solid ${meta.color}`,
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'var(--vscode-widget-background, #161b22)',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11.5,
                      fontStyle: "italic",
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      color: 'var(--vscode-descriptionForeground, #8b949e)',
                      fontFamily: 'var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, Menlo, monospace)',
                    }}
                  >
                    {trace}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
