import React, { Component, type ErrorInfo, useState } from 'react';
import { Button, Card } from './ui';
import { NvIcon } from './NvIcon';

/*
 * Errors in the New UI (UI_UX_DESIGN_REFERENCE.md D15): a message only, never a stack, on one line, with web
 * addresses reduced to their host and file paths dropped, plus Copy details for a bug report.
 */

/** A short, safe one-line message for an error. */
export const describeError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong';
  const text = raw
    .split('\n')[0]
    .replace(/https?:\/\/([^/\s]+)\S*/g, '$1')
    .replace(/(?:\/[\w.-]+){2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(?:at|in|from|of)$/i, '');
  return (text || 'Something went wrong').slice(0, 300);
};

export const ErrorPanel: React.FC<{ error: unknown; onRetry?: () => void; onHome?: () => void }> = ({ error, onRetry, onHome }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const details = [describeError(error), error instanceof Error ? error.stack : '', `URL: ${window.location.pathname}`, `When: ${new Date().toISOString()}`]
      .filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(details); setCopied(true); } catch { setCopied(false); }
  };
  return (
    <Card className="mx-auto mt-2 max-w-2xl" role="alert">
      <div className="flex flex-col items-center px-4 py-8 text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-nv-red-soft text-nv-red-text"><NvIcon name="alert" size={26} /></span>
        <h2 className="text-lg font-medium text-nv-ink">This page ran into a problem</h2>
        <p className="mt-1 max-w-md text-sm text-nv-muted">{describeError(error)}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {onRetry && <Button variant="primary" icon="refresh" onClick={onRetry}>Try again</Button>}
          {onHome && <Button variant="secondary" icon="home" onClick={onHome}>Go to dashboard</Button>}
          <Button variant="ghost" icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? 'Copied' : 'Copy details'}</Button>
        </div>
      </div>
    </Card>
  );
};

interface BoundaryProps { resetKey: string; onHome?: () => void; children: React.ReactNode }
interface BoundaryState { error: unknown; key: string }

/** Error boundary for New pages. Recovers when `resetKey` changes (navigation). */
export class ErrorBoundaryNew extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: BoundaryProps, state: BoundaryState): Partial<BoundaryState> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('New page error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorPanel error={this.state.error} onRetry={() => this.setState({ error: null })} onHome={this.props.onHome} />;
    }
    return this.props.children;
  }
}
