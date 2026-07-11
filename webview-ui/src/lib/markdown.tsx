/**
 * Lightweight Markdown Renderer (v3 canonical, dependency-free)
 * ---------------------------------------------------------------------------
 * A zero-dependency formatter for the subset of markdown an agent emits:
 * fenced code blocks, headings, unordered lists, inline `code`, and **bold**.
 * No react-markdown / marked / remark — just React elements, so nothing is
 * injected as raw HTML.
 */

import { Fragment, useState, type ReactNode } from 'react';
import type { CSSProperties } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from '@/i18n';

const CODE_BG = 'var(--vscode-editor-background, #010409)';
const FG = 'var(--vscode-foreground, #e6e6e6)';
const DESC = 'var(--vscode-descriptionForeground, #8b949e)';
const ACCENT = 'var(--vscode-textLink-foreground, #7c6af7)';

/** Render inline markdown (bold, inline-code) into React nodes. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(
        <strong key={`${keyBase}-b-${i}`} style={{ fontWeight: 600, color: FG }}>
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={`${keyBase}-c-${i}`}
          style={{
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            fontSize: 12.5,
            background: 'rgba(255,255,255,0.08)',
            color: ACCENT,
            padding: '1px 5px',
            borderRadius: 4,
          }}
        >
          {m[3]}
        </code>,
      );
    }
    last = regex.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Canonical fenced code block (markdown + chat message parts). */
export function CodeBlock({
  code,
  language,
  showCopy = false,
}: {
  code: string;
  language: string;
  showCopy?: boolean;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div
      style={{
        margin: '8px 0',
        borderRadius: 8,
        border: '1px solid var(--vscode-panel-border, #30363d)',
        background: CODE_BG,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--vscode-panel-border, #30363d)',
          padding: '4px 12px',
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
          fontSize: 10,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: DESC,
        }}
      >
        <span>{language || 'text'}</span>
        {showCopy && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={t('markdown.copyCode')}
            title={t('markdown.copyCode')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: DESC,
              padding: 2,
              display: 'inline-flex',
              alignItems: 'center',
              opacity: 0.7,
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          overflowX: 'auto',
          fontFamily: 'var(--vscode-editor-font-family, monospace)',
          fontSize: 12.5,
          lineHeight: 1.6,
          color: 'var(--vscode-editor-foreground, #cdd6e4)',
        }}
      >
        <code>{code.replace(/\n$/, '')}</code>
      </pre>
    </div>
  );
}

/** Top-level markdown → React. Splits on fenced blocks, then renders lines. */
export function Markdown({ content }: { content: string }) {
  if (!content) return null;

  const blocks: ReactNode[] = [];
  const segments = content.split('```');

  segments.forEach((seg, si) => {
    // Odd indices are fenced code blocks.
    if (si % 2 === 1) {
      const nl = seg.indexOf('\n');
      const language = nl === -1 ? '' : seg.slice(0, nl).trim();
      const code = nl === -1 ? seg : seg.slice(nl + 1);
      blocks.push(<CodeBlock key={`cb-${si}`} code={code} language={language} />);
      return;
    }

    const lines = seg.split('\n');
    let list: ReactNode[] = [];

    const flushList = (key: string) => {
      if (list.length) {
        blocks.push(
          <ul
            key={key}
            style={{
              margin: '6px 0',
              paddingLeft: 18,
              listStyle: 'disc',
              color: FG,
            }}
          >
            {list}
          </ul>,
        );
        list = [];
      }
    };

    lines.forEach((line, li) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList(`ul-${si}-${li}`);
        return;
      }

      if (/^#{1,3}\s/.test(trimmed)) {
        flushList(`ul-${si}-${li}`);
        const level = trimmed.match(/^#+/)![0].length;
        const text = trimmed.replace(/^#+\s/, '');
        const headingStyle: CSSProperties = {
          margin: level === 1 ? '12px 0 4px' : '8px 0 2px',
          fontWeight: 600,
          color: FG,
          fontSize: level === 1 ? 15 : 13.5,
        };
        blocks.push(
          <p key={`h-${si}-${li}`} style={headingStyle}>
            {renderInline(text, `h-${si}-${li}`)}
          </p>,
        );
      } else if (/^[-*]\s/.test(trimmed)) {
        const text = trimmed.replace(/^[-*]\s/, '');
        list.push(
          <li key={`li-${si}-${li}`} style={{ margin: '2px 0', fontSize: 13.5 }}>
            {renderInline(text, `li-${si}-${li}`)}
          </li>,
        );
      } else {
        flushList(`ul-${si}-${li}`);
        blocks.push(
          <p
            key={`p-${si}-${li}`}
            style={{ margin: '4px 0', fontSize: 13.5, lineHeight: 1.6, color: FG }}
          >
            {renderInline(trimmed, `p-${si}-${li}`)}
          </p>,
        );
      }
    });

    flushList(`ul-${si}-end`);
  });

  return <div style={{ color: FG }}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
