import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  resetKey?: string; // Optional key to trigger error state reset
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  lastResetKey?: string;
}

export class GLTFErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      lastResetKey: props.resetKey
    };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Props) {
    // Reset error state if resetKey changes (e.g., model path changes or retry occurs)
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ 
        hasError: false,
        lastResetKey: this.props.resetKey
      });
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[GLTFErrorBoundary] GLTF loading error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
