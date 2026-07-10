import { useEffect } from 'react';
import { onBackendEvent } from '@/lib/vscode';
import { useOmniStore } from '@/store/omniStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ThreePaneLayout } from '@/components/layout/ThreePaneLayout';

export default function App() {
  useKeyboardShortcuts();

  useEffect(() => {
    const off = onBackendEvent((e) => useOmniStore.getState().handleBackendEvent(e));
    return off;
  }, []);

  return (
    <div className="omni-app" style={{ height: '100%' }}>
      <ThreePaneLayout />
    </div>
  );
}
