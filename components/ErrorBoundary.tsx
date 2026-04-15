"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <p className="error-boundary-message">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={this.reset}
              className="error-boundary-reset"
            >
              Try again
            </button>
          </div>
          <style jsx>{`
            .error-boundary-fallback {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 200px;
              padding: 20px;
              background: var(--bg-subtle, #f9fafb);
              border-radius: 8px;
              border: 1px solid var(--border-subtle, #e5e7eb);
            }
            .error-boundary-content {
              text-align: center;
              max-width: 400px;
            }
            .error-boundary-content h2 {
              font-size: 18px;
              font-weight: 600;
              color: var(--text-primary, #111827);
              margin: 0 0 8px 0;
            }
            .error-boundary-message {
              font-size: 14px;
              color: var(--text-secondary, #6b7280);
              margin: 0 0 16px 0;
            }
            .error-boundary-reset {
              background: var(--primary, #3b82f6);
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: background 0.2s;
            }
            .error-boundary-reset:hover {
              background: var(--primary-hover, #2563eb);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
