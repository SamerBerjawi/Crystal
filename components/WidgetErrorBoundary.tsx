import React, { Component, ErrorInfo, ReactNode } from 'react';

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
        <div className="p-5 rounded-2xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 text-center flex flex-col items-center justify-center min-h-[160px] gap-2">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <span className="material-symbols-outlined text-xl">warning</span>
          </div>
          <h4 className="text-xs font-bold text-light-text dark:text-dark-text">
            Unable to load {this.props.widgetTitle || 'widget'}
          </h4>
          <p className="text-[11px] text-light-text-secondary/70 dark:text-dark-text-secondary/60 max-w-xs">
            {this.state.error?.message || 'An error occurred while rendering this component.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-2 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
          >
            Retry Widget
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WidgetErrorBoundary;
