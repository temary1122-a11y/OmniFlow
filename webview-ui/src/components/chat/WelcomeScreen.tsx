import { useState } from 'react';
import { cn } from '@/utils/cn';
import { AGENT_META } from '@/utils/agentConfig';

const QUICK_PROMPTS = ['Создать REST API', 'Написать тесты', 'Рефакторинг модуля'];

export function WelcomeScreen({ onStart }: { onStart: (goal: string, mode: 'chat' | 'code' | 'ask') => void }) {
  const [value, setValue] = useState('');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 'var(--font-size-4xl, 30px)', margin: 0, color: 'var(--color-text-primary, #e6e6e6)', fontWeight: 'var(--font-weight-bold, 700)' }}>
        Omni — AI Оркестратор
      </h1>
      <p style={{ color: 'var(--color-text-secondary, #8b949e)', marginTop: 8, maxWidth: 460, fontSize: 'var(--font-size-base, 14px)', lineHeight: 'var(--line-height-normal, 1.6)' }}>
        Мульти-агентная система для планирования, сборки и верификации кода. Выберите агента и сформулируйте задачу.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '20px 0' }}>
        {Object.entries(AGENT_META).map(([role, meta]) => (
          <button
            key={role}
            type="button"
            onClick={() => {
              setValue(`Act as the ${meta.label} agent and help me with my task.`);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--font-size-sm, 12px)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full, 9999px)',
              background: 'var(--color-bg-secondary, #0d1117)',
              border: '1px solid var(--color-border, #30363d)',
              color: 'var(--color-text-primary, #e6e6e6)',
              cursor: 'pointer',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color }} />
            {meta.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setValue(q)}
            style={{
              fontSize: 'var(--font-size-base, 13px)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-md, 8px)',
              cursor: 'pointer',
              background: 'var(--color-bg-secondary, #0d1117)',
              border: '1px solid var(--color-border, #30363d)',
              color: 'var(--color-text-primary, #e6e6e6)',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Опишите задачу…"
        rows={3}
        style={{
          width: '100%',
          maxWidth: 520,
          resize: 'vertical',
          padding: 10,
          borderRadius: 'var(--radius-md, 8px)',
          fontSize: 'var(--font-size-base, 14px)',
          background: 'var(--color-bg-secondary, #0d1117)',
          border: '1px solid var(--color-border, #30363d)',
          color: 'var(--color-text-primary, #e6e6e6)',
          outline: 'none',
        }}
      />

      <button
        type="button"
        disabled={!value.trim()}
        onClick={() => value.trim() && onStart(value.trim(), 'chat')}
        className={cn('omni-run-btn')}
        style={{
          marginTop: 12,
          padding: '8px 24px',
          borderRadius: 'var(--radius-md, 8px)',
          fontSize: 'var(--font-size-base, 14px)',
          fontWeight: 'var(--font-weight-semibold, 600)',
          cursor: value.trim() ? 'pointer' : 'not-allowed',
          opacity: value.trim() ? 1 : 0.5,
          background: 'var(--color-primary, #7c6af7)',
          border: 'none',
          color: '#fff',
        }}
      >
        Запустить
      </button>
    </div>
  );
}
