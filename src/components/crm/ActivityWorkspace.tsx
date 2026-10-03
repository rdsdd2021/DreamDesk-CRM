"use client";

import React, { useEffect, useState } from "react";
import { ActivityLog } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  History,
  UserCheck,
  Tag,
  Trash2,
  Upload,
  Clock,
  Search,
  RefreshCw,
  GitMerge,
  Zap,
  PhoneCall,
  MessageSquare,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export function ActivityWorkspace() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [expandedLogIds, setExpandedLogIds] = useState<number[]>([]);

  const fetchLogs = () => {
    setLoading(true);
    fetch("/api/activity")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setLogs(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedLogIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getActionBadge = (actionType: string) => {
    switch (actionType.toLowerCase()) {
      case "bulk_assign":
        return <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10">Bulk Assign</Badge>;
      case "status_update":
        return <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">Status Update</Badge>;
      case "import":
        return <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10">CSV Import</Badge>;
      case "bulk_delete":
        return <Badge variant="destructive">Bulk Delete</Badge>;
      case "lead_merge":
        return <Badge variant="outline" className="text-indigo-500 border-indigo-500/30 bg-indigo-500/10">Duplicate Merge</Badge>;
      case "auto_distribute":
        return <Badge variant="outline" className="text-purple-500 border-purple-500/30 bg-purple-500/10">Auto-Routing</Badge>;
      case "disposition_logged":
      case "call_logged":
        return <Badge variant="outline" className="text-cyan-500 border-cyan-500/30 bg-cyan-500/10">Call Logged</Badge>;
      case "whatsapp_sent":
        return <Badge variant="outline" className="text-emerald-600 border-emerald-600/30 bg-emerald-600/10">WhatsApp</Badge>;
      default:
        return <Badge variant="secondary">{actionType}</Badge>;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter =
      selectedFilter === "all" ||
      log.action_type.toLowerCase().includes(selectedFilter.toLowerCase());

    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      log.description.toLowerCase().includes(q) ||
      (log.performed_by || "").toLowerCase().includes(q) ||
      log.action_type.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <History className="w-4 h-4" />
            <span>Compliance & Operations Audit Trail</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Audit & Activity Log
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Complete immutable log of all bulk assignments, duplicate merges, CSV ingestion batches,
            and status changes across your CRM workspace.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          disabled={loading}
          className="h-8 text-xs gap-1.5 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Audit Trail</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border w-full sm:w-auto overflow-x-auto">
          {[
            { id: "all", label: "All Events" },
            { id: "import", label: "CSV Ingestion" },
            { id: "assign", label: "Assignments" },
            { id: "merge", label: "Merges" },
            { id: "status", label: "Status Changes" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setSelectedFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                selectedFilter === pill.id
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, counselor, description..."
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Log Feed */}
      {loading ? (
        <div className="py-24 text-center text-xs text-muted-foreground bg-card border rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary opacity-60" />
          <span>Loading activity history...</span>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-24 text-center bg-card border rounded-2xl shadow-sm space-y-2">
          <History className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-foreground">No matching activity records</h3>
          <p className="text-xs text-muted-foreground">Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs divide-y divide-border/60">
          {filteredLogs.map((log) => {
            const isExpanded = expandedLogIds.includes(log.id);
            let parsedMeta: any = null;
            if (log.metadata) {
              try {
                parsedMeta = JSON.parse(log.metadata);
              } catch {
                parsedMeta = log.metadata;
              }
            }

            return (
              <div key={log.id} className="p-4 hover:bg-muted/15 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getActionBadge(log.action_type)}</div>
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        {log.description}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                        <span>
                          By: <strong className="text-foreground">{log.performed_by || "System"}</strong>
                        </span>
                        {log.affected_count > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{log.affected_count.toLocaleString()} records affected</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {parsedMeta && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleExpand(log.id)}
                      className="h-7 text-xs gap-1 text-muted-foreground shrink-0"
                    >
                      <span>{isExpanded ? "Hide Details" : "View Payload"}</span>
                      {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </Button>
                  )}
                </div>

                {/* Collapsible Metadata Inspector */}
                {isExpanded && parsedMeta && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border/80 font-mono text-[11px] text-foreground overflow-x-auto">
                    <pre className="whitespace-pre-wrap">
                      {typeof parsedMeta === "object"
                        ? JSON.stringify(parsedMeta, null, 2)
                        : String(parsedMeta)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
