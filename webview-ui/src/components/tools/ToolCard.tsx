import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { MessagePart } from '@/types';
import { cn } from '@/utils/cn';
import { getToolIcon } from '@/utils/agentConfig';
import { monoBoxStyle } from '@/styles/mono';
import { useOmniStore } from '@/store/omniStore';
import { useTranslation } from '@/i18n';

type ToolPart = Extract<MessagePart, { type: 'tool_call' }>;

/** Pull unique, ordered http(s) URLs out of a tool result body. */
function extractUrls(text: string): string[] {
  const matches = typeof text === 'string' ? text.match(/https?:\/\/[^\s)]+/gi) : null;
  if (!matches) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of matches) {
    const key = u.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(u);
    }
  }
  return out;
}

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

const monoBox: CSSProperties = { ...monoBoxStyle, maxHeight: 260 };

function TerminalView({ part }: { part: ToolPart }) {
  const command = s(part.args?.command);
  const output = s(part.output);
  return (
    <div style={monoBox}>
      {command && <div style={{ color: 'var(--vscode-terminal-ansiGreen, #3fb950)' }}>$ {command}</div>}
      {output && <div style={{ marginTop: command ? 6 : 0 }}>{output}</div>}
    </div>
  );
}

function BrowserView({ part }: { part: ToolPart }) {
  const openExternal = useOmniStore((s) => s.openExternal);
  const output = s(part.output);
  // web_search/fetch_page return source URLs (often as "SOURCE <url>" lines);
  // surface those as clickable links to the resource being studied instead of
  // dumping raw text or a placeholder dash.
  const urls = extractUrls(output);
  const linkStyle: CSSProperties = {
    ...monoBox,
    display: 'block',
    width: '100%',
    cursor: 'pointer',
    textAlign: 'left',
    color: 'var(--vscode-textLink-foreground, #7c6af7)',
    background: 'none',
    border: 'none',
    padding: 0,
    wordBreak: 'break-all',
  };
  return (
    <div>
      {urls.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {urls.map((u, i) => (
            <button key={i} type="button" onClick={() => openExternal(u)} style={linkStyle}>
              🔗 {u}
            </button>
          ))}
        </div>
      ) : output ? (
        <div style={monoBox}>{output}</div>
      ) : (
        <div style={monoBox}>—</div>
      )}
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--vscode-descriptionForeground, #8b949e)' }}>
        🔗 sources
      </div>
    </div>
  );
}

function FileView({ part }: { part: ToolPart }) {
  const openArtifact = useOmniStore((s) => s.openArtifact);
  const path = s(part.args?.path);
  const content = s(part.output) || s(part.args?.content);
  return (
    <div>
      {path && (
        <button
          type="button"
          onClick={() => openArtifact(path)}
          style={{
            fontSize: 12,
            color: 'var(--vscode-textLink-foreground, #7c6af7)',
            marginBottom: 6,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            fontFamily: 'var(--vscode-editor-font-family, ui-monospace, monospace)',
          }}
        >
          📄 {path}
        </button>
      )}
      <pre style={monoBox}>{content || '—'}</pre>
    </div>
  );
}

function TodoView({ part }: { part: ToolPart }) {
  const todos = part.args?.todos;
  if (Array.isArray(todos) && todos.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {todos.map((t, i) => {
          const todo = t as { text?: string; content?: string; done?: boolean; checked?: boolean };
          const label = s(todo.text ?? todo.content ?? t);
          const done = Boolean(todo.done ?? todo.checked);
          return (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={done} readOnly />
              <span style={{ textDecoration: done ? 'line-through' : 'none', color: 'var(--vscode-foreground, #e6e6e6)' }}>
                {label}
              </span>
            </label>
          );
        })}
      </div>
    );
  }
  return <pre style={monoBox}>{JSON.stringify(part.args ?? {}, null, 2)}</pre>;
}

function ResultBody({ part }: { part: ToolPart }) {
  const text = s(part.output) || s(part.error) || JSON.stringify(part.args ?? {}, null, 2);
  return <pre style={monoBox}>{text}</pre>;
}

function renderBody(part: ToolPart) {
  const name = part.toolName.toLowerCase();
  if (name.includes('bash') || name.includes('terminal') || name.includes('shell')) return <TerminalView part={part} />;
  if (name.includes('search') || name.includes('web')) return <BrowserView part={part} />;
  if (name.includes('write_file') || name.includes('read_file') || name.includes('edit')) return <FileView part={part} />;
  if (name.includes('todo') || name.includes('plan')) return <TodoView part={part} />;
  return <ResultBody part={part} />;
}

export function ToolCard({ part }: { part: ToolPart }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const status = part.status ?? 'running';
  const success = part.success;

  const badge = status === 'running'
    ? { label: t('tool.running'), color: 'var(--vscode-terminal-ansiYellow, #d29922)' }
    : success
      ? { label: t('tool.success'), color: 'var(--vscode-terminal-ansiGreen, #3fb950)' }
      : { label: t('tool.error'), color: 'var(--vscode-terminal-ansiRed, #f85149)' };

  return (
    <div
      style={{
        background: 'var(--vscode-sideBar-background, #0d1117)',
        border: '1px solid var(--vscode-panel-border, #30363d)',
        borderRadius: 8,
        padding: 10,
        margin: '6px 0',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ fontSize: 16 }}>{getToolIcon(part.toolName)}</span>
        <span style={{ fontWeight: 600, color: 'var(--vscode-foreground, #e6e6e6)', flex: 1 }}>{part.toolName}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: badge.color,
            border: `1px solid ${badge.color}`,
            borderRadius: 999,
            padding: '1px 8px',
          }}
        >
          {badge.label}
        </span>
        <span style={{ color: 'var(--vscode-descriptionForeground, #8b949e)', fontSize: 12 }}>{open ? '▾' : '▸'}</span>
      </div>
      <div className={cn('tool-body', !open && 'tool-body--hidden')} style={{ marginTop: open ? 8 : 0, display: open ? 'block' : 'none' }}>
        {renderBody(part)}
      </div>
    </div>
  );
}
