"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw, Copy, Check, Home, ShieldAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("GlobalErrorBoundary caught an unhandled exception:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  private handleCopyDiagnostics = () => {
    const diagnosticData = {
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "N/A",
      url: typeof window !== "undefined" ? window.location.href : "N/A",
      timestamp: new Date().toISOString(),
    };

    navigator.clipboard.writeText(JSON.stringify(diagnosticData, null, 2));
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2500);
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-border/80 bg-card shadow-2xl space-y-6 text-center animate-in fade-in-50 zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                DreamDesk Encountered an Issue
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                An unexpected interface error occurred. Your database records and active consultations remain completely safe.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-muted/60 border border-border/70 text-left font-mono text-[11px] text-muted-foreground overflow-x-auto max-h-32">
                <span className="text-destructive font-bold">Error:</span> {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                onClick={this.handleReload}
                className="flex-1 text-xs font-semibold h-10 gap-2 bg-primary text-primary-foreground shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </Button>

              <Button
                variant="outline"
                onClick={this.handleCopyDiagnostics}
                className="flex-1 text-xs font-medium h-10 gap-2"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Diagnostics</span>
                  </>
                )}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleReset}
              className="text-xs text-muted-foreground hover:text-foreground h-8 gap-1.5"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return to Dashboard Home</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
