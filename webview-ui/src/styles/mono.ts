import type { CSSProperties } from 'react';

/** Shared monospace pre block used in chat tool output and diffs. */
export const monoBoxStyle: CSSProperties = {
  fontFamily: 'var(--vscode-editor-font-family, ui-monospace, monospace)',
  fontSize: 12,
  background: '#010409',
  color: 'var(--vscode-foreground, #e6e6e6)',
  border: '1px solid var(--vscode-panel-border, #30363d)',
  borderRadius: 6,
  padding: 10,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 320,
  overflow: 'auto',
};
