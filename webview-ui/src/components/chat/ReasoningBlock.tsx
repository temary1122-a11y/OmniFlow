import { useState } from 'react';
import { Brain, ChevronRight } from 'lucide-react';
import type { AgentRole, Phase } from '@/types';
import { AGENT_META, PHASE_LABELS } from '@/utils/agentConfig';
import { useTypewriter } from '@/hooks/useTypewriter';

interface ReasoningBlockProps {
  content: string;
  agentId?: AgentRole;
  phase?: Phase;
  /** When true, reveal text token-by-token instead of dumping the full block. */
  stream?: boolean;
}

export function ReasoningBlock({ content, agentId, phase, stream = true }: ReasoningBlockProps) {
  const [open, setOpen] = useState(stream);
  const meta = agentId ? AGENT_META[agentId] : null;
  const color = meta?.color ?? 'var(--color-text-secondary, #8b949e)';
  const label = meta?.label ?? 'Agent';
  const phaseLabel = phase ? PHASE_LABELS[phase] : null;
  const displayed = useTypewriter(content, stream && open, 4, 12);
  const isStreaming = stream && open && displayed.length < content.length;

  return (
    <div
      className="omni-fade-up omni-reasoning-block"
      style={{
        borderLeft: `3px solid ${color}`,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
        borderRadius: 'var(--radius-md, 8px)',
        padding: '6px 10px',
        margin: '6px 0',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          padding: 0,
        }}
      >
        <ChevronRight
          size={12}
          style={{
            color: 'var(--color-text-secondary, #8b949e)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
        <Brain size={12} style={{ color }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary, #8b949e)' }}>
          Reasoning
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color }}>{label}</span>
        {phaseLabel && (
          <span style={{ fontSize: 10, color: 'var(--color-text-secondary, #8b949e)' }}>· {phaseLabel}</span>
        )}
        {isStreaming && (
          <span className="omni-pulse-dot" style={{ width: 6, height: 6, borderRadius: 999, background: color, marginLeft: 4 }} />
        )}
      </button>

      {open && (
        <p
          style={{
            marginTop: 6,
            paddingLeft: 10,
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            fontSize: 12,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            color: 'var(--color-text-secondary, #8b949e)',
            fontFamily: 'var(--font-family-mono, ui-monospace, monospace)',
          }}
        >
          {displayed}
          {isStreaming && <span className="omni-caret">▍</span>}
        </p>
      )}
    </div>
  );
}
