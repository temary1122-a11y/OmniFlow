import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ApiKeyPromptPayload } from '@/types';
import { useOmniStore } from '@/store/omniStore';

const cardStyle: CSSProperties = {
  background: 'var(--vscode-sideBar-background, #0d1117)',
  border: '1px solid var(--vscode-panel-border, #30363d)',
  borderRadius: 8,
  padding: 14,
  margin: '6px 0',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--vscode-descriptionForeground, #8b949e)', marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function ApiKeyPromptCard({ prompt }: { prompt: ApiKeyPromptPayload }) {
  const submitApiKeyPrompt = useOmniStore((s) => s.submitApiKeyPrompt);
  const openExternal = useOmniStore((s) => s.openExternal);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(prompt.tools.map((t) => [t.envVar, '']))
  );

  const filled = prompt.tools.filter((t) => (values[t.envVar] || '').trim().length > 0);
  const canProceed = filled.length > 0;

  return (
    <div style={cardStyle}>
      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--vscode-foreground, #e6e6e6)' }}>
        🔑 Требуется ключ веб-поиска
      </div>

      <p style={{ color: 'var(--vscode-foreground, #e6e6e6)', fontSize: 13, margin: '8px 0 0' }}>
        {prompt.reason}
      </p>

      <Section title="Получить ключ">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {prompt.tools.map((t) => (
            <button
              key={t.envVar}
              type="button"
              onClick={() => openExternal(t.signupUrl)}
              style={{
                fontSize: 12,
                padding: '4px 10px',
                borderRadius: 999,
                background: '#161b22',
                border: '1px solid var(--vscode-textLink-foreground, #7c6af7)',
                color: 'var(--vscode-textLink-foreground, #7c6af7)',
                cursor: 'pointer',
                fontFamily: 'var(--vscode-editor-font-family, ui-monospace, monospace)',
              }}
            >
              {t.toolName} ↗
            </button>
          ))}
        </div>
      </Section>

      <Section title="Вставьте ключ(и) — приватно">
        {prompt.tools.map((t) => (
          <div key={t.envVar} style={{ marginTop: 8 }}>
            <label
              style={{
                fontSize: 12,
                color: 'var(--vscode-descriptionForeground, #8b949e)',
                display: 'block',
                marginBottom: 3,
              }}
            >
              {t.toolName} <span style={{ opacity: 0.7 }}>({t.envVar})</span>
            </label>
            <input
              type="password"
              value={values[t.envVar]}
              onChange={(e) => setValues((v) => ({ ...v, [t.envVar]: e.target.value }))}
              placeholder={`Вставьте ${t.toolName} API key…`}
              style={{
                width: '100%',
                padding: 8,
                borderRadius: 6,
                fontSize: 13,
                background: '#010409',
                border: '1px solid var(--vscode-panel-border, #30363d)',
                color: 'var(--vscode-foreground, #e6e6e6)',
                outline: 'none',
              }}
            />
          </div>
        ))}
      </Section>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!canProceed}
          onClick={() => {
            const keys: Record<string, string> = {};
            for (const t of filled) keys[t.envVar] = values[t.envVar].trim();
            submitApiKeyPrompt(prompt.requestId, 'proceed', keys);
          }}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '8px 0',
            borderRadius: 6,
            fontWeight: 600,
            cursor: canProceed ? 'pointer' : 'not-allowed',
            background: canProceed ? 'var(--vscode-terminal-ansiGreen, #3fb950)' : '#21262d',
            border: 'none',
            color: canProceed ? '#03210f' : '#8b949e',
            opacity: canProceed ? 1 : 0.6,
          }}
        >
          🔍 Искать с ключом
        </button>
        {prompt.fallbackAvailable && (
          <button
            type="button"
            onClick={() => submitApiKeyPrompt(prompt.requestId, 'fallback')}
            style={{
              flex: 1,
              minWidth: 120,
              padding: '8px 0',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              background: '#161b22',
              border: '1px solid var(--vscode-panel-border, #30363d)',
              color: 'var(--vscode-foreground, #e6e6e6)',
            }}
          >
            Без ключа (fallback)
          </button>
        )}
        <button
          type="button"
          onClick={() => submitApiKeyPrompt(prompt.requestId, 'skip')}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '8px 0',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
            background: '#161b22',
            border: '1px solid var(--vscode-panel-border, #30363d)',
            color: 'var(--vscode-foreground, #e6e6e6)',
          }}
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}
