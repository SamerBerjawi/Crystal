import React, { Component, ErrorInfo } from 'react';

interface State { hasError: boolean; message?: string }

/**
 * Last-resort boundary around the whole app: a throw in the sidebar, providers or modals used to unmount
 * everything to a blank page. This keeps a way out on screen.
 */
class RootErrorBoundary extends Component<{ children?: React.ReactNode }, State> {
  public state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error at the application root', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 480, width: '100%', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 16, padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, margin: '0 0 16px', opacity: 0.75 }}>
            {this.state.message || 'Crystal hit an unexpected error.'} Your saved data is safe on the server.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 16px', borderRadius: 8, border: 0, background: '#fa9a1d', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default RootErrorBoundary;
