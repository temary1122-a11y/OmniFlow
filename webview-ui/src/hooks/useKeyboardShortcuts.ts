/**
 * useKeyboardShortcuts (v3 canonical)
 * ---------------------------------------------------------------------------
 * Global webview keyboard shortcuts. Reads the store imperatively via
 * `useOmniStore.getState()` inside the handler to avoid stale closures.
 * The listener is cleaned up on unmount.
 */

import { useEffect } from 'react';
import { useOmniStore } from '@/store/omniStore';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  return target.isContentEditable;
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl combos always fire.
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        useOmniStore.getState().configureApi();
        return;
      }
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        const state = useOmniStore.getState();
        if (state.isRunning) {
          state.stopGeneration();
        } else if (!state.sessionId) {
          // Get the current value from the textarea if focused
          const textarea = document.querySelector('textarea');
          const goal = textarea?.value?.trim() || '';
          if (goal) {
            state.startNewSession(goal, 'chat');
            if (textarea) textarea.value = '';
          }
        }
        return;
      }

      // Single-key shortcuts are ignored while typing in a text field.
      if (mod || isTypingTarget(e.target)) return;

      if (e.key === 'c' || e.key === 'C') {
        useOmniStore.getState().setActiveTab('chat');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
