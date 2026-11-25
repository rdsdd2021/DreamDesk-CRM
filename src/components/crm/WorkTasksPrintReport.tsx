"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User, WorkTaskLog } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, RefreshCw, Loader2 } from "lucide-react";

interface WorkTasksPrintReportProps {
  roleMode: "admin" | "counselor";
  users: User[];
}

export function WorkTasksPrintReport({ roleMode, users }: WorkTasksPrintReportProps) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [userId, setUserId] = useState("all");
  const [taskType, setTaskType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalLogs: 0,
    totalCompletions: 0,
    uniqueTasksCompleted: 0,
    avgDurationMinutes: 0,
  });
  const [logs, setLogs] = useState<WorkTaskLog[]>([]);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
      if (roleMode === "admin" && userId !== "all") params.set("user_id", userId);
      if (taskType !== "all") params.set("task_type", taskType);

      const res = await fetch(`/api/work-tasks/report?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(
          data.summary || {
            totalLogs: 0,
            totalCompletions: 0,
            uniqueTasksCompleted: 0,
            avgDurationMinutes: 0,
          }
        );
        setLogs(data.logs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, userId, taskType, roleMode]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleExportCsv = () => {
    const cols = ["Date/Time", "Task", "Type", "Staff", "Action", "Progress %", "Duration (s)", "Notes"];
    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const rows = logs.map((l) =>
      [
        l.created_at,
        l.task_title || `#${l.task_id}`,
        l.task_type || "",
        l.user_name,
        l.action,
        l.progress_pct ?? "",
        l.duration_seconds ?? "",
        l.notes ?? "",
      ]
        .map(escape)
        .join(",")
    );
    const csv = [cols.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `work_tasks_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters & Print Actions (hidden when printing) */}
      <div className="print:hidden flex items-end justify-between gap-3 flex-wrap bg-card border border-border/80 rounded-2xl p-3.5">
        <div className="flex items-end gap-2.5 flex-wrap">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">From</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">To</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          {roleMode === "admin" && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Staff</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="all">All Staff</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="all">All Types</option>
              <option value="recurring">Recurring</option>
              <option value="timed">Timed</option>
              <option value="one_time">One-Time</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadReport} className="h-8 gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={logs.length === 0}
            onClick={handleExportCsv}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </Button>
          <Button
            size="sm"
            onClick={() => window.print()}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* Print Header (visible in print & preview) */}
      <div className="hidden print:block pb-3 border-b border-black/20">
        <h1 className="text-lg font-bold">DreamDesk CRM — Operational Tasks & Activity Report</h1>
        <p className="text-xs text-gray-600">
          Generated on {new Date().toLocaleString()}
          {fromDate || toDate ? ` • Range: ${fromDate || "Start"} to ${toDate || "Today"}` : ""}
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border border-border/80 bg-card">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Completions</div>
          <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
            {summary.totalCompletions}
          </div>
        </div>
        <div className="p-3 rounded-xl border border-border/80 bg-card">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Unique Tasks</div>
          <div className="text-lg font-extrabold">{summary.uniqueTasksCompleted}</div>
        </div>
        <div className="p-3 rounded-xl border border-border/80 bg-card">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Total Logged Events</div>
          <div className="text-lg font-extrabold">{summary.totalLogs}</div>
        </div>
        <div className="p-3 rounded-xl border border-border/80 bg-card">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Avg Timed Duration</div>
          <div className="text-lg font-extrabold">{summary.avgDurationMinutes}m</div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="border border-border/80 rounded-2xl overflow-auto bg-card">
        {loading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading retained history...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No task history records found for this filter.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-muted/60 border-b border-border">
              <tr>
                <th className="px-3 py-2 font-semibold">Timestamp</th>
                <th className="px-3 py-2 font-semibold">Task</th>
                <th className="px-3 py-2 font-semibold">Staff</th>
                <th className="px-3 py-2 font-semibold">Action</th>
                <th className="px-3 py-2 font-semibold">Progress</th>
                <th className="px-3 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                    {new Date(log.created_at).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {log.task_title || `Task #${log.task_id}`}
                    {log.task_type && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground capitalize">
                        ({log.task_type.replace("_", " ")})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{log.user_name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px]">
                    {log.progress_pct !== null ? `${log.progress_pct}%` : "-"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[240px] truncate">
                    {log.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
