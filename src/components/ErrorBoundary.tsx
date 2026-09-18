'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, RefreshCw, Home, X } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[VantaOS ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#07070b] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="max-w-md w-full bg-[#0c0c12] border border-white/10 rounded-2xl p-8 text-center"
            role="alert"
          >
            <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" aria-hidden />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-slate-400 text-sm mb-4 leading-relaxed">
              VantaOS encountered an unexpected error. Try again, or reload the page.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 font-mono">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-black/40 rounded-lg text-xs text-red-300 font-mono overflow-x-auto whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-2 p-3 bg-black/40 rounded-lg text-xs text-slate-500 font-mono overflow-x-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={this.handleTryAgain}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-colors"
              >
                <Home className="w-4 h-4" />
                Reload Page
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
