import {
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Folder,
  History,
  Settings,
  KeyRound,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { useOmniStore } from '@/store/omniStore';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/i18n';

/**
 * Sidebar
 * ---------------------------------------------------------------------------
 * Collapsible left rail: primary tab navigation, the live agent roster (with
 * status dots), and a providers/model section. Expands to a full nav pane or
 * collapses to a slim icon rail. Best-of-best of v1 (rich sections) + v2
 * (collapse UX), re-implemented against the canonical v3 contract.
 */

type Tab = 'chat' | 'files' | 'sessions' | 'settings';

const NAV_ITEMS: { id: Tab; icon: typeof MessageSquare; label: string }[] = [
  { id: 'chat', icon: MessageSquare, label: 'Чат' },
  { id: 'files', icon: Folder, label: 'Файлы' },
  { id: 'sessions', icon: History, label: 'Сессии' },
  { id: 'settings', icon: Settings, label: 'Настройки' },
];

const ACCENT = 'var(--color-primary, #7c6af7)';
const BORDER = 'var(--color-border, #30363d)';
const FG = 'var(--color-text-primary, #e6e6e6)';
const DESC = 'var(--color-text-secondary, #8b949e)';
const GREEN = 'var(--color-success, #3fb950)';
const RED = 'var(--color-error, #f85149)';

const sectionLabelStyle: CSSProperties = {
  padding: '4px 8px',
  fontSize: 'var(--font-size-xs, 11px)',
  fontWeight: 'var(--font-weight-semibold, 600)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: DESC,
};

export function Sidebar() {
  const { t } = useTranslation();
  const activeTab = useOmniStore((s) => s.activeTab);
  const setActiveTab = useOmniStore((s) => s.setActiveTab);
  const sidebarOpen = useOmniStore((s) => s.sidebarOpen);
  const setSidebarOpen = useOmniStore((s) => s.setSidebarOpen);
  const providerInfo = useOmniStore((s) => s.providerInfo);
  const modelCatalog = useOmniStore((s) => s.modelCatalog);
  const configureApi = useOmniStore((s) => s.configureApi);
  const selectModel = useOmniStore((s) => s.selectModel);

  // ── Collapsed slim rail ──────────────────────────────────
  if (!sidebarOpen) {
    return (
      <div
        className={cn('omni-sidebar', 'omni-sidebar-collapsed')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          height: '100%',
          width: '100%',
          padding: '8px 0',
          borderRight: `1px solid ${BORDER}`,
          background: 'var(--color-bg-secondary, #0d1117)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          title={t('sidebar.expand')}
          aria-label={t('sidebar.expand')}
          style={railBtnStyle(false)}
        >
          <PanelLeftOpen size={17} />
        </button>

        <div style={{ width: 24, height: 1, background: BORDER, margin: '4px 0' }} />

        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              aria-label={item.label}
              style={railBtnStyle(active)}
            >
              <Icon size={17} />
            </button>
          );
        })}

        <div style={{ width: 24, height: 1, background: BORDER, margin: '4px 0' }} />
      </div>
    );
  }

  // ── Expanded pane ────────────────────────────────────────
  return (
    <div
      className={cn('omni-sidebar')}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        borderRight: `1px solid ${BORDER}`,
        background: 'var(--color-bg-secondary, #0d1117)',
        color: FG,
        overflow: 'hidden',
      }}
    >
      {/* Header + collapse toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 'var(--font-size-sm, 12px)', fontWeight: 'var(--font-weight-semibold, 600)', letterSpacing: 0.3, color: DESC }}>
          {t('sidebar.navigator')}
        </span>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          title={t('sidebar.collapse')}
          aria-label={t('sidebar.collapse')}
          style={railBtnStyle(false)}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 8,
        }}
      >
        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                title={item.label}
                aria-label={item.label}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: 'var(--font-size-sm, 12.5px)',
                  fontWeight: active ? 'var(--font-weight-semibold, 600)' : 'var(--font-weight-medium, 500)',
                  cursor: 'pointer',
                  color: active ? ACCENT : DESC,
                  background: active ? `${ACCENT}1f` : 'transparent',
                  border: `1px solid ${active ? `${ACCENT}55` : 'transparent'}`,
                }}
              >
                {active && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 2,
                      height: 16,
                      borderRadius: 9999,
                      background: ACCENT,
                    }}
                  />
                )}
                <Icon size={16} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Providers subsection */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={sectionLabelStyle}>{t('sidebar.providers')}</div>

          {Object.keys(providerInfo).length === 0 ? (
            <p style={{ margin: 0, padding: '0 8px', fontSize: 11, color: DESC }}>
              {t('sidebar.noProviders')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(providerInfo).map(([name, info]) => (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    background: 'var(--vscode-editor-background, #0b0d12)',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 9999,
                      flexShrink: 0,
                      background: info.hasKey ? GREEN : RED,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                  <span style={{ fontSize: 10, color: info.hasKey ? GREEN : DESC }}>
                    {info.hasKey ? t('sidebar.connected') : t('sidebar.noKey')}
                  </span>
                </div>
              ))}
            </div>
          )}

          {Object.keys(modelCatalog).length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => selectModel(e.target.value || undefined)}
               aria-label={t('sidebar.selectModel')}
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 12,
                borderRadius: 8,
                color: FG,
                background: 'var(--vscode-input-background, #0b0d12)',
                border: `1px solid ${BORDER}`,
                outline: 'none',
              }}
            >
              <option value="">{t('sidebar.selectModel')}</option>
              {Object.entries(modelCatalog).map(([provider, models]) => (
                <optgroup key={provider} label={provider}>
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => configureApi()}
            title={t('sidebar.configureApi')}
            aria-label={t('sidebar.configureApi')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 8px',
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 8,
              cursor: 'pointer',
              color: ACCENT,
              background: `${ACCENT}14`,
              border: `1px solid ${ACCENT}55`,
            }}
          >
            <KeyRound size={14} />
          {t('sidebar.configureApi')}
          </button>
        </section>
      </div>
    </div>
  );
}

function railBtnStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
    cursor: 'pointer',
    color: active ? ACCENT : DESC,
    background: active ? `${ACCENT}1f` : 'transparent',
    border: `1px solid ${active ? `${ACCENT}55` : 'transparent'}`,
  };
}
