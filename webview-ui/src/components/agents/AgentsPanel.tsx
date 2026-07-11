import { Users } from 'lucide-react';
import { TimelineView } from './TimelineView';
import { AgentGraph } from './AgentGraph';
import { AgentDetail } from './AgentDetail';
import { useTranslation } from '@/i18n';

export function AgentsPanel() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        color: 'var(--vscode-foreground, #e6e6e6)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid var(--vscode-panel-border, #30363d)',
          flexShrink: 0,
        }}
      >
        <Users size={16} style={{ color: 'var(--vscode-textLink-foreground, #7c6af7)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}>{t('panel.agents')}</span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 14,
        }}
      >
        <section
          style={{
            border: '1px solid var(--vscode-panel-border, #30363d)',
            borderRadius: 12,
            overflow: 'hidden',
            minHeight: 240,
          }}
        >
          <AgentDetail />
        </section>

        <section
          style={{
            border: '1px solid var(--vscode-panel-border, #30363d)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'var(--vscode-descriptionForeground, #8b949e)',
              borderBottom: '1px solid var(--vscode-panel-border, #30363d)',
            }}
          >
            {t('panel.agentGraph')}
          </div>
          <div style={{ height: 260 }}>
            <AgentGraph />
          </div>
        </section>

        <section>
          <TimelineView />
        </section>
      </div>
    </div>
  );
}
