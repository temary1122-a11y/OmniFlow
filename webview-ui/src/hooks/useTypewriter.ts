import { useEffect, useState } from 'react';

/** Reveal text incrementally for streaming-style reasoning display. */
export function useTypewriter(text: string, enabled: boolean, charsPerTick = 3, intervalMs = 16): string {
  const [len, setLen] = useState(enabled ? 0 : text.length);

  useEffect(() => {
    if (!enabled) {
      setLen(text.length);
      return;
    }
    setLen(0);
  }, [text, enabled]);

  useEffect(() => {
    if (!enabled || len >= text.length) return;
    const t = window.setInterval(() => {
      setLen((n) => Math.min(text.length, n + charsPerTick));
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [enabled, len, text.length, charsPerTick, intervalMs]);

  return text.slice(0, len);
}
