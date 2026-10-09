"use client";

import React, { useState } from "react";
import { FacetGroup, SchemaMeta, SavedView, WorkQueueId } from "@/types/crm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  X,
  Columns,
  RotateCcw,
  SlidersHorizontal,
  Bookmark,
  Plus,
  Trash2,
  Table as TableIcon,
  Headphones,
  Sparkles,
  Zap,
  Upload,
  GitMerge,
  Layers,
  Clock,
  Flame,
  Inbox,
  PhoneForwarded,
  PhoneOff,
  ChevronDown,
  Rows3,
  LayoutList,
  Keyboard,
} from "lucide-react";

interface UnifiedCommandBarProps {
  // Queue state
  activeQueue: WorkQueueId;
  onSelectQueue: (queue: WorkQueueId) => void;
  unassignedCount: number;
  callbacksCount: number;
  myLeadsCount?: number;
  roleMode: "admin" | "counselor";

  // Search state
  search: string;
  onSearchChange: (val: string) => void;

  // View Mode: Table vs Speed Dialer
  viewMode: "table" | "dialer";
  onToggleViewMode: (mode: "table" | "dialer") => void;

  // Filter Flyout Drawer toggle
  filterDrawerOpen: boolean;
  onToggleFilterDrawer: () => void;
  selectedFacets: Record<string, string[]>;
  onFacetToggle: (key: string, val: string) => void;
  onClearAllFilters: () => void;
  facets: FacetGroup[];

  // Table Display options
  density: "compact" | "comfortable";
  onToggleDensity: () => void;
  visibleColumns: string[];
  onToggleColumnVisibility: (key: string) => void;
  schemaMeta: SchemaMeta[];

  // Saved views
  savedViews: SavedView[];
  onApplySavedView: (view: SavedView) => void;
  onSaveCurrentView: (name: string) => void;
  onDeleteSavedView: (id: string) => void;

  // Admin / Operations Triggers
  onClaimLeads?: () => void;
  claimingLeads?: boolean;
  onAutoDistribute?: () => void;
  isAutoDistributing?: boolean;
  onOpenImport?: () => void;
  onOpenDuplicates?: () => void;
  onGenerateTestData?: () => void;
  onOpenShortcuts?: () => void;
  canManageTeam?: boolean;
}

export function UnifiedCommandBar({
  activeQueue,
  onSelectQueue,
  unassignedCount,
  callbacksCount,
  myLeadsCount,
  roleMode,
  search,
  onSearchChange,
  viewMode,
  onToggleViewMode,
  filterDrawerOpen,
  onToggleFilterDrawer,
  selectedFacets,
  onFacetToggle,
  onClearAllFilters,
  facets,
  density,
  onToggleDensity,
  visibleColumns,
  onToggleColumnVisibility,
  schemaMeta,
  savedViews,
  onApplySavedView,
  onSaveCurrentView,
  onDeleteSavedView,
  onClaimLeads,
  claimingLeads = false,
  onAutoDistribute,
  isAutoDistributing = false,
  onOpenImport,
  onOpenDuplicates,
  onGenerateTestData,
  onOpenShortcuts,
  canManageTeam = false,
}: UnifiedCommandBarProps) {
  const [newViewName, setNewViewName] = useState("");

  // Count active filter pills
  const activeFilterEntries = Object.entries(selectedFacets).filter(
    ([_, values]) => values && values.length > 0
  );
  const activeFiltersCount = activeFilterEntries.reduce(
    (acc, [_, values]) => acc + values.length,
    0
  );

  const queues = [
    {
      id: "all" as WorkQueueId,
      label: roleMode === "counselor" ? "My Leads" : "All Leads",
      icon: Layers,
      count: roleMode === "counselor" && myLeadsCount !== undefined ? myLeadsCount : null,
      shortcut: "1",
    },
    {
      id: "callbacks" as WorkQueueId,
      label: "Urgent Callbacks",
      icon: Clock,
      count: callbacksCount > 0 ? callbacksCount : null,
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      shortcut: "2",
    },
    ...(roleMode !== "counselor"
      ? [
          {
            id: "unassigned" as WorkQueueId,
            label: "Unassigned Pool",
            icon: Inbox,
            count: unassignedCount > 0 ? unassignedCount : null,
            badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
            shortcut: "3",
          },
        ]
      : []),
    {
      id: "high_intent" as WorkQueueId,
      label: "High Intent",
      icon: Flame,
      count: null,
      badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      shortcut: "4",
    },
    {
      id: "followups" as WorkQueueId,
      label: "Follow-up",
      icon: PhoneForwarded,
      count: null,
    },
  ];

  return (
    <div className="space-y-2">
      {/* Main Single-Row Control Ribbon */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 p-2 rounded-xl bg-card border border-border/80 shadow-2xs">
        {/* Left: Queue Segment Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {queues.map((q) => {
            const Icon = q.icon;
            const isActive = activeQueue === q.id;
            return (
              <button
                key={q.id}
                onClick={() => onSelectQueue(q.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
                title={q.shortcut ? `Shortcut: ${q.shortcut}` : undefined}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                <span>{q.label}</span>
                {q.count !== null && q.count !== undefined && (
                  <span
                    className={`ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : q.badgeColor || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {q.count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Center / Right: Search & Action Tools */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
          {/* Universal Search Input */}
          <div className="relative flex-1 sm:w-64 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search leads (/)..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-7 h-8 text-xs rounded-lg bg-background border-border/80 focus-visible:ring-1"
            />
            {search ? (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded border">
                /
              </kbd>
            )}
          </div>

          {/* View Mode Toggle: Table Grid vs Speed Dialer */}
          <div className="flex items-center p-0.5 rounded-lg border border-border/80 bg-muted/40 text-xs shrink-0">
            <button
              onClick={() => onToggleViewMode("table")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table Grid Mode (Spreadsheet view)"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => onToggleViewMode("dialer")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === "dialer"
                  ? "bg-background text-primary shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Speed Dialer Mode (High-velocity telecalling view)"
            >
              <Headphones className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Dialer</span>
            </button>
          </div>

          {/* Filter Flyout Drawer Button with Active Badge */}
          <Button
            variant={filterDrawerOpen || activeFiltersCount > 0 ? "secondary" : "outline"}
            size="sm"
            onClick={onToggleFilterDrawer}
            className={`h-8 text-xs gap-1.5 rounded-lg font-medium cursor-pointer ${
              activeFiltersCount > 0
                ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                : ""
            }`}
            title="Toggle Filter Panel (F)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <Badge
                variant="default"
                className="h-4 px-1 text-[10px] min-w-4 rounded-full bg-primary text-primary-foreground font-bold"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {/* Display Options: Density & Columns */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-medium border border-border/80 bg-background hover:bg-muted rounded-lg cursor-pointer gap-1.5 shadow-2xs"
            >
              <Columns className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden md:inline">Display</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs p-1.5 rounded-xl shadow-xl">
              <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                Row Density
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={onToggleDensity}
                className="gap-2 cursor-pointer text-xs rounded-lg py-1.5 px-2"
              >
                {density === "compact" ? (
                  <Rows3 className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <LayoutList className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span>Density: <strong className="capitalize">{density}</strong></span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                Visible Columns
              </DropdownMenuLabel>
              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {schemaMeta.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key_name}
                    checked={visibleColumns.includes(col.key_name)}
                    onCheckedChange={() => onToggleColumnVisibility(col.key_name)}
                    className="text-xs cursor-pointer rounded-lg py-1 px-2"
                  >
                    {col.display_label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Saved Views Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-medium border border-border/80 bg-background hover:bg-muted rounded-lg cursor-pointer gap-1.5 shadow-2xs"
            >
              <Bookmark className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden xl:inline">Views</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 text-xs p-1.5 rounded-xl shadow-xl">
              <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                Saved Segments
              </DropdownMenuLabel>
              {savedViews.length === 0 ? (
                <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                  No saved views yet.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {savedViews.map((sv) => (
                    <div
                      key={sv.id}
                      className="flex items-center justify-between py-1 px-2 hover:bg-muted rounded-lg group"
                    >
                      <button
                        onClick={() => onApplySavedView(sv)}
                        className="truncate flex-1 text-left font-medium text-xs hover:text-primary cursor-pointer"
                      >
                        {sv.name}
                      </button>
                      <button
                        onClick={() => onDeleteSavedView(sv.id)}
                        className="text-muted-foreground hover:text-rose-600 opacity-0 group-hover:opacity-100 p-0.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <DropdownMenuSeparator className="my-1" />
              <div className="p-1 space-y-1.5">
                <Input
                  placeholder="View name..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  className="w-full h-7 text-xs font-semibold rounded-lg bg-primary text-primary-foreground cursor-pointer"
                  disabled={!newViewName.trim()}
                  onClick={() => {
                    onSaveCurrentView(newViewName.trim());
                    setNewViewName("");
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Save Active View
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Operations Hub (Admin/TL/Counselor Self-service) */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center h-8 px-2.5 text-xs font-semibold border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary rounded-lg cursor-pointer gap-1.5 shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>Actions</span>
              <ChevronDown className="w-3 h-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-xs p-1.5 rounded-xl shadow-xl">
              <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                Queue & Bulk Tools
              </DropdownMenuLabel>
              {roleMode === "counselor" && onClaimLeads && (
                <DropdownMenuItem
                  onClick={onClaimLeads}
                  disabled={claimingLeads}
                  className="gap-2 cursor-pointer text-xs rounded-lg font-semibold text-emerald-600 py-1.5 px-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{claimingLeads ? "Claiming..." : "Claim 25 Fresh Leads"}</span>
                </DropdownMenuItem>
              )}
              {canManageTeam && onAutoDistribute && (
                <DropdownMenuItem
                  onClick={onAutoDistribute}
                  disabled={isAutoDistributing}
                  className="gap-2 cursor-pointer text-xs rounded-lg font-semibold text-primary py-1.5 px-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAutoDistributing ? "Distributing..." : "Auto-Distribute 250 Leads"}</span>
                </DropdownMenuItem>
              )}
              {canManageTeam && onOpenImport && (
                <DropdownMenuItem
                  onClick={onOpenImport}
                  className="gap-2 cursor-pointer text-xs rounded-lg py-1.5 px-2"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Import Leads from CSV</span>
                </DropdownMenuItem>
              )}
              {canManageTeam && onOpenDuplicates && (
                <DropdownMenuItem
                  onClick={onOpenDuplicates}
                  className="gap-2 cursor-pointer text-xs rounded-lg py-1.5 px-2"
                >
                  <GitMerge className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Duplicates Radar & Merge</span>
                </DropdownMenuItem>
              )}
              {canManageTeam && onGenerateTestData && (
                <DropdownMenuItem
                  onClick={onGenerateTestData}
                  className="gap-2 cursor-pointer text-xs rounded-lg py-1.5 px-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Generate +2,500 Test Leads</span>
                </DropdownMenuItem>
              )}
              {onOpenShortcuts && (
                <>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem
                    onClick={onOpenShortcuts}
                    className="gap-2 cursor-pointer text-xs rounded-lg py-1.5 px-2"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Keyboard Hotkeys Cheat Sheet (?)</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active Filters Pill Bar (renders only when filters or search are active) */}
      {(activeFiltersCount > 0 || search) && (
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/30 border border-border/50 text-xs animate-in fade-in duration-150">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Active:</span>

          {search && (
            <Badge
              variant="secondary"
              className="h-6 gap-1.5 pl-2 pr-1 rounded-md text-[11px] bg-background border border-border/80 shadow-2xs font-normal"
            >
              <span>Search: &ldquo;{search}&rdquo;</span>
              <button
                onClick={() => onSearchChange("")}
                className="hover:text-destructive p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {activeFilterEntries.map(([key, values]) => {
            const groupMeta = facets.find((f) => f.key_name === key);
            const label = groupMeta?.display_label || key;
            return values.map((val) => (
              <Badge
                key={`${key}-${val}`}
                variant="secondary"
                className="h-6 gap-1.5 pl-2 pr-1 rounded-md text-[11px] bg-background border border-border/80 shadow-2xs font-normal"
              >
                <span className="text-muted-foreground">{label}:</span>
                <span className="font-semibold text-foreground">{val}</span>
                <button
                  onClick={() => onFacetToggle(key, val)}
                  className="hover:text-destructive p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ));
          })}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAllFilters}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md cursor-pointer ml-auto"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
