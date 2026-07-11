import { useOmniStore } from '@/store/omniStore';
import { Sidebar } from './Sidebar';
import { Toolbar } from './Toolbar';
import { ChatView } from '@/components/chat/ChatView';
import { FilesPanel } from '@/components/panels/FilesPanel';
import { SessionsPanel } from '@/components/panels/SessionsPanel';
import { SettingsPanel } from '@/components/panels/SettingsPanel';
import { cn } from '@/utils/cn';

/**
 * ThreePaneLayout
 * ---------------------------------------------------------------------------
 * App shell. Left: collapsible Sidebar. Right of it: Toolbar over the active
 * tab's view (chat, files, sessions, settings). Full-height flex.
 */

function CenterView({ tab }: { tab: ReturnType<typeof useOmniStore.getState>['activeTab'] }) {
  switch (tab) {
    case 'files':
      return <FilesPanel />;
    case 'sessions':
      return <SessionsPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'chat':
    default:
      return <ChatView />;
  }
}

export function ThreePaneLayout() {
  const sidebarOpen = useOmniStore((s) => s.sidebarOpen);
  const activeTab = useOmniStore((s) => s.activeTab);

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
    </div>
  );
}
