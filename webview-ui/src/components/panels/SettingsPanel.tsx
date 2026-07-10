import { Settings, KeyRound, Trash2, Download, Sparkles, Shield } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useOmniStore } from '@/store/omniStore';
import type { ChatVerbosity } from '@/lib/chatFilters';

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

function fieldLabel(text: string) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: DESC, marginBottom: 6 }}>
      {text}
    </div>
  );
}

export function SettingsPanel() {
  const modelCatalog = useOmniStore((s) => s.modelCatalog);
  const selectModel = useOmniStore((s) => s.selectModel);
  const configureApi = useOmniStore((s) => s.configureApi);
  const clearMessages = useOmniStore((s) => s.clearMessages);
  const exportSession = useOmniStore((s) => s.exportSession);
  const chatVerbosity = useOmniStore((s) => s.chatVerbosity);
  const setChatVerbosity = useOmniStore((s) => s.setChatVerbosity);
  const useSupervisor = useOmniStore((s) => s.useSupervisor);
  const setUseSupervisor = useOmniStore((s) => s.setUseSupervisor);
  const budget = useOmniStore((s) => s.budget);
  const setBudget = useOmniStore((s) => s.setBudget);
  const activityLog = useOmniStore((s) => s.activityLog);

  const selectStyle: CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 12.5,
    borderRadius: 8,
    color: FG,
    background: 'var(--vscode-input-background, #0b0d12)',
    border: `1px solid ${BORDER}`,
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', color: FG }}>
      <div style={headerStyle}>
        <Settings size={16} style={{ color: ACCENT }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.3 }}>Settings</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section>
          {fieldLabel('Chat density')}
          <select
            value={chatVerbosity}
            onChange={(e) => setChatVerbosity(e.target.value as ChatVerbosity)}
            aria-label="Chat verbosity"
            style={selectStyle}
          >
            <option value="minimal">Minimal — focus on results & agent commentary</option>
            <option value="normal">Normal — show tools & reasoning</option>
            <option value="debug">Debug — everything including LLM calls</option>
          </select>
        </section>

        <section>
          {fieldLabel('Budget (free models first)')}
          <select value={budget} onChange={(e) => setBudget(e.target.value as typeof budget)} aria-label="Budget" style={selectStyle}>
            <option value="free">Free — maximize :free models</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </section>

        <section style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={14} style={{ color: ACCENT }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>Agent Supervisor</div>
              <div style={{ fontSize: 11, color: DESC }}>Smart parallel coder orchestration with retry</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={useSupervisor}
            onChange={(e) => setUseSupervisor(e.target.checked)}
            aria-label="Enable agent supervisor"
          />
        </section>

        <section>
          {fieldLabel('Model')}
          {Object.keys(modelCatalog).length > 0 ? (
            <select defaultValue="" onChange={(e) => selectModel(e.target.value || undefined)} aria-label="Select model" style={selectStyle}>
              <option value="">Select model…</option>
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
          ) : (
            <p style={{ margin: 0, fontSize: 11, color: DESC }}>Model catalog loads when the extension connects.</p>
          )}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={() => configureApi()} style={btnStyle(true)} aria-label="Configure API">
            <KeyRound size={14} />
            Configure API Keys
          </button>
          <button type="button" onClick={() => exportSession()} style={btnStyle(false)} aria-label="Export session">
            <Download size={14} />
            Export session JSON
          </button>
          <button type="button" onClick={() => clearMessages()} style={btnStyle(false)} aria-label="Clear chat">
            <Trash2 size={14} />
            Clear chat
          </button>
        </section>

        {chatVerbosity === 'debug' && activityLog.length > 0 && (
          <section>
            {fieldLabel('Activity log')}
            <pre
              style={{
                margin: 0,
                maxHeight: 160,
                overflow: 'auto',
                padding: 10,
                fontSize: 10,
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: '#010409',
                color: DESC,
              }}
            >
              {activityLog.join('\n')}
            </pre>
          </section>
        )}

        <section style={{ padding: 12, borderRadius: 10, border: `1px solid ${ACCENT}33`, background: `${ACCENT}0a` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Sparkles size={14} style={{ color: ACCENT }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Vibe-coder mode</span>
          </div>
          <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: DESC }}>
            Use <strong>Minimal</strong> chat density + <strong>Free</strong> budget. Agents delegate live — watch the graph spawn nodes as they activate.
          </p>
        </section>
      </div>
    </div>
  );
}
