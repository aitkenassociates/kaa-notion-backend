import React, { Component, ReactNode, ErrorInfo } from 'react';
import * as Sentry from '@sentry/react';
import logger from '../utils/logger';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details for debugging (always logged in production for monitoring)
    logger.criticalError('ErrorBoundary caught an error:', error, errorInfo);

    // Send error to Sentry for monitoring
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallbackTitle, fallbackMessage } = this.props;

    if (hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h2 className="error-title">
              {fallbackTitle || 'Something went wrong'}
            </h2>
            <p className="error-message">
              {fallbackMessage || 'An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.'}
            </p>
            
            {error && (
              <details className="error-details">
                <summary>Error Details</summary>
                <div className="error-stack">
                  <p><strong>Error:</strong> {error.toString()}</p>
                  {errorInfo && (
                    <pre className="error-component-stack">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
            
            <div className="error-actions">
              <button 
                onClick={this.handleReset}
                className="error-button error-button-primary"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="error-button error-button-secondary"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;

