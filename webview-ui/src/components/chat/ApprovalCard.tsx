import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { ApprovalRequiredPayload } from '@/types';
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

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: ApprovalRequiredPayload;
  onApprove: (feedback?: string) => void;
  onReject: (feedback?: string) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const openArtifact = useOmniStore((s) => s.openArtifact);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--vscode-foreground, #e6e6e6)' }}>{approval.title}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--vscode-textLink-foreground, #7c6af7)',
            border: '1px solid var(--vscode-textLink-foreground, #7c6af7)',
            borderRadius: 999,
            padding: '1px 8px',
          }}
        >
          {approval.tier}
        </span>
      </div>

      <p style={{ color: 'var(--vscode-foreground, #e6e6e6)', fontSize: 13, margin: '8px 0 0' }}>{approval.summary}</p>

      {approval.architecture && <Section title="Архитектура">{approval.architecture}</Section>}

      {approval.stack?.length ? (
        <Section title="Стек">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {approval.stack.map((tech) => (
              <span
                key={tech}
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: '#161b22',
                  border: '1px solid var(--vscode-panel-border, #30363d)',
                  color: 'var(--vscode-foreground, #e6e6e6)',
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      {approval.acceptanceCriteria?.length ? (
        <Section title="Критерии приёмки">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--vscode-foreground, #e6e6e6)' }}>
            {approval.acceptanceCriteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {approval.files?.length ? (
        <Section title="Файлы">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, listStyle: 'none' }}>
            {approval.files.map((f, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => openArtifact(f)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--vscode-textLink-foreground, #7c6af7)',
                    fontFamily: 'var(--vscode-editor-font-family, ui-monospace, monospace)',
                    fontSize: 13,
                    textAlign: 'left',
                  }}
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Комментарий (необязательно)…"
        rows={2}
        style={{
          width: '100%',
          marginTop: 12,
          padding: 8,
          borderRadius: 6,
          fontSize: 13,
          resize: 'vertical',
          background: '#010409',
          border: '1px solid var(--vscode-panel-border, #30363d)',
          color: 'var(--vscode-foreground, #e6e6e6)',
          outline: 'none',
        }}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => onApprove(feedback || undefined)}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
            background: 'var(--vscode-terminal-ansiGreen, #3fb950)',
            border: 'none',
            color: '#03210f',
          }}
        >
          ✅ Одобрить
        </button>
        <button
          type="button"
          onClick={() => onReject(feedback || undefined)}
          style={{
            flex: 1,
            padding: '8px 0',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
            background: 'var(--vscode-terminal-ansiRed, #f85149)',
            border: 'none',
            color: '#2b0606',
          }}
        >
          ⛔ Отклонить
        </button>
      </div>
    </div>
  );
}
