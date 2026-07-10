import { RefreshCw, Folder, File as FileIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useOmniStore } from '@/store/omniStore';
import type { WorkspaceFile } from '@/types';

/**
 * FilesPanel
 * ---------------------------------------------------------------------------
 * Files tab. Lists generated artifacts (clickable → openArtifact) and the
 * workspace tree (clickable files → openArtifact), with a Refresh button that
 * requests a fresh tree from the backend via the store.
 */

const ACCENT = 'var(--vscode-textLink-foreground, #7c6af7)';
const BORDER = 'var(--vscode-panel-border, #30363d)';
const FG = 'var(--vscode-foreground, #e6e6e6)';
const DESC = 'var(--vscode-descriptionForeground, #8b949e)';

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: `1px solid ${BORDER}`,
  flexShrink: 0,
};

const sectionLabelStyle: CSSProperties = {
  padding: '8px 14px 4px',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: DESC,
};

function WorkspaceRow({ node, depth }: { node: WorkspaceFile; depth: number }) {
  const openArtifact = useOmniStore((s) => s.openArtifact);
  const isDir = node.type === 'directory';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!isDir) openArtifact(node.path);
        }}
        title={node.path}
        aria-label={node.name}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          textAlign: 'left',
          padding: '5px 14px',
          paddingLeft: 14 + depth * 16,
          fontSize: 12.5,
          cursor: isDir ? 'default' : 'pointer',
          color: FG,
          background: 'transparent',
          border: 'none',
        }}
      >
        {isDir ? (
          <Folder size={14} style={{ color: DESC, flexShrink: 0 }} />
        ) : (
          <FileIcon size={14} style={{ color: DESC, flexShrink: 0 }} />
        )}
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: isDir ? DESC : FG,
          }}
        >
          {node.name}
        </span>
      </button>
      {isDir &&
        node.children?.map((child) => (
          <WorkspaceRow key={child.path} node={child} depth={depth + 1} />
        ))}
    </>
  );
}

export function FilesPanel() {
  const artifacts = useOmniStore((s) => s.artifacts);
  const workspaceRoot = useOmniStore((s) => s.workspaceRoot);
  const workspaceTree = useOmniStore((s) => s.workspaceTree);
  const requestWorkspace = useOmniStore((s) => s.requestWorkspace);
  const openArtifact = useOmniStore((s) => s.openArtifact);
  const sessionId = useOmniStore((s) => s.sessionId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        color: FG,
      }}
    >
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.3, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Folder size={16} style={{ color: ACCENT }} />
          Files
        </span>
        <button
          type="button"
          onClick={() => requestWorkspace()}
          title={sessionId ? 'Refresh workspace' : 'Start a session to load the workspace'}
          aria-label="Refresh workspace"
          disabled={!sessionId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            fontSize: 12,
            borderRadius: 8,
            cursor: sessionId ? 'pointer' : 'not-allowed',
            opacity: sessionId ? 1 : 0.5,
            color: ACCENT,
            background: `${ACCENT}14`,
            border: `1px solid ${ACCENT}55`,
          }}
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {workspaceRoot && (
          <div style={{ padding: '6px 14px', fontSize: 11, color: DESC }}>
            Root: <span style={{ color: FG }}>{workspaceRoot}</span>
          </div>
        )}

        <div style={sectionLabelStyle}>Generated artifacts</div>
        {artifacts.length === 0 ? (
          <p style={{ margin: 0, padding: '0 14px', fontSize: 11, color: DESC }}>
            No artifacts generated yet.
          </p>
        ) : (
          artifacts.map((filePath) => (
            <button
              key={filePath}
              type="button"
              onClick={() => openArtifact(filePath)}
              title={filePath}
              aria-label={filePath}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '6px 14px',
                fontSize: 12.5,
                cursor: 'pointer',
                color: FG,
                background: 'transparent',
                border: 'none',
              }}
            >
              <FileIcon size={14} style={{ color: ACCENT, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {filePath}
              </span>
            </button>
          ))
        )}

        <div style={sectionLabelStyle}>Workspace</div>
        {workspaceTree.length === 0 ? (
          <p style={{ margin: 0, padding: '0 14px', fontSize: 11, color: DESC }}>
            {sessionId
              ? 'Workspace tree not loaded. Press Refresh.'
              : 'Start a session, then press Refresh to load the workspace tree.'}
          </p>
        ) : (
          workspaceTree.map((node) => <WorkspaceRow key={node.path} node={node} depth={0} />)
        )}
      </div>
    </div>
  );
}
