import React from 'react';

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[omni] ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          backgroundColor: 'var(--vscode-editor-background, #0b0d12)',
          border: '1px solid var(--vscode-errorForeground, #ef4444)',
          padding: '24px',
          borderRadius: '8px',
          color: 'var(--vscode-foreground, #e6e6e6)',
          fontFamily: 'system-ui, sans-serif',
          margin: '16px',
        }}>
          <h2 style={{ color: 'var(--vscode-errorForeground, #ef4444)', margin: '0 0 12px 0' }}>
            Something went wrong
          </h2>
          <p style={{ margin: '0 0 16px 0' }}>{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--vscode-errorForeground, #ef4444)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
