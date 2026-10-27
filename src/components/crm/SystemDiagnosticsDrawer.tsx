"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  HardDrive,
  Database,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  Server,
  Layers,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { ApiClient } from "@/lib/api/apiClient";

interface SystemDiagnosticsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemDiagnosticsDrawer({ isOpen, onClose }: SystemDiagnosticsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ApiClient.fetchJson<any>("/api/diagnostics");
      if (res.error || !res.data) {
        throw new Error(res.error?.message || "Failed to load diagnostics");
      }
      setData(res.data);
    } catch (err: any) {
      setError(err.message || "Failed to load system diagnostics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDiagnostics();
    }
  }, [isOpen]);

  const handlePurgeErrors = async () => {
    if (!confirm("Are you sure you want to clear the diagnostic error history?")) return;
    setPurging(true);
    try {
      await ApiClient.fetchJson("/api/diagnostics", { method: "DELETE" });
      await fetchDiagnostics();
    } catch (err: any) {
      alert("Failed to purge logs: " + err.message);
    } finally {
      setPurging(false);
    }
  };

  const handleCopyBundle = () => {
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col bg-card border-l border-border shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="p-5 pb-4 bg-muted/30 border-b border-border/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <Server className="w-4 h-4" />
              <span>System Health & Diagnostics</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDiagnostics}
                disabled={loading}
                className="h-7 text-xs gap-1.5 px-2.5"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyBundle}
                disabled={!data}
                className="h-7 text-xs gap-1.5 px-2.5"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "Copied" : "Copy Bundle"}</span>
              </Button>
            </div>
          </div>

          <SheetTitle className="text-lg font-bold text-foreground mt-1">
            Server & Database Health Inspector
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Real-time telemetry, SQLite WAL status, busy timeout settings, and persistent error logs.
          </SheetDescription>
        </SheetHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* Overall Status Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      System Status: Operational
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      SQLite WAL Active • 15s Busy Timeout Configured
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] bg-background text-emerald-600 border-emerald-500/30">
                  Healthy
                </Badge>
              </div>

              {/* Database Metrics Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-primary" />
                  <span>Database & Engine Storage</span>
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                    <span className="text-[11px] text-muted-foreground">Database File (crm.db)</span>
                    <div className="text-base font-bold font-mono text-foreground">
                      {data.database?.dbSizeMb} MB
                    </div>
                    <div className="text-[10px] text-muted-foreground">Path: .../data/crm.db</div>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                    <span className="text-[11px] text-muted-foreground">Write-Ahead Log (WAL)</span>
                    <div className="text-base font-bold font-mono text-primary">
                      {data.database?.walSizeMb} MB
                    </div>
                    <div className="text-[10px] text-muted-foreground">Mode: {data.database?.journalMode?.toUpperCase()}</div>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                    <span className="text-[11px] text-muted-foreground">Busy Lock Timeout</span>
                    <div className="text-base font-bold font-mono text-foreground">
                      {data.database?.busyTimeoutMs} ms
                    </div>
                    <div className="text-[10px] text-emerald-600">Auto-retry on write contention</div>
                  </div>

                  <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1">
                    <span className="text-[11px] text-muted-foreground">Total Lead Records</span>
                    <div className="text-base font-bold font-mono text-foreground">
                      {data.counts?.leads?.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Across {data.counts?.users} staff accounts</div>
                  </div>
                </div>
              </div>

              {/* Server Error Logs */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-500" />
                    <span>Server Error History ({data.recentErrors?.length || 0})</span>
                  </span>

                  {data.recentErrors?.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePurgeErrors}
                      disabled={purging}
                      className="h-6 text-[11px] text-muted-foreground hover:text-destructive gap-1 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear Logs</span>
                    </Button>
                  )}
                </div>

                {data.recentErrors?.length === 0 ? (
                  <div className="p-6 rounded-xl border border-border/60 bg-muted/10 text-center space-y-1">
                    <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                    <div className="text-xs font-semibold text-foreground">Zero Logged Errors</div>
                    <p className="text-[11px] text-muted-foreground">
                      No unhandled server errors or lock contentions have been registered.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border/80 rounded-xl divide-y divide-border/60 bg-card overflow-hidden">
                    {data.recentErrors.map((err: any) => {
                      const isExpanded = expandedErrorId === err.id;
                      return (
                        <div key={err.id} className="p-3 text-xs space-y-1.5 hover:bg-muted/20 transition-colors">
                          <div
                            className="flex items-start justify-between gap-2 cursor-pointer select-none"
                            onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="destructive" className="text-[10px] font-mono py-0">
                                  {err.error_code}
                                </Badge>
                                <span className="font-mono text-[11px] text-muted-foreground truncate">
                                  {err.endpoint || "General"}
                                </span>
                              </div>
                              <div className="font-semibold text-foreground truncate">{err.message}</div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 text-[10px] text-muted-foreground">
                              <span>{new Date(err.created_at).toLocaleTimeString()}</span>
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="pt-2 space-y-1.5 border-t border-border/50 text-[11px] font-mono animate-in fade-in-50">
                              <div className="text-muted-foreground">
                                User: <strong className="text-foreground">{err.user_name || err.user_id || "Anonymous"}</strong> | Status: <strong className="text-foreground">{err.http_status}</strong>
                              </div>
                              {err.details && (
                                <div className="p-2 rounded bg-muted/80 text-foreground overflow-x-auto max-h-32 whitespace-pre-wrap text-[10px]">
                                  {err.details}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
