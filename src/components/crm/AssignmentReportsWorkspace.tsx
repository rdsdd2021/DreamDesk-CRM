"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AssignmentBatchSummary } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  RefreshCw,
  Printer,
  Download,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export function AssignmentReportsWorkspace() {
  const [batches, setBatches] = useState<AssignmentBatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "auto" | "single" | "quota">("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assignments/report");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load assignment reports");
      setBatches(data.batches || []);
    } catch (err: any) {
      setError(err.message || "Failed to load assignment reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filtered = batches.filter((b) => {
    if (modeFilter !== "all" && b.mode !== modeFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.filter_summary.toLowerCase().includes(q) ||
      (b.created_by_name || "").toLowerCase().includes(q) ||
      b.callers.some((c) => c.user_name.toLowerCase().includes(q))
    );
  });

  const totals = filtered.reduce(
    (acc, b) => {
      acc.assigned += b.total_assigned || 0;
      acc.claimed += b.claimed_assigned || 0;
      for (const c of b.callers) {
        acc.dialled += c.dialled_count || 0;
        acc.positive += c.positive_count || 0;
        acc.followups += c.followup_count || 0;
      }
      return acc;
    },
    { assigned: 0, claimed: 0, dialled: 0, positive: 0, followups: 0 }
  );
  const overallDialPct = totals.assigned > 0 ? Math.round((totals.dialled / totals.assigned) * 100) : 0;
  const overallConvPct = totals.dialled > 0 ? ((totals.positive / totals.dialled) * 100).toFixed(1) : "0.0";

  const handleExportCsv = () => {
    const rows: string[] = [
      [
        "Assignment Name",
        "Created At",
        "Created By",
        "Applied Filters",
        "Remaining Unassigned in Filter",
        "Caller",
        "Total Assigned",
        "Initial",
        "Claimed",
        "Dialled",
        "Pending New",
        "Follow-ups",
        "Positive (Interested/Admitted)",
        "Conversion %",
      ].join(","),
    ];

    for (const b of filtered) {
      for (const c of b.callers) {
        rows.push(
          [
            `"${b.name.replace(/"/g, '""')}"`,
            `"${b.created_at}"`,
            `"${(b.created_by_name || "Admin").replace(/"/g, '""')}"`,
            `"${b.filter_summary.replace(/"/g, '""')}"`,
            b.remaining_unassigned_in_filter,
            `"${c.user_name.replace(/"/g, '""')}"`,
            c.assigned_count,
            c.initial_count,
            c.claimed_count,
            c.dialled_count,
            c.pending_new_count,
            c.followup_count,
            c.positive_count,
            `${c.conversion_rate}%`,
          ].join(",")
        );
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `assignment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs print:hidden">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span>Named Assignment Batches &amp; Caller Reports</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track every named assignment, saved filter pool, remaining unassigned leads, and caller-wise progress.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            {(["all", "auto", "single", "quota"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeFilter(m)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                  modeFilter === m
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search batch, filter, caller..."
              className="h-8 pl-8 text-xs rounded-lg"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const allOpen = filtered.length > 0 && filtered.every((b) => expandedIds[b.id]);
              if (allOpen) {
                setExpandedIds({});
              } else {
                const next: Record<string, boolean> = {};
                for (const b of filtered) next[b.id] = true;
                setExpandedIds(next);
              }
            }}
            disabled={filtered.length === 0}
            className="h-8 text-xs gap-1 rounded-lg cursor-pointer"
          >
            {filtered.length > 0 && filtered.every((b) => expandedIds[b.id]) ? (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5" />
                <span>Expand All</span>
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadReports}
            disabled={loading}
            className="h-8 text-xs gap-1.5 rounded-lg cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="h-8 text-xs gap-1.5 rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            disabled={filtered.length === 0}
            className="h-8 text-xs gap-1.5 rounded-lg cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
          <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold text-muted-foreground">Active Batches</div>
            <div className="text-xl font-bold text-foreground mt-0.5">{filtered.length}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {totals.assigned.toLocaleString("en-IN")} total assigned leads
            </div>
          </div>
          <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold text-muted-foreground">Dialed Progress</div>
            <div className="text-xl font-bold text-foreground mt-0.5">{overallDialPct}%</div>
            <div className="w-full h-1.5 bg-muted rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, overallDialPct)}%` }} />
            </div>
          </div>
          <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold text-muted-foreground">Follow-ups Scheduled</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {totals.followups.toLocaleString("en-IN")}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {totals.claimed.toLocaleString("en-IN")} leads claimed by callers
            </div>
          </div>
          <div className="bg-card border border-border/80 rounded-xl p-3.5 shadow-2xs">
            <div className="text-[11px] font-semibold text-muted-foreground">Positive Conversions</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totals.positive.toLocaleString("en-IN")}{" "}
              <span className="text-xs font-semibold text-muted-foreground">({overallConvPct}%)</span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Interested / Admitted rate</div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-card border border-border/80 rounded-2xl p-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading assignment batch reports...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border/80 rounded-2xl p-10 text-center space-y-1.5">
          <p className="text-sm font-semibold text-foreground">No named assignment batches found yet</p>
          <p className="text-xs text-muted-foreground">
            Use Bulk Lead Allocation on the Leads page and give your assignment a name to track caller progress here.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-2xs divide-y divide-border/60">
          {filtered.map((batch) => {
            const isExpanded = Boolean(expandedIds[batch.id]);
            const batchDialled = batch.callers.reduce((s, c) => s + (c.dialled_count || 0), 0);
            const batchPositive = batch.callers.reduce((s, c) => s + (c.positive_count || 0), 0);
            const batchDialPct =
              batch.total_assigned > 0 ? Math.min(100, Math.round((batchDialled / batch.total_assigned) * 100)) : 0;
            return (
            <div key={batch.id} className="break-inside-avoid">
              {/* Collapsible Compact Batch Row */}
              <button
                type="button"
                onClick={() =>
                  setExpandedIds((prev) => ({ ...prev, [batch.id]: !prev[batch.id] }))
                }
                className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 cursor-pointer"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="mt-0.5 text-muted-foreground shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-primary" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {batch.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] py-0 capitalize ${
                          batch.mode === "auto"
                            ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {batch.mode}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {batch.callers.length} {batch.callers.length === 1 ? "caller" : "callers"} ·{" "}
                        {batch.created_by_name || "Admin"} ·{" "}
                        {new Date(batch.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                      <Filter className="w-3 h-3 text-primary shrink-0" />
                      <span className="truncate">{batch.filter_summary}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0 pl-6 lg:pl-0">
                  <Badge variant="secondary" className="text-[11px] font-semibold gap-1">
                    <Users className="w-3 h-3" />
                    <span>{batch.total_assigned.toLocaleString("en-IN")} Assigned</span>
                  </Badge>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    Dialed {batchDialPct}%
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-mono ${
                      batchPositive > 0
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {batchPositive} Positive
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      batch.remaining_unassigned_in_filter > 0
                        ? "text-[11px] font-semibold border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "text-[11px] font-semibold text-muted-foreground"
                    }
                  >
                    {batch.remaining_unassigned_in_filter.toLocaleString("en-IN")} Left
                  </Badge>
                </div>
              </button>

              {/* Caller-Wise Table (Collapsible, always visible when printing) */}
              <div className={isExpanded ? "border-t border-border/60 bg-muted/10 overflow-x-auto" : "hidden print:block border-t border-border/60 overflow-x-auto"}>
                <table className="w-full text-xs">
                  <thead className="bg-muted/35 border-b border-border/60 text-muted-foreground">
                    <tr>
                      <th className="text-left font-semibold px-4 py-2.5">Caller</th>
                      <th className="text-right font-semibold px-3 py-2.5">Assigned</th>
                      <th className="text-right font-semibold px-3 py-2.5">Claimed</th>
                      <th className="text-right font-semibold px-3 py-2.5">Dialled</th>
                      <th className="text-right font-semibold px-3 py-2.5">Pending (New)</th>
                      <th className="text-right font-semibold px-3 py-2.5">Follow-ups</th>
                      <th className="text-right font-semibold px-3 py-2.5">Positive</th>
                      <th className="text-right font-semibold px-4 py-2.5">Conv %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {batch.callers.map((c) => {
                      const dialPct =
                        c.assigned_count > 0 ? Math.min(100, Math.round((c.dialled_count / c.assigned_count) * 100)) : 0;
                      return (
                      <tr key={c.user_id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                              {(c.user_name || "U").charAt(0).toUpperCase()}
                            </span>
                            <span>{c.user_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">{c.assigned_count}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {c.claimed_count}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          <div className="inline-flex items-center gap-2 justify-end">
                            <div className="hidden sm:block w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${dialPct}%` }} />
                            </div>
                            <span>{c.dialled_count}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {c.pending_new_count > 0 ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              {c.pending_new_count}
                            </span>
                          ) : (
                            <span className="text-emerald-600 inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> 0
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {c.followup_count > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-0.5">
                              <Clock className="w-3 h-3" /> {c.followup_count}
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {c.positive_count}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono ${
                              Number(c.conversion_rate) > 0
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                : "text-muted-foreground"
                            }`}
                          >
                            {c.conversion_rate}%
                          </Badge>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
