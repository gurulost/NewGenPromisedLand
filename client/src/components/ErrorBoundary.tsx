import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white p-8">
          <div className="max-w-lg text-center space-y-4">
            <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
            <p className="text-slate-300">
              The game encountered an error. Please try refreshing the page.
            </p>
            <pre className="text-left text-sm bg-slate-800 p-4 rounded overflow-auto max-h-48 text-red-300">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-amber-500 text-slate-900 rounded hover:bg-amber-400 transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
