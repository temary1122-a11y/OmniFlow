import { useOmniStore } from '@/store/omniStore';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { ChatView } from '@/components/chat/ChatView';
import { AgentsPanel } from '@/components/agents/AgentsPanel';
import { FilesPanel } from '@/components/panels/FilesPanel';
import { SessionsPanel } from '@/components/panels/SessionsPanel';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { cn } from '@/utils/cn';

/**
 * ThreePaneLayout
 * ---------------------------------------------------------------------------
 * App shell. Left: collapsible Sidebar. Center: Toolbar over the active tab's
 * view. Right: the AgentsPanel inspector (only for the chat + agents tabs).
 * Full-height flex, adapted from v2's ThreePaneLayout with v1's fixed inspector
 * column and the v3 store.
 */

const BORDER = 'var(--color-border, #30363d)';

function CenterView({ tab }: { tab: ReturnType<typeof useOmniStore.getState>['activeTab'] }) {
  switch (tab) {
    case 'files':
      return <FilesPanel />;
    case 'sessions':
      return <SessionsPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'agents':
      return <AgentsPanel />;
    case 'chat':
    default:
      return <ChatView />;
  }
}

export function ThreePaneLayout() {
  const sidebarOpen = useOmniStore((s) => s.sidebarOpen);
  const activeTab = useOmniStore((s) => s.activeTab);

  // Right inspector only for the chat tab. The agents tab renders AgentsPanel
  // as the full center view, so showing it again on the right would duplicate it.
  const showRightPane = activeTab === 'chat';

  return (
    <div
      className={cn('omni-three-pane')}
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--color-bg-primary, #0b0d12)',
        color: 'var(--color-text-primary, #e6e6e6)',
      }}
    >
      {/* Left: Sidebar */}
      <div
        style={{
          width: sidebarOpen ? 240 : 56,
          flexShrink: 0,
          height: '100%',
          overflow: 'hidden',
          transition: 'width 200ms ease',
        }}
      >
        <Sidebar />
      </div>

      {/* Center: Toolbar + active tab view */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <Toolbar />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <CenterView tab={activeTab} />
        </div>
      </div>

      {/* Right: Agents inspector (chat + agents tabs only) */}
      {showRightPane && (
        <div
          style={{
            width: 340,
            flexShrink: 0,
            height: '100%',
            overflow: 'hidden',
            borderLeft: `1px solid ${BORDER}`,
            background: 'var(--color-bg-secondary, #0d1117)',
          }}
        >
          <AgentsPanel />
        </div>
      )}
    </div>
  );
}
