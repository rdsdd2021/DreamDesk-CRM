"use client";

import React, { useState } from "react";
import { LeadSummaryStats, User } from "@/types/crm";
import {
  GraduationCap,
  Clock,
  CheckCircle2,
  PhoneCall,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompactKpiBarProps {
  summary: LeadSummaryStats;
  globalSummary: LeadSummaryStats;
  totalCount: number;
  users: User[];
  isRestrictedCounselor: boolean;
  onFilterStatus: (status: string) => void;
  onFilterUnassigned: () => void;
  onManageTeam?: () => void;
}

export function CompactKpiBar({
  summary,
  globalSummary,
  totalCount,
  users,
  isRestrictedCounselor,
  onFilterStatus,
  onFilterUnassigned,
  onManageTeam,
}: CompactKpiBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const totalDisplay = summary.totalLeads.toLocaleString();
  const globalTotalDisplay = (globalSummary.totalLeads || totalCount).toLocaleString();
  const conversionPct =
    summary.totalLeads > 0
      ? (((summary.statusBreakdown["Interested"] || 0) + (summary.statusBreakdown["Admitted"] || 0)) / summary.totalLeads * 100).toFixed(1)
      : "0";
  const reachedCount =
    (summary.statusBreakdown["Contacted"] || 0) +
    (summary.statusBreakdown["Interested"] || 0) +
    (summary.statusBreakdown["Follow-up"] || 0) +
    (summary.statusBreakdown["Admitted"] || 0);
  const reachedPct =
    summary.totalLeads > 0 ? ((reachedCount / summary.totalLeads) * 100).toFixed(0) : "0";

  return (
    <div className="rounded-lg border border-border/70 bg-card/75 backdrop-blur-xs shadow-2xs transition-all duration-200 overflow-hidden">
      {/* Slim 1-Line KPI Ribbon */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs gap-2">
        {/* Left: Key Metrics in Clean Pills */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Metric 1: Total / Filtered */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border/60">
            {summary.isFiltered ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            ) : (
              <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
            )}
            <span className="font-semibold text-foreground">
              {totalDisplay}{" "}
              <span className="font-normal text-muted-foreground text-[11px]">
                {summary.isFiltered ? (
                  <>
                    <span className="hidden sm:inline">matching ({conversionPct}% of {globalTotalDisplay})</span>
                    <span className="sm:hidden">filtered</span>
                  </>
                ) : (
                  "leads"
                )}
              </span>
            </span>
          </div>

          {/* Metric 2: Unallocated or Callbacks */}
          {isRestrictedCounselor ? (
            <button
              onClick={() => onFilterStatus("Follow-up")}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-colors cursor-pointer text-xs"
              title="Click to view urgent follow-ups"
            >
              <Clock className="w-3 h-3 shrink-0" />
              <span className="font-semibold tabular-nums">
                {(summary.statusBreakdown["Follow-up"] || 0).toLocaleString()}
              </span>
              <span className="font-normal text-muted-foreground text-[11px]">Callbacks</span>
            </button>
          ) : (
            <button
              onClick={onFilterUnassigned}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 transition-colors cursor-pointer text-xs"
              title="Click to view unassigned leads"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="font-semibold tabular-nums">
                {summary.unassignedCount.toLocaleString()}
              </span>
              <span className="font-normal text-muted-foreground text-[11px]">Unassigned</span>
            </button>
          )}

          {/* Metric 3: High Intent / Conversion */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 text-xs">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span className="font-semibold tabular-nums">
              {((summary.statusBreakdown["Interested"] || 0) + (summary.statusBreakdown["Admitted"] || 0)).toLocaleString()}
            </span>
            <span className="font-normal text-muted-foreground text-[11px]">
              Interested ({conversionPct}%)
            </span>
          </div>

          {/* Metric 4: Outreach / Assigned */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground text-xs">
            {isRestrictedCounselor ? (
              <>
                <PhoneCall className="w-3 h-3 text-blue-500 shrink-0" />
                <span className="text-[11px]">
                  <strong className="text-foreground font-semibold">{reachedPct}%</strong> reached
                </span>
              </>
            ) : (
              <>
                <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                <span className="text-[11px]">
                  <strong className="text-foreground font-semibold">{users.length}</strong> counselors (
                  {summary.assignedCount.toLocaleString()} assigned)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Expand/Collapse Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6.5 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground shrink-0 gap-1 rounded-md cursor-pointer"
        >
          <span>{isExpanded ? "Hide Cards" : "Details"}</span>
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>

      {/* Expandable Visual Cards (Full 4-Card View) */}
      {isExpanded && (
        <div className="p-3 pt-1 border-t border-border/60 bg-muted/15 grid grid-cols-2 lg:grid-cols-4 gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Card 1: Volume */}
          <div className="p-2.5 rounded-lg border border-border/80 bg-card shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {summary.isFiltered ? "Filtered Cohort" : isRestrictedCounselor ? "My Assigned Desk" : "Total Database"}
              </span>
              <div className="p-1 rounded-md bg-primary/10 text-primary">
                <GraduationCap className="w-3 h-3" />
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground font-sans tabular-nums">
              {totalDisplay}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                {summary.isFiltered
                  ? `${summary.totalLeads} of ${globalTotalDisplay} total`
                  : isRestrictedCounselor
                  ? "Assigned to you"
                  : "All leads in WAL"}
              </span>
            </div>
          </div>

          {/* Card 2: Outreach / Unallocated */}
          {isRestrictedCounselor ? (
            <div className="p-2.5 rounded-lg border border-amber-500/30 bg-card shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">Pending Callbacks</span>
                <div className="p-1 rounded-md bg-amber-500/10 text-amber-600">
                  <Clock className="w-3 h-3" />
                </div>
              </div>
              <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-sans tabular-nums">
                {(summary.statusBreakdown["Follow-up"] || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Requires outreach</span>
                <button
                  onClick={() => onFilterStatus("Follow-up")}
                  className="text-primary hover:underline font-semibold cursor-pointer text-[10px]"
                >
                  Filter
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg border border-border/80 bg-card shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {summary.isFiltered ? "Unallocated in Filter" : "Unallocated Pool"}
                </span>
                <div className="p-1 rounded-md bg-amber-500/10 text-amber-600">
                  <Clock className="w-3 h-3" />
                </div>
              </div>
              <div className="text-xl font-bold tracking-tight text-foreground font-sans tabular-nums">
                {summary.unassignedCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Awaiting counselor</span>
                {summary.unassignedCount > 0 && (
                  <button
                    onClick={onFilterUnassigned}
                    className="text-primary hover:underline font-semibold cursor-pointer text-[10px]"
                  >
                    Filter Pool
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Card 3: High Intent / Conversion */}
          <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-card shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-bold uppercase tracking-wider">Interested & Admitted</span>
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="w-3 h-3" />
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-sans tabular-nums">
              {((summary.statusBreakdown["Interested"] || 0) + (summary.statusBreakdown["Admitted"] || 0)).toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {conversionPct}%
              </span>
              <span>conversion pipeline</span>
            </div>
          </div>

          {/* Card 4: Outreach / Assigned */}
          <div className="p-2.5 rounded-lg border border-border/80 bg-card shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {isRestrictedCounselor ? "Outreach Progress" : summary.isFiltered ? "Assigned in Filter" : "Counselor Roster"}
              </span>
              <div className="p-1 rounded-md bg-blue-500/10 text-blue-600">
                {isRestrictedCounselor ? <PhoneCall className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              </div>
            </div>
            <div className="text-xl font-bold tracking-tight text-foreground font-sans tabular-nums">
              {isRestrictedCounselor
                ? reachedCount.toLocaleString()
                : summary.isFiltered
                ? summary.assignedCount.toLocaleString()
                : `${users.length} Counselors`}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center justify-between">
              <span>
                {isRestrictedCounselor
                  ? `${reachedPct}% reached`
                  : summary.isFiltered
                  ? `${summary.totalLeads > 0 ? ((summary.assignedCount / summary.totalLeads) * 100).toFixed(0) : 0}% assigned`
                  : `${(globalSummary.assignedCount || summary.assignedCount).toLocaleString()} assigned`}
              </span>
              {!isRestrictedCounselor && !summary.isFiltered && onManageTeam && (
                <button
                  onClick={onManageTeam}
                  className="text-primary hover:underline font-semibold cursor-pointer text-[10px]"
                >
                  Manage Team
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
