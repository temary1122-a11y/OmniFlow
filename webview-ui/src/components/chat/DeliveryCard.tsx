import type { CSSProperties } from 'react';
import type { DeliveryReport, VerificationVerdict } from '@/types';
import { useOmniStore } from '@/store/omniStore';

const VERIDCT_COLOR: Record<VerificationVerdict, string> = {
  PASS: 'var(--vscode-terminal-ansiGreen, #3fb950)',
  FAIL: 'var(--vscode-terminal-ansiRed, #f85149)',
  NEEDS_REVIEW: 'var(--vscode-terminal-ansiYellow, #d29922)',
};

const cardStyle: CSSProperties = {
  background: 'var(--vscode-sideBar-background, #0d1117)',
  border: '1px solid var(--vscode-panel-border, #30363d)',
  borderRadius: 8,
  padding: 14,
  margin: '6px 0',
};

export function DeliveryCard({ report }: { report: DeliveryReport }) {
  const openArtifact = useOmniStore((st) => st.openArtifact);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--vscode-terminal-ansiGreen, #3fb950)' }}>✅ Готово</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: VERIDCT_COLOR[report.verdict],
            border: `1px solid ${VERIDCT_COLOR[report.verdict]}`,
            borderRadius: 999,
            padding: '1px 8px',
          }}
        >
          {report.verdict}
        </span>
      </div>

      <p style={{ color: 'var(--vscode-foreground, #e6e6e6)', fontSize: 13, margin: '8px 0 0' }}>{report.summary}</p>

      <div style={{ fontSize: 12, color: 'var(--vscode-descriptionForeground, #8b949e)', marginTop: 8 }}>
        Длительность: {(report.durationMs / 1000).toFixed(1)}s
      </div>

      {report.runInstructions && (
        <pre
          style={{
            fontFamily: 'var(--vscode-editor-font-family, ui-monospace, monospace)',
            fontSize: 12,
            background: '#010409',
            border: '1px solid var(--vscode-panel-border, #30363d)',
            borderRadius: 6,
            padding: 10,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginTop: 10,
            color: 'var(--vscode-foreground, #e6e6e6)',
          }}
        >
          {report.runInstructions}
        </pre>
      )}

      {report.artifacts?.length ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--vscode-descriptionForeground, #8b949e)', marginBottom: 6 }}>
            Артефакты
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {report.artifacts.map((a) => (
              <div
                key={a.filePath}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: '#161b22',
                  border: '1px solid var(--vscode-panel-border, #30363d)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--vscode-foreground, #e6e6e6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.filePath}
                </span>
                <button
                  type="button"
                  onClick={() => openArtifact(a.filePath)}
                  style={{
                    flexShrink: 0,
                    fontSize: 12,
                    padding: '3px 10px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    background: 'var(--vscode-textLink-foreground, #7c6af7)',
                    border: 'none',
                    color: '#fff',
                  }}
                >
                  Открыть
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
