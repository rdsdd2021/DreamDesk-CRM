"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Copy, Check } from "lucide-react";

interface Props {
  workspaceName?: string;
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class WorkspaceErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      copied: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`WorkspaceErrorBoundary [${this.props.workspaceName || "Workspace"}] caught error:`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleCopy = () => {
    if (this.state.error) {
      navigator.clipboard.writeText(`Workspace: ${this.props.workspaceName || "Unknown"}\nError: ${this.state.error.message}\nStack: ${this.state.error.stack}`);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center p-6 min-h-[400px]">
          <div className="max-w-md w-full p-6 rounded-2xl border border-destructive/20 bg-destructive/5 text-center space-y-4 shadow-sm animate-in fade-in-50">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                Unable to Display {this.props.workspaceName || "Workspace"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A localized component error occurred. Navigation and your other workspaces are unaffected.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-2.5 rounded-lg bg-background border border-border/80 text-[11px] font-mono text-muted-foreground text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={this.handleRetry}
                className="text-xs font-semibold h-8 gap-1.5 bg-primary text-primary-foreground shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Workspace</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={this.handleCopy}
                className="text-xs font-medium h-8 gap-1.5"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Error</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
