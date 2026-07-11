import { useState, useRef, useEffect } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Play, Pause, Square, X } from 'lucide-react';
import { useOmniStore } from '@/store/omniStore';
import { useTranslation } from '@/i18n';

export function PromptInput() {
  const { t } = useTranslation();
  const sessionId = useOmniStore((s) => s.sessionId);
  const goal = useOmniStore((s) => s.goal);
  const isRunning = useOmniStore((s) => s.isRunning);
  const isStreaming = useOmniStore((s) => s.isStreaming);
  const startNewSession = useOmniStore((s) => s.startNewSession);
  const continueChat = useOmniStore((s) => s.continueChat);
  const togglePause = useOmniStore((s) => s.togglePause);
  const stopGeneration = useOmniStore((s) => s.stopGeneration);
  const clearMessages = useOmniStore((s) => s.clearMessages);

  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasSession = Boolean(sessionId);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setValue('');
    if (hasSession) {
      continueChat(trimmed);
    } else {
      startNewSession(trimmed, 'chat');
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // ─── No session: composer that starts a new session ─────────────
  if (!hasSession) {
    const canRun = Boolean(value.trim());
    return (
      <div style={{ padding: 'var(--space-3, 12px)', borderTop: '1px solid var(--color-border, #30363d)', background: 'var(--color-bg-tertiary, rgba(255,255,255,0.02))', flexShrink: 0, overflow: 'visible' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'flex-end', overflow: 'visible' }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={goal ? t('chat.refineTask') : t('chat.describeBuild')}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              fontSize: 'var(--font-size-base, 14px)',
              lineHeight: 'var(--line-height-normal, 1.5)',
              fontFamily: 'inherit',
              background: 'var(--color-bg-secondary, #0d1117)',
              border: '1px solid var(--color-border, #30363d)',
              color: 'var(--color-text-primary, #e6e6e6)',
              outline: 'none',
              transition: 'border-color 150ms ease',
              overflow: 'auto',
            }}
          />
          <button
            type="button"
            disabled={!canRun}
            onClick={submit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md, 8px)',
              fontSize: 'var(--font-size-base, 14px)',
              fontWeight: 'var(--font-weight-semibold, 600)',
              cursor: canRun ? 'pointer' : 'not-allowed',
              opacity: canRun ? 1 : 0.5,
              background: 'var(--color-primary, #7c6af7)',
              border: 'none',
              color: '#fff',
              flexShrink: 0,
              transition: 'opacity 150ms ease',
              zIndex: 10,
            }}
          >
            <Play size={14} /> {t('welcome.run')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Active session: running controls ────────────────────────────
  const busy = isRunning || isStreaming;

  if (hasSession && !busy) {
    const canRun = Boolean(value.trim());
    return (
      <div style={{ padding: 'var(--space-3, 12px)', borderTop: '1px solid var(--color-border, #30363d)', background: 'var(--color-bg-tertiary, rgba(255,255,255,0.02))', flexShrink: 0, overflow: 'visible' }}>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'flex-end', overflow: 'visible' }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={t('chat.describeBuild')}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              fontSize: 'var(--font-size-base, 14px)',
              lineHeight: 'var(--line-height-normal, 1.5)',
              fontFamily: 'inherit',
              background: 'var(--color-bg-secondary, #0d1117)',
              border: '1px solid var(--color-border, #30363d)',
              color: 'var(--color-text-primary, #e6e6e6)',
              outline: 'none',
              transition: 'border-color 150ms ease',
              overflow: 'auto',
            }}
          />
          <button
            type="button"
            disabled={!canRun}
            onClick={submit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 'var(--radius-md, 8px)',
              fontSize: 'var(--font-size-base, 14px)',
              fontWeight: 'var(--font-weight-semibold, 600)',
              cursor: canRun ? 'pointer' : 'not-allowed',
              opacity: canRun ? 1 : 0.5,
              background: 'var(--color-primary, #7c6af7)',
              border: 'none',
              color: '#fff',
              flexShrink: 0,
              transition: 'opacity 150ms ease',
              zIndex: 10,
            }}
          >
            <Play size={14} /> {t('welcome.run')}
          </button>
        </div>
      </div>
    );
  }

  if (hasSession && busy) {
    return (
      <div style={{ padding: 'var(--space-3, 12px)', borderTop: '1px solid var(--color-border, #30363d)', background: 'var(--color-bg-tertiary, rgba(255,255,255,0.02))', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2, 8px)',
            padding: '8px 10px',
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--color-bg-secondary, #0d1117)',
            border: '1px solid var(--color-border, #30363d)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--font-size-sm, 12.5px)',
              fontWeight: 'var(--font-weight-semibold, 600)',
              color: busy ? 'var(--color-warning, #d29922)' : 'var(--color-text-secondary, #8b949e)',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: busy ? 'var(--color-warning, #d29922)' : 'var(--color-text-secondary, #8b949e)',
                animation: busy ? 'omni-blink 1s steps(1) infinite' : 'none',
              }}
            />
            {busy ? t('chat.running') : t('chat.idle')}
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={togglePause}
              disabled={!busy}
              title={t('toolbar.pause')}
              aria-label={t('toolbar.pause')}
              style={controlBtn(busy, 'var(--color-warning, #d29922)')}
            >
              <Pause size={14} />
            </button>
            <button
              type="button"
              onClick={stopGeneration}
              disabled={!busy}
              title={t('toolbar.stop')}
              aria-label={t('toolbar.stop')}
              style={controlBtn(busy, 'var(--color-error, #f85149)')}
            >
              <Square size={13} style={{ fill: 'currentColor' }} />
            </button>
            <button
              type="button"
              onClick={clearMessages}
              title={t('chat.clear')}
              aria-label={t('chat.clear')}
              style={controlBtn(true, 'var(--color-text-secondary, #8b949e)')}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <input
          type="text"
          disabled
          placeholder={t('chat.generationInProgress')}
          style={{
            width: '100%',
            marginTop: 'var(--space-2, 8px)',
            padding: 9,
            borderRadius: 'var(--radius-md, 8px)',
            fontSize: 'var(--font-size-base, 13px)',
            background: 'var(--color-bg-secondary, #0d1117)',
            border: '1px solid var(--color-border, #30363d)',
            color: 'var(--color-text-secondary, #8b949e)',
            outline: 'none',
            opacity: 0.6,
            cursor: 'not-allowed',
          }}
        />
      </div>
    );
  }
}

function controlBtn(enabled: boolean, color: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 6,
    cursor: enabled ? 'pointer' : 'not-allowed',
    opacity: enabled ? 1 : 0.4,
    background: 'transparent',
    border: `1px solid ${color}55`,
    color,
  };
}
