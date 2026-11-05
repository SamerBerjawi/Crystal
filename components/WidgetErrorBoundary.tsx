import React, { Component, ErrorInfo, ReactNode } from 'react';
import Icon from './ui/Icon';
import { Button } from './ui/Actions';

interface WidgetErrorBoundaryProps {
  children: ReactNode;
  widgetTitle?: string;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  public state: WidgetErrorBoundaryState = {
    hasError: false,
    error: undefined,
  };

  public static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Widget error in "${this.props.widgetTitle || 'Widget'}":`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="surface-card flex min-h-[160px] flex-col items-center justify-center gap-2 p-5 text-center">
          <span className="flex size-10 items-center justify-center rounded-[var(--radius-md)] bg-money-out-soft text-money-out">
            <Icon name="warning" size={20} />
          </span>
          <h4 className="type-body-strong text-ink">This widget didn't load: {this.props.widgetTitle || 'widget'}</h4>
          <p className="type-caption max-w-xs text-muted">{this.state.error?.message || 'Something went wrong while drawing it.'}</p>
          <Button variant="secondary" size="sm" onClick={() => this.setState({ hasError: false, error: undefined })}>Try again</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
