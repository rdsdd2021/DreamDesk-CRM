"use client";

import React, { useState, useEffect } from "react";
import { Lead, SchemaMeta, User, Disposition } from "@/types/crm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  UserCheck,
  Phone,
  Mail,
  School,
  Sparkles,
  ChevronDown,
  PhoneCall,
  MessageSquare,
  Clock,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";

function InlineScoreCell({
  initialScore,
  onSave,
}: {
  initialScore: number;
  onSave: (val: number) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [scoreVal, setScoreVal] = React.useState(String(initialScore));

  React.useEffect(() => {
    setScoreVal(String(initialScore));
  }, [initialScore]);

  const handleCommit = () => {
    setIsEditing(false);
    const parsed = parseInt(scoreVal, 10);
    if (!isNaN(parsed) && parsed !== initialScore) {
      onSave(parsed);
    } else {
      setScoreVal(String(initialScore));
    }
  };

  if (isEditing) {
    return (
      <input
        type="number"
        value={scoreVal}
        autoFocus
        onChange={(e) => setScoreVal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCommit();
          if (e.key === "Escape") {
            setScoreVal(String(initialScore));
            setIsEditing(false);
          }
        }}
        className="w-14 h-6 px-1 text-xs font-mono font-bold rounded bg-background border border-primary focus:outline-none"
      />
    );
  }

  const scoreNum = initialScore || 0;
  const colorClass =
    scoreNum >= 75
      ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/20"
      : scoreNum >= 50
      ? "text-blue-600 bg-blue-500/10 border-blue-500/20"
      : scoreNum >= 25
      ? "text-amber-600 bg-amber-500/10 border-amber-500/20"
      : "text-muted-foreground bg-muted/60 border-border/80";

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title="Click to edit score"
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border transition-all hover:scale-105 cursor-pointer ${colorClass}`}
    >
      <span>{scoreNum}</span>
    </button>
  );
}

interface LeadsTableProps {
  leads: Lead[];
  schemaMeta: SchemaMeta[];
  visibleColumns: string[];
  selectedLeadIds: number[];
  onToggleLeadSelection: (id: number) => void;
  onToggleSelectAllPage: () => void;
  isAllPageSelected: boolean;
  totalFilteredCount: number;
  isAllFilteredSelected: boolean;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onViewLeadDetails: (lead: Lead) => void;
  onQuickAssignLead: (lead: Lead) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSortChange: (column: string) => void;
  users: User[];
  loading: boolean;
  dispositions?: Disposition[];
  onQuickDispositionChange?: (leadId: number, dispositionId: string) => void;
  density?: "compact" | "comfortable";
  activeLeadId?: number | null;
  onInlineUpdate?: (leadId: number, field: string, value: any) => void;
  viewMode?: "table" | "cards" | "grid";
  onViewModeChange?: (mode: "table" | "cards" | "grid") => void;
}

export function LeadsTable({
  leads,
  schemaMeta,
  visibleColumns,
  selectedLeadIds,
  onToggleLeadSelection,
  onToggleSelectAllPage,
  isAllPageSelected,
  totalFilteredCount,
  isAllFilteredSelected,
  onSelectAllFiltered,
  onClearSelection,
  onViewLeadDetails,
  onQuickAssignLead,
  sortBy,
  sortOrder,
  onSortChange,
  users,
  loading,
  dispositions = [],
  onQuickDispositionChange,
  density = "comfortable",
  activeLeadId = null,
  onInlineUpdate,
  viewMode: propViewMode,
  onViewModeChange,
}: LeadsTableProps) {
  const normalizedPropMode = propViewMode === "grid" ? "cards" : propViewMode;
  const [localViewMode, setLocalViewMode] = useState<"table" | "cards">(
    normalizedPropMode || "table"
  );

  useEffect(() => {
    if (propViewMode) {
      setLocalViewMode(propViewMode === "grid" ? "cards" : (propViewMode as "table" | "cards"));
      return;
    }
    if (typeof window !== "undefined") {
      if (window.innerWidth < 768) {
        setLocalViewMode("cards");
      }
    }
  }, [propViewMode]);

  const handleSwitchViewMode = (mode: "table" | "cards") => {
    setLocalViewMode(mode);
    onViewModeChange?.(mode === "cards" ? "grid" : "table");
  };
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "new":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-blue-50 text-blue-700 border-blue-200/70 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>New</span>
          </span>
        );
      case "contacted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Contacted</span>
          </span>
        );
      case "interested":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Interested</span>
          </span>
        );
      case "admitted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-indigo-50 text-indigo-700 border-indigo-200/70 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span>Admitted</span>
          </span>
        );
      case "follow-up":
      case "follow_up":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-violet-50 text-violet-700 border-violet-200/70 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span>Follow-up</span>
          </span>
        );
      case "not interested":
      case "not_interested":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Not Interested</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-muted text-muted-foreground border-border/80">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
            <span>{status}</span>
          </span>
        );
    }
  };

  const dynamicColumns = schemaMeta.filter(
    (m) => m.is_visible && visibleColumns.includes(m.key_name)
  );

  // Mobile Card View optimized for phone dialing, WhatsApp, and fast call dispositions
  const renderCardsView = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`card-skel-${i}`} className="p-4 rounded-2xl border border-border/60 bg-card space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="w-28 h-4 rounded bg-muted/60" />
                <div className="w-16 h-4 rounded-full bg-muted/60" />
              </div>
              <div className="h-14 rounded-xl bg-muted/40" />
              <div className="flex gap-2">
                <div className="flex-1 h-9 rounded-xl bg-muted/60" />
                <div className="flex-1 h-9 rounded-xl bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (leads.length === 0) {
      return (
        <div className="py-20 px-4 text-center">
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <School className="w-10 h-10 stroke-[1.25] text-muted-foreground/50 mb-1" />
            <div className="text-sm font-semibold text-foreground">No student leads found</div>
            <div className="text-xs text-muted-foreground max-w-xs mx-auto">
              Try adjusting your active filters or select a different work queue.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
        {leads.map((lead) => {
          let rawAttrs: Record<string, any> = {};
          try {
            rawAttrs = typeof lead.raw_attributes === "string" ? JSON.parse(lead.raw_attributes) : lead.raw_attributes || {};
          } catch {}

          const isSelected = selectedLeadIds.includes(lead.id) || isAllFilteredSelected;

          return (
            <div
              key={lead.id}
              className={cn(
                "bg-card border border-border/80 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition-all space-y-3 relative text-xs flex flex-col justify-between",
                isSelected ? "border-primary/60 bg-primary/[0.03] ring-1 ring-primary/20" : "",
                activeLeadId === lead.id ? "ring-2 ring-primary border-transparent" : ""
              )}
            >
              {/* Header: Checkbox, Name, Lead Code, Stage Dropdown */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleLeadSelection(lead.id)}
                      className="mt-1"
                      aria-label={`Select ${lead.lead_code}`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer truncate max-w-[170px]"
                          onClick={() => onViewLeadDetails(lead)}
                        >
                          {lead.name || "Unnamed Student"}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px] font-semibold px-1.5 py-0.5 text-muted-foreground rounded-md">
                          {lead.lead_code}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {rawAttrs.stream && <span className="font-medium text-foreground/90">{rawAttrs.stream}</span>}
                        {rawAttrs.city && (
                          <>
                            <span>•</span>
                            <span>{rawAttrs.city}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inline Stage Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger className="focus:outline-none cursor-pointer shrink-0">
                      <span className="inline-flex items-center gap-1 hover:ring-2 hover:ring-primary/20 rounded-md transition-all">
                        {getStatusBadge(lead.status)}
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 text-xs p-1.5 rounded-xl shadow-xl">
                      <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Change Stage
                      </div>
                      {["New", "Contacted", "Interested", "Follow-up", "Admitted", "Not Interested"].map((st) => (
                        <DropdownMenuItem
                          key={st}
                          onClick={() => onInlineUpdate?.(lead.id, "status", st)}
                          className={`gap-2 cursor-pointer text-xs rounded-lg py-1.5 px-2 ${lead.status === st ? "font-bold bg-primary/10 text-primary" : ""}`}
                        >
                          {getStatusBadge(st)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Academic & Score Box */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-xl border border-border/70">
                  <div className="min-w-0">
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">School / College</span>
                    <span className="font-semibold text-foreground truncate block mt-0.5">{rawAttrs.school || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-bold uppercase tracking-wider">Percentage / Score</span>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {rawAttrs.score ? (
                        <span className="px-1.5 py-0.5 text-xs font-mono font-bold rounded-md bg-primary/10 text-primary border border-primary/20">
                          {rawAttrs.score}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 italic text-xs">N/A</span>
                      )}
                      {rawAttrs.jee_percentile && (
                        <span className="px-1.5 py-0.5 text-xs font-mono rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                          JEE {rawAttrs.jee_percentile}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lead Tags Badges */}
                {lead.tags && lead.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {lead.tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Scheduled Callback Alert */}
                {lead.callback_at && (
                  <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                    <div className="flex items-center gap-1.5 font-medium text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                      <span>Callback: {new Date(lead.callback_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                  </div>
                )}

                {/* Fast Call Outcome (Disposition) Selector */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {dispositions.length > 0 && onQuickDispositionChange ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="focus:outline-none max-w-full">
                          {lead.disposition_name ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-2xs truncate max-w-full cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
                              style={{
                                backgroundColor: `${lead.disposition_color || "#3b82f6"}15`,
                                borderColor: `${lead.disposition_color || "#3b82f6"}40`,
                                color: lead.disposition_color || "#3b82f6",
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: lead.disposition_color || "#3b82f6" }} />
                              <span className="truncate">{lead.disposition_name}</span>
                              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:border-primary/40 cursor-pointer">
                              <span>Set Disposition</span>
                              <ChevronDown className="w-3 h-3 opacity-60" />
                            </span>
                          )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 text-xs max-h-60 overflow-y-auto">
                          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fast Call Outcome</div>
                          {dispositions.map((d) => (
                            <DropdownMenuItem key={d.id} onClick={() => onQuickDispositionChange(lead.id, d.id)} className="gap-2 cursor-pointer text-xs">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="truncate flex-1">{d.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{d.score > 0 ? `+${d.score}` : d.score}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">{lead.disposition_name || "Uncontacted"}</span>
                    )}
                  </div>

                  {lead.assigned_user_name && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium shrink-0">
                      <UserCheck className="w-3 h-3 text-primary" />
                      <span className="truncate max-w-[100px]">{lead.assigned_user_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Big Touch Action Buttons for Telecallers & Counselors */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="col-span-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
                    title="Direct Phone Call"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                ) : (
                  <button disabled className="col-span-1 h-10 rounded-xl bg-muted text-muted-foreground text-xs flex items-center justify-center opacity-50">
                    No Phone
                  </button>
                )}

                {lead.phone ? (
                  <a
                    href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="col-span-1 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer hover:bg-emerald-500/20"
                    title="Message on WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                ) : null}

                <Button
                  variant="outline"
                  onClick={() => onViewLeadDetails(lead)}
                  className="col-span-1 h-10 rounded-xl text-xs font-semibold border-border/80 hover:bg-muted text-foreground cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                  <span>Details</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="border border-border/80 rounded-xl bg-card shadow-xs overflow-hidden flex flex-col">
      {/* High-Volume Filtered Selection Banner */}
      {isAllPageSelected && totalFilteredCount > leads.length && (
        <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>
              {isAllFilteredSelected ? (
                <span>
                  All <span className="font-bold tabular-nums">{totalFilteredCount.toLocaleString()}</span> matching leads across entire database are selected.
                </span>
              ) : (
                <span>
                  All <span className="font-bold tabular-nums">{leads.length}</span> leads on this page are selected.
                </span>
              )}
            </span>
          </div>

          <div>
            {!isAllFilteredSelected ? (
              <Button
                variant="link"
                size="sm"
                onClick={onSelectAllFiltered}
                className="h-auto p-0 text-xs font-semibold text-primary underline"
              >
                Select all {totalFilteredCount.toLocaleString()} leads
              </Button>
            ) : (
              <Button
                variant="link"
                size="sm"
                onClick={onClearSelection}
                className="h-auto p-0 text-xs text-muted-foreground underline"
              >
                Clear selection
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Top View Mode Switcher & Page Info Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border-b border-border/60 text-xs">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllPageSelected || isAllFilteredSelected}
            onCheckedChange={onToggleSelectAllPage}
            aria-label="Select all on page"
          />
          <span className="text-[11px] text-muted-foreground font-medium">
            {leads.length > 0 ? (
              <span>Showing <strong className="text-foreground tabular-nums">{leads.length}</strong> leads</span>
            ) : (
              <span>0 leads</span>
            )}
          </span>
        </div>

        {/* View Mode Toggle (Cards vs Table) */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
          <button
            type="button"
            onClick={() => handleSwitchViewMode("cards")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
              localViewMode === "cards"
                ? "bg-card text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Switch to Student Cards Grid View"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px]">Grid</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchViewMode("table")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
              localViewMode === "table"
                ? "bg-card text-foreground shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Switch to High-Density Table View"
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span className="text-[11px]">Table</span>
          </button>
        </div>
      </div>

      {localViewMode === "cards" ? (
        renderCardsView()
      ) : (
        /* Table Container */
        <div className="overflow-x-auto min-h-[420px]">
          <Table>
          <TableHeader className="bg-muted/40 backdrop-blur-md sticky top-0 z-10 border-b border-border/80">
            <TableRow className="hover:bg-transparent border-none">
              <TableHead className="w-10 px-3 text-center">
                <Checkbox
                  checked={isAllPageSelected || isAllFilteredSelected}
                  onCheckedChange={onToggleSelectAllPage}
                  aria-label="Select all on page"
                />
              </TableHead>

              {visibleColumns.includes("lead_code") && (
                <TableHead className="w-28 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <button
                    onClick={() => onSortChange("lead_code")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <span>Code</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </TableHead>
              )}

              {visibleColumns.includes("name") && (
                <TableHead className="min-w-[180px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <button
                    onClick={() => onSortChange("name")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <span>Student Name</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </TableHead>
              )}

              {visibleColumns.includes("phone") && (
                <TableHead className="min-w-[150px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <span>Contact</span>
                </TableHead>
              )}

              {visibleColumns.includes("status") && (
                <TableHead className="w-32 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <button
                    onClick={() => onSortChange("status")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <span>Stage</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </TableHead>
              )}

              {visibleColumns.includes("disposition") && (
                <TableHead className="min-w-[160px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <span>Call Outcome</span>
                </TableHead>
              )}

              {visibleColumns.includes("campaign") && (
                <TableHead className="min-w-[140px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <span>Campaign</span>
                </TableHead>
              )}

              {visibleColumns.includes("assigned_to") && (
                <TableHead className="min-w-[160px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <span>Counselor</span>
                </TableHead>
              )}

              {/* Dynamic Columns */}
              {dynamicColumns.map((col) => (
                <TableHead key={col.key_name} className="min-w-[140px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  <span className="truncate">{col.display_label}</span>
                </TableHead>
              ))}

              <TableHead className="w-12 text-right pr-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow
                  key={`skeleton-${i}`}
                  className={cn("border-b border-border/40", density === "compact" ? "h-8.5" : "h-11")}
                >
                  <TableCell className="px-3 text-center">
                    <div className="w-3.5 h-3.5 rounded bg-muted/60 animate-pulse mx-auto" />
                  </TableCell>
                  {visibleColumns.includes("lead_code") && (
                    <TableCell>
                      <div className="w-16 h-3 rounded bg-muted/60 animate-pulse" />
                    </TableCell>
                  )}
                  {visibleColumns.includes("name") && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-muted/60 animate-pulse shrink-0" />
                        <div className="w-28 h-3 rounded bg-muted/60 animate-pulse" />
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.includes("phone") && (
                    <TableCell>
                      <div className="w-24 h-3 rounded bg-muted/60 animate-pulse" />
                    </TableCell>
                  )}
                  {visibleColumns.includes("status") && (
                    <TableCell>
                      <div className="w-16 h-4 rounded-full bg-muted/60 animate-pulse" />
                    </TableCell>
                  )}
                  {visibleColumns.includes("disposition") && (
                    <TableCell>
                      <div className="w-24 h-4 rounded-full bg-muted/60 animate-pulse" />
                    </TableCell>
                  )}
                  {visibleColumns.includes("campaign") && (
                    <TableCell>
                      <div className="w-20 h-4 rounded bg-muted/60 animate-pulse" />
                    </TableCell>
                  )}
                  {visibleColumns.includes("assigned_to") && (
                    <TableCell>
                      <div className="w-20 h-3 rounded bg-muted/60 animate-pulse" />
                    </TableCell>
                  )}
                  {dynamicColumns.map((col) => (
                    <TableCell key={`dyn-skel-${col.key_name}-${i}`}>
                      <div className="w-16 h-3 rounded bg-muted/60 animate-pulse" />
                    </TableCell>
                  ))}
                  <TableCell className="text-right pr-3">
                    <div className="w-4 h-4 rounded bg-muted/60 animate-pulse ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8 + dynamicColumns.length} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <School className="w-8 h-8 stroke-[1.25] text-muted-foreground/50" />
                    <div className="text-sm font-semibold text-foreground">No student leads found</div>
                    <div className="text-xs text-muted-foreground max-w-sm">
                      Try clearing or changing your filters, or generate sample student leads using the button above.
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedLeadIds.includes(lead.id) || isAllFilteredSelected;
                return (
                  <TableRow
                    key={lead.id}
                    data-state={isSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer text-xs transition-colors border-b border-border/60",
                      density === "compact" ? "h-8.5" : "h-11",
                      activeLeadId === lead.id
                        ? "bg-primary/10 border-l-2 border-l-primary shadow-xs font-medium"
                        : "hover:bg-muted/40"
                    )}
                    onClick={() => onViewLeadDetails(lead)}
                  >
                    {/* Selection Checkbox */}
                    <TableCell className="px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleLeadSelection(lead.id)}
                        aria-label={`Select lead ${lead.lead_code}`}
                      />
                    </TableCell>

                    {/* Lead Code */}
                    {visibleColumns.includes("lead_code") && (
                      <TableCell className="font-mono text-muted-foreground text-[11px] tabular-nums font-medium">
                        {lead.lead_code}
                      </TableCell>
                    )}

                    {/* Student Name */}
                    {visibleColumns.includes("name") && (
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs border border-primary/20">
                            {(lead.name || "S").charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-foreground truncate max-w-[160px] tracking-tight hover:text-primary transition-colors block">
                              {lead.name || "Unnamed Student"}
                            </span>
                            {lead.tags && lead.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                {lead.tags.slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0"
                                  >
                                    #{t}
                                  </span>
                                ))}
                                {lead.tags.length > 2 && (
                                  <span
                                    className="text-[9px] font-mono text-muted-foreground"
                                    title={lead.tags.slice(2).map((x) => `#${x}`).join(", ")}
                                  >
                                    +{lead.tags.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}

                    {/* Phone & Email */}
                    {visibleColumns.includes("phone") && (
                      <TableCell>
                        <div className="space-y-0.5">
                          {lead.phone && (
                            <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-foreground/90 group/phone">
                              <a
                                href={`tel:${lead.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-primary hover:underline flex items-center gap-1 font-semibold"
                                title="Click to call"
                              >
                                <PhoneCall className="w-3.5 h-3.5 text-muted-foreground/70 group-hover/phone:text-primary" />
                                <span>{lead.phone}</span>
                              </a>
                              <a
                                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 hover:bg-emerald-500/15 text-emerald-600 rounded-md transition-colors inline-flex items-center"
                                title="Open WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate max-w-[160px]">
                              <Mail className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {/* Status Badge (Inline Editable) */}
                    {visibleColumns.includes("status") && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="focus:outline-none cursor-pointer group">
                            <span className="inline-flex items-center gap-1 hover:ring-2 hover:ring-primary/20 rounded-md transition-all">
                              {getStatusBadge(lead.status)}
                              <ChevronDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity" />
                            </span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40 text-xs">
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Change Stage
                            </div>
                            {["New", "Contacted", "Interested", "Follow-up", "Admitted", "Not Interested"].map((st) => (
                              <DropdownMenuItem
                                key={st}
                                onClick={() => onInlineUpdate?.(lead.id, "status", st)}
                                className={`gap-2 cursor-pointer text-xs ${lead.status === st ? "font-bold bg-primary/10 text-primary" : ""}`}
                              >
                                {getStatusBadge(st)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}

                    {/* Call Disposition */}
                    {visibleColumns.includes("disposition") && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {dispositions.length > 0 && onQuickDispositionChange ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="focus:outline-none">
                              {lead.disposition_name ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border shadow-2xs truncate max-w-[145px] hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer group"
                                  style={{
                                    backgroundColor: `${lead.disposition_color || "#3b82f6"}12`,
                                    borderColor: `${lead.disposition_color || "#3b82f6"}40`,
                                    color: lead.disposition_color || "#3b82f6",
                                  }}
                                  title="Click to quickly log call outcome"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: lead.disposition_color || "#3b82f6" }}
                                  />
                                  <span className="truncate">{lead.disposition_name}</span>
                                  <ChevronDown className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-border/80 text-[10px] text-muted-foreground/70 hover:text-foreground hover:border-primary/40 cursor-pointer transition-colors"
                                  title="Click to log disposition"
                                >
                                  <span>Uncontacted</span>
                                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                </span>
                              )}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 text-xs max-h-64 overflow-y-auto">
                              <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                Fast Call Outcome
                              </div>
                              {dispositions.map((d) => (
                                <DropdownMenuItem
                                  key={d.id}
                                  onClick={() => onQuickDispositionChange(lead.id, d.id)}
                                  className="gap-2 cursor-pointer text-xs"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: d.color }}
                                  />
                                  <span className="truncate flex-1">{d.name}</span>
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {d.score > 0 ? `+${d.score}` : d.score}
                                  </span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : lead.disposition_name ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border shadow-2xs truncate max-w-[140px]"
                            style={{
                              backgroundColor: `${lead.disposition_color || "#3b82f6"}12`,
                              borderColor: `${lead.disposition_color || "#3b82f6"}40`,
                              color: lead.disposition_color || "#3b82f6",
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: lead.disposition_color || "#3b82f6" }}
                            />
                            <span className="truncate">{lead.disposition_name}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/50 italic">
                            Uncontacted
                          </span>
                        )}
                      </TableCell>
                    )}

                    {/* Campaign */}
                    {visibleColumns.includes("campaign") && (
                      <TableCell>
                        {lead.campaign_name ? (
                          <Badge variant="outline" className="text-[10px] bg-muted/40 font-normal border-border/80 truncate max-w-[130px]">
                            {lead.campaign_name}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 italic">Direct / Organic</span>
                        )}
                      </TableCell>
                    )}

                    {/* Assigned Counselor (Inline Editable) */}
                    {visibleColumns.includes("assigned_to") && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="focus:outline-none cursor-pointer group">
                            {lead.assigned_user_name ? (
                              <div className="flex items-center gap-1.5 p-1 rounded-md hover:bg-muted/60 transition-colors">
                                <div
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 shadow-2xs"
                                  style={{ backgroundColor: lead.assigned_user_color || "#3b82f6" }}
                                >
                                  {lead.assigned_user_name.charAt(0)}
                                </div>
                                <span className="text-[11px] font-medium text-foreground truncate max-w-[100px]">
                                  {lead.assigned_user_name}
                                </span>
                                <ChevronDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 italic font-mono p-1 rounded hover:bg-muted/60">
                                <span>Unallocated</span>
                                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                              </span>
                            )}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 text-xs max-h-56 overflow-y-auto">
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Reassign Counselor
                            </div>
                            <DropdownMenuItem
                              onClick={() => onInlineUpdate?.(lead.id, "assigned_to", null)}
                              className="cursor-pointer text-xs text-muted-foreground italic"
                            >
                              Unallocated
                            </DropdownMenuItem>
                            {users.map((u) => (
                              <DropdownMenuItem
                                key={u.id}
                                onClick={() => onInlineUpdate?.(lead.id, "assigned_to", u.id)}
                                className={`gap-2 cursor-pointer text-xs ${lead.assigned_to === u.id ? "font-bold bg-primary/10 text-primary" : ""}`}
                              >
                                <div
                                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                                  style={{ backgroundColor: u.avatar_color }}
                                >
                                  {u.name.charAt(0)}
                                </div>
                                <span className="truncate">{u.name}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}

                    {/* Dynamic Columns */}
                    {dynamicColumns.map((col) => {
                      const val = lead.raw_attributes[col.key_name];
                      if (col.key_name === "score") {
                        return (
                          <TableCell key={col.key_name} onClick={(e) => e.stopPropagation()}>
                            <InlineScoreCell
                              initialScore={Number(val || 0)}
                              onSave={(newScore) => onInlineUpdate?.(lead.id, "score", newScore)}
                            />
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={col.key_name} className="text-muted-foreground text-[11px] tabular-nums">
                          {val !== undefined && val !== null && String(val) !== "" ? (
                            <span className="truncate block max-w-[130px]" title={String(val)}>
                              {String(val)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </TableCell>
                      );
                    })}

                    {/* Row Action Dropdown */}
                    <TableCell className="text-right pr-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                            "h-7 w-7 cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 text-xs">
                          <DropdownMenuItem onClick={() => onViewLeadDetails(lead)}>
                            <Eye className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                            <span>View Profile</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onQuickAssignLead(lead)}>
                            <UserCheck className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                            <span>Assign</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  );
}
