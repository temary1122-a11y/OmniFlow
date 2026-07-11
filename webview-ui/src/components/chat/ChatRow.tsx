import { memo, useState } from 'react';
import type { ReactNode } from 'react';
import { Users, ArrowRight, FileCode2, Check, Copy } from 'lucide-react';
import type { AgentRole, Message, MessagePart } from '@/types';
import { PHASE_LABELS, getAgentMeta } from '@/utils/agentConfig';
import { cn } from '@/utils/cn';
import { Markdown, CodeBlock } from '@/lib/markdown';
import { monoBoxStyle } from '@/styles/mono';
import { useOmniStore } from '@/store/omniStore';
import { useTranslation } from '@/i18n';
import { ReasoningBlock } from './ReasoningBlock';
import { CommentaryBlock } from './CommentaryBlock';
import { ToolCard } from '@/components/tools/ToolCard';
import { ClarifyingQuestions } from './ClarifyingQuestions';
import { ApprovalCard } from './ApprovalCard';
import { DeliveryCard } from './DeliveryCard';
import { OmniLogo } from '@/components/common/OmniLogo';

function AgentConsult({ part }: { part: Extract<MessagePart, { type: 'agent_consult' }> }) {
  const toMeta = getAgentMeta(part.to);
  return (
    <div
      className="omni-fade-up"
      style={{
        border: '1px solid rgba(245, 158, 11, 0.2)',
        background: 'rgba(245, 158, 11, 0.06)',
        borderRadius: 8,
        padding: 10,
        margin: '6px 0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--vscode-descriptionForeground, #8b949e)', marginBottom: 6 }}>
        <Users size={12} />
        <span style={{ color: 'var(--vscode-foreground, #e6e6e6)' }}>{part.from}</span>
        <ArrowRight size={11} />
        <span style={{ color: toMeta.color, fontWeight: 600 }}>{toMeta.label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, fontStyle: "italic", color: 'var(--vscode-foreground, #e6e6e6)' }}>
        &ldquo;{part.question}&rdquo;
      </p>
      {part.answer && (
        <p
          style={{
            margin: '6px 0 0',
            paddingLeft: 8,
            borderLeft: `2px solid ${toMeta.color}`,
            fontSize: 12.5,
            color: 'var(--vscode-descriptionForeground, #8b949e)',
          }}
        >
          {part.answer}
        </p>
      )}
    </div>
  );
}

function DiffBlock({ filePath, diff }: { filePath: string; diff: string }) {
  const openArtifact = useOmniStore((s) => s.openArtifact);
  return (
    <div style={{ border: '1px solid var(--vscode-panel-border, #30363d)', borderRadius: 8, overflow: 'hidden', margin: '6px 0' }}>
      <button
        type="button"
        onClick={() => openArtifact(filePath)}
        style={{
          display: 'block',
          width: '100%',
          padding: '4px 10px',
          borderBottom: '1px solid var(--vscode-panel-border, #30363d)',
          background: 'rgba(255,255,255,0.03)',
          fontSize: 11,
          color: 'var(--vscode-textLink-foreground, #7c6af7)',
          fontFamily: 'var(--vscode-editor-font-family, ui-monospace, monospace)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {filePath}
      </button>
      <pre style={{ ...monoBoxStyle, margin: 0, border: 'none', borderRadius: 0 }}>
        {diff.split('\n').map((line, i) => {
          const color = line.startsWith('+') && !line.startsWith('+++')
            ? 'var(--vscode-terminal-ansiGreen, #3fb950)'
            : line.startsWith('-') && !line.startsWith('---')
              ? 'var(--vscode-terminal-ansiRed, #f85149)'
              : line.startsWith('@@')
                ? 'var(--vscode-terminal-ansiBlue, #58a6ff)'
                : 'var(--vscode-descriptionForeground, #8b949e)';
          return (
            <div key={i} style={{ color }}>
              {line || ' '}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

function renderPart(part: MessagePart, key: number): ReactNode {
  switch (part.type) {
    case 'text':
      return (
        <div key={key} style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          <Markdown content={part.content} />
        </div>
      );
    case 'reasoning':
      return <ReasoningBlock key={key} content={part.content} agentId={part.agentId} phase={part.phase} stream />;
    case 'tool_call':
      return <ToolCard key={key} part={part} />;
    case 'code':
      return <CodeBlock key={key} code={part.code} language={part.language} showCopy />;
    case 'file_diff':
      return <DiffBlock key={key} filePath={part.filePath} diff={part.diff} />;
    case 'agent_consult':
      return <AgentConsult key={key} part={part} />;
    case 'commentary': {
      return (
        <CommentaryBlock
          key={key}
          agentId={part.agentId}
          phase={part.phase}
          message={part.message}
          highlight={/building|creating|research|plan|verify|deliver|failed|error/i.test(part.message)}
        />
      );
    }
    case 'phase':
      return (
        <div key={key} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
          <span
            style={{
              fontSize: 11,
              padding: '2px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--vscode-panel-border, #30363d)',
              color: 'var(--vscode-descriptionForeground, #8b949e)',
            }}
          >
            {PHASE_LABELS[part.from]} → {PHASE_LABELS[part.to]}
          </span>
        </div>
      );
    case 'artifact':
      return <ArtifactChip key={key} filePath={part.filePath} />;
    case 'delivery':
      return <DeliveryCard key={key} report={part.report} />;
    case 'approval_required':
      return <ApprovalInline key={key} part={part} />;
    case 'clarifying_questions':
      return <ClarifyingQuestions key={key} questions={part.questions} onSubmit={(a) => useOmniStore.getState().submitAnswers(a)} />;
    default:
      return null;
  }
}

function ArtifactChip({ filePath }: { filePath: string }) {
  const openArtifact = useOmniStore((s) => s.openArtifact);
  return (
    <button
      type="button"
      onClick={() => openArtifact(filePath)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
        padding: '5px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: 'var(--vscode-editor-font-family, ui-monospace, monospace)',
        background: 'rgba(63, 185, 80, 0.1)',
        border: '1px solid rgba(63, 185, 80, 0.3)',
        color: 'var(--vscode-terminal-ansiGreen, #3fb950)',
      }}
    >
      <FileCode2 size={13} />
      {filePath}
    </button>
  );
}

function ApprovalInline({ part }: { part: Extract<MessagePart, { type: 'approval_required' }> }) {
  const submitApproval = useOmniStore((s) => s.submitApproval);
  return (
    <ApprovalCard
      approval={{
        requestId: part.requestId,
        title: part.title,
        tier: part.tier,
        architecture: part.architecture ?? '',
        stack: part.stack ?? [],
        acceptanceCriteria: part.acceptanceCriteria,
        files: part.files,
        summary: part.summary,
      }}
      onApprove={(fb) => submitApproval(part.requestId, true, fb)}
      onReject={(fb) => submitApproval(part.requestId, false, fb)}
    />
  );
}

function HeaderMeta({ message }: { message: Message }) {
  const { t } = useTranslation();
  if (message.role === 'user') {
    return { icon: '👤', label: t('chat.you'), color: 'var(--vscode-textLink-foreground, #7c6af7)' };
  }
  if (message.role === 'system') {
    return { icon: '⚙', label: t('chat.system'), color: 'var(--vscode-descriptionForeground, #8b949e)' };
  }
  const key: AgentRole = message.agentId ?? 'orchestrator';
  const meta = getAgentMeta(key);
  return { icon: meta.icon, label: meta.label, color: meta.color, isOmni: meta.isOmni ?? false };
}

function ChatRowBase({ message }: { message: Message }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const meta = HeaderMeta({ message });
  const showOmniLogo = meta.isOmni;
  const timeStr = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.role === 'user') {
    return (
      <div className="omni-fade-up" style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px' }}>
        <div
          style={{
            maxWidth: '85%',
            padding: '8px 12px',
            borderRadius: 12,
            borderTopRightRadius: 4,
            background: 'rgba(124, 106, 247, 0.15)',
            border: '1px solid rgba(124, 106, 247, 0.3)',
            color: 'var(--vscode-foreground, #e6e6e6)',
            fontSize: 13.5,
            lineHeight: 1.6,
            wordBreak: 'break-word',
          }}
        >
          {message.parts.map((p, i) => (p.type === 'text' ? <span key={i}>{p.content}</span> : renderPart(p, i)))}
        </div>
      </div>
    );
  }

  if (message.role === 'system') {
    return (
      <div
        className="omni-system-pill"
        style={{
          textAlign: 'center',
          padding: '6px 16px',
          margin: '4px 12px',
          fontSize: 11,
          color: 'var(--color-text-secondary, #8b949e)',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
          borderRadius: 999,
        }}
      >
        {message.parts.map((p, i) => (p.type === 'text' ? <span key={i}>{p.content}</span> : null))}
      </div>
    );
  }

  const copy = () => {
    const text = message.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as Extract<MessagePart, { type: 'text' }>).content)
      .join('\n');
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <div className={cn('omni-fade-up group')} style={{ position: 'relative', padding: '6px 12px', display: 'flex', gap: 8 }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          flexShrink: 0,
          marginTop: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          background: `${meta.color}26`,
          border: `1px solid ${meta.color}55`,
          color: meta.color,
        }}
      >
        {showOmniLogo ? <OmniLogo size={14} color={meta.color} /> : meta.icon}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{meta.label}</span>
          <span style={{ fontSize: 10, color: 'var(--vscode-descriptionForeground, #8b949e)' }}>{timeStr}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {message.parts.map((p, i) => renderPart(p, i))}
        </div>
      </div>

      <button
        type="button"
        onClick={copy}
          aria-label={t('chat.copyMessage')}
        style={{
          position: 'absolute',
          top: 4,
          right: 8,
          width: 24,
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          background: 'transparent',
          color: 'var(--vscode-descriptionForeground, #8b949e)',
          opacity: 0,
        }}
        className="group-hover:opacity-100"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

export const ChatRow = memo(ChatRowBase);
