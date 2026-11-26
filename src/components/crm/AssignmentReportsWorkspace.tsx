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
} from "lucide-react";

export function AssignmentReportsWorkspace() {
  const [batches, setBatches] = useState<AssignmentBatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      b.filter_summary.toLowerCase().includes(q) ||
      (b.created_by_name || "").toLowerCase().includes(q) ||
      b.callers.some((c) => c.user_name.toLowerCase().includes(q))
    );
  });

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
          <div className="relative w-56">
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
        <div className="space-y-4">
          {filtered.map((batch) => (
            <div
              key={batch.id}
              className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-2xs break-inside-avoid"
            >
              {/* Batch Header */}
              <div className="p-4 bg-muted/30 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-foreground">{batch.name}</h3>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {batch.mode}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      by {batch.created_by_name || "Admin"} ·{" "}
                      {new Date(batch.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    <Filter className="w-3 h-3 text-primary shrink-0" />
                    <span className="font-medium text-foreground">Filters:</span>
                    <span>{batch.filter_summary}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <Badge variant="secondary" className="text-xs font-semibold gap-1">
                    <Users className="w-3 h-3" />
                    <span>{batch.total_assigned} Assigned</span>
                    {batch.claimed_assigned > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ({batch.claimed_assigned} claimed)
                      </span>
                    )}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      batch.remaining_unassigned_in_filter > 0
                        ? "text-xs font-semibold border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "text-xs font-semibold text-muted-foreground"
                    }
                  >
                    {batch.remaining_unassigned_in_filter} Unassigned Left in Filter
                  </Badge>
                </div>
              </div>

              {/* Caller-Wise Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground">
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
                    {batch.callers.map((c) => (
                      <tr key={c.user_id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 font-semibold text-foreground">{c.user_name}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">{c.assigned_count}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          {c.claimed_count}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{c.dialled_count}</td>
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
                          <span className="inline-flex items-center gap-0.5">
                            <Sparkles className="w-3 h-3 text-primary" />
                            {c.conversion_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
