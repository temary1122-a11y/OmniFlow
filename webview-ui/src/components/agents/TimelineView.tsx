import { Check } from 'lucide-react';
import { useOmniStore } from '@/store/omniStore';
import { PHASE_COLORS, PHASE_LABELS } from '@/utils/agentConfig';
import type { Phase } from '@/types';
import { useTranslation } from '@/i18n';

/**
 * TimelineView
 * ---------------------------------------------------------------------------
 * Vertical phase stepper over the canonical orchestration lifecycle. A phase is
 * "done" if in completedPhases, "active" if it equals currentPhase, otherwise
 * "upcoming". When no session is active everything renders neutral.
 */

const ORDER: Phase[] = [
  'intake',
  'research',
  'planning',
  'build',
  'audit',
  'security',
  'verify',
  'deliver',
];

export function TimelineView() {
  const { t } = useTranslation();
  const currentPhase = useOmniStore((s) => s.currentPhase);
  const completedPhases = useOmniStore((s) => s.completedPhases);
  const sessionId = useOmniStore((s) => s.sessionId);
  const setActiveTab = useOmniStore((s) => s.setActiveTab);
  const scrollToPhase = useOmniStore((s) => s.scrollToPhase);

  const hasSession = Boolean(sessionId);

  return (
    <div style={{ padding: 12 }}>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: 7,
            top: 8,
            bottom: 8,
            width: 1,
            background: 'var(--vscode-panel-border, #30363d)',
          }}
        />
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ORDER.map((p) => {
            const meta = PHASE_LABELS[p];
            const color = PHASE_COLORS[p];
            const isDone = hasSession && completedPhases.includes(p);
            const isActive = hasSession && currentPhase === p;
            const neutral = !hasSession || (!isDone && !isActive);

            return (
              <li key={p} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, zIndex: 1 }}>
                <button
                  type="button"
                  onClick={() => { setActiveTab('chat'); scrollToPhase(p); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab('chat'); scrollToPhase(p); } }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: 'inherit',
                    borderRadius: 6,
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  aria-label={t('timeline.jumpToPhase', { meta })}
                >
                  <span
                    style={{
                      position: 'relative',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      borderRadius: 9999,
                      border: `2px solid ${neutral ? 'rgba(255,255,255,0.18)' : color}`,
                      background: isDone ? color : isActive ? `${color}33` : 'transparent',
                      transition: 'all 200ms ease',
                    }}
                  >
                    {isDone && <Check size={9} style={{ color: 'var(--vscode-foreground, #e6e6e6)' }} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: neutral
                          ? 'var(--vscode-descriptionForeground, #8b949e)'
                          : 'var(--vscode-foreground, #e6e6e6)',
                      }}
                    >
                      {meta}
                    </div>
                    {isActive && (
                      <div style={{ fontSize: 10.5, color }}>{t('timeline.inProgress')}</div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
