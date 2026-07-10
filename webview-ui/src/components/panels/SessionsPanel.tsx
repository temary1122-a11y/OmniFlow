import { Plus, Download, Trash2, History } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useOmniStore } from '@/store/omniStore';

/**
 * SessionsPanel
 * ---------------------------------------------------------------------------
 * Sessions tab. Shows current session info and provides functional controls:
 * New session (resetSession), Export session, Clear chat.
 */

const ACCENT = 'var(--vscode-textLink-foreground, #7c6af7)';
const BORDER = 'var(--vscode-panel-border, #30363d)';
const FG = 'var(--vscode-foreground, #e6e6e6)';
const DESC = 'var(--vscode-descriptionForeground, #8b949e)';

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderBottom: `1px solid ${BORDER}`,
  flexShrink: 0,
};

function btnStyle(accent: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 10px',
    fontSize: 12.5,
    fontWeight: 500,
    borderRadius: 8,
    cursor: 'pointer',
    color: accent ? ACCENT : FG,
    background: accent ? `${ACCENT}14` : 'var(--vscode-input-background, #0b0d12)',
    border: `1px solid ${accent ? `${ACCENT}55` : BORDER}`,
  };
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: DESC }}>
        {label}
      </span>
      <span style={{ fontSize: 12.5, color: FG, wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
}

export function SessionsPanel() {
  const sessionId = useOmniStore((s) => s.sessionId);
  const goal = useOmniStore((s) => s.goal);
  const messages = useOmniStore((s) => s.messages);
  const currentPhase = useOmniStore((s) => s.currentPhase);
  const resetSession = useOmniStore((s) => s.resetSession);
  const exportSession = useOmniStore((s) => s.exportSession);
  const clearMessages = useOmniStore((s) => s.clearMessages);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        color: FG,
      }}
    >
      <div style={headerStyle}>
        <History size={16} style={{ color: ACCENT }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}>Sessions</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14 }}>
        <div style={{ marginBottom: 12 }}>
          <InfoRow label="Session ID" value={sessionId} />
          <InfoRow label="Goal" value={goal} />
          <InfoRow label="Messages" value={String(messages.length)} />
          <InfoRow label="Current phase" value={currentPhase} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={() => resetSession()} style={btnStyle(true)} aria-label="New session">
            <Plus size={14} />
            New session
          </button>
          <button type="button" onClick={() => exportSession()} style={btnStyle(false)} aria-label="Export session">
            <Download size={14} />
            Export session
          </button>
          <button type="button" onClick={() => clearMessages()} style={btnStyle(false)} aria-label="Clear chat">
            <Trash2 size={14} />
            Clear chat
          </button>
        </div>
      </div>
    </div>
  );
}
