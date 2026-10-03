"use client";

import React, { useState, useMemo } from "react";
import { FacetGroup, SchemaMeta, User } from "@/types/crm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  X,
  Search,
  Users,
  Target,
  PhoneCall,
  Layers,
  GraduationCap,
  Sparkles,
  Filter,
  Lock,
} from "lucide-react";

interface FilterSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  facets: FacetGroup[];
  selectedFacets: Record<string, string[]>;
  onFacetToggle: (key: string, value: string) => void;
  onClearAllFilters: () => void;
  schemaMeta: SchemaMeta[];
  totalFilteredCount: number;
  totalCount: number;
  users?: User[];
  isRestrictedCounselor?: boolean;
  isMobileDrawer?: boolean;
  onCloseMobile?: () => void;
}

const STATUS_CONFIG: Record<string, { color: string; dotClass: string }> = {
  New: { color: "#38bdf8", dotClass: "bg-sky-500" },
  Contacted: { color: "#3b82f6", dotClass: "bg-blue-500" },
  Interested: { color: "#10b981", dotClass: "bg-emerald-500" },
  "Follow-up": { color: "#f59e0b", dotClass: "bg-amber-500" },
  Admitted: { color: "#8b5cf6", dotClass: "bg-purple-500" },
  "Not Interested": { color: "#ef4444", dotClass: "bg-rose-500" },
};

export function FilterSidebar({
  collapsed,
  onToggleCollapse,
  facets,
  selectedFacets,
  onFacetToggle,
  onClearAllFilters,
  schemaMeta,
  totalFilteredCount,
  totalCount,
  users = [],
  isRestrictedCounselor = false,
  isMobileDrawer = false,
  onCloseMobile,
}: FilterSidebarProps) {
  // Local state for expanded accordion sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    status: true,
    assigned_to: true,
    campaign_id: true,
    disposition_id: true,
    stream: true,
    city: false,
    school: false,
  });

  // Search query within the filter sidebar
  const [globalFacetSearch, setGlobalFacetSearch] = useState("");
  // In-section search queries
  const [sectionSearches, setSectionSearches] = useState<Record<string, string>>({});
  // Expanded items for facets with > 6 options
  const [expandedOptionLists, setExpandedOptionLists] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key],
    }));
  };

  const toggleShowMore = (key: string) => {
    setExpandedOptionLists((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Compute active filters count and entries
  const activeFilterEntries = useMemo(() => {
    return Object.entries(selectedFacets).filter(
      ([_, values]) => values && values.length > 0
    );
  }, [selectedFacets]);

  const activeFiltersCount = useMemo(() => {
    return activeFilterEntries.reduce((acc, [_, values]) => acc + values.length, 0);
  }, [activeFilterEntries]);

  // Map users for fast color & name lookup
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  // Map schema metadata for labels
  const schemaMap = useMemo(() => {
    const map = new Map<string, SchemaMeta>();
    schemaMeta.forEach((m) => map.set(m.key_name, m));
    return map;
  }, [schemaMeta]);

  // Render individual facet group
  const renderFacetGroup = (facet: FacetGroup, icon?: React.ReactNode) => {
    const key = facet.key_name;
    const isSectionOpen = openSections[key] ?? false;
    const selectedValues = selectedFacets[key] || [];
    const sectionSearch = (sectionSearches[key] || "").toLowerCase().trim();
    const isExpanded = expandedOptionLists[key] ?? false;

    // Filter options by section search and global search
    const filteredOptions = facet.options.filter((opt) => {
      const label = (opt.label || opt.value || "").toLowerCase();
      const matchesSection = !sectionSearch || label.includes(sectionSearch);
      const matchesGlobal =
        !globalFacetSearch ||
        label.includes(globalFacetSearch.toLowerCase()) ||
        facet.display_label.toLowerCase().includes(globalFacetSearch.toLowerCase());
      return matchesSection && matchesGlobal;
    });

    // If global search is active and nothing matches this section, hide it
    if (globalFacetSearch && filteredOptions.length === 0) {
      return null;
    }

    const displayOptions = isExpanded ? filteredOptions : filteredOptions.slice(0, 6);
    const hasMore = filteredOptions.length > 6;

    return (
      <div key={key} className="border-b border-border/60 pb-2.5 last:border-b-0">
        {/* Accordion Header */}
        <button
          onClick={() => toggleSection(key)}
          className="w-full flex items-center justify-between py-1.5 px-1 text-xs font-semibold text-foreground hover:text-primary transition-colors select-none group"
        >
          <div className="flex items-center gap-2 truncate">
            {icon || <Layers className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />}
            <span className="truncate">{facet.display_label}</span>
            {selectedValues.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4.5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold rounded-full"
              >
                {selectedValues.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            {isSectionOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </button>

        {/* Accordion Content */}
        {isSectionOpen && (
          <div className="mt-1.5 space-y-1 pl-1 pr-0.5">
            {/* In-facet search if > 6 options */}
            {facet.options.length > 6 && (
              <div className="relative mb-2">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={`Filter ${facet.display_label.toLowerCase()}...`}
                  value={sectionSearches[key] || ""}
                  onChange={(e) =>
                    setSectionSearches((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                  className="h-6.5 text-[11px] pl-6 pr-2 bg-muted/40 border-border/70 rounded-md"
                />
              </div>
            )}

            {/* Options List */}
            {key === "assigned_to" && isRestrictedCounselor ? (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{displayOptions[0]?.label || "Assigned to You"}</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 shrink-0">
                  {(displayOptions[0]?.count ?? totalCount).toLocaleString()}
                </span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="text-[11px] text-muted-foreground py-2 text-center italic">
                No matching options
              </div>
            ) : (
              <div className="space-y-0.5">
                {displayOptions.map((opt) => {
                  const isChecked = selectedValues.includes(opt.value);
                  const displayLabel = opt.label || opt.value;
                  const statusInfo = key === "status" ? STATUS_CONFIG[opt.value] : null;
                  const counselor = key === "assigned_to" ? userMap.get(opt.value) : null;

                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        "flex items-center justify-between py-1 px-2 rounded-md cursor-pointer text-xs transition-colors group select-none",
                        isChecked
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => onFacetToggle(key, opt.value)}
                          className="h-3.5 w-3.5 rounded"
                        />

                        {/* Status colored dot */}
                        {statusInfo && (
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full shrink-0 shadow-2xs",
                              statusInfo.dotClass
                            )}
                          />
                        )}

                        {/* Counselor colored avatar dot */}
                        {key === "assigned_to" && (
                          <span
                            className="w-2 h-2 rounded-full shrink-0 shadow-2xs"
                            style={{
                              backgroundColor: counselor?.avatar_color || "#94a3b8",
                            }}
                          />
                        )}

                        <span className="truncate group-hover:text-foreground">
                          {displayLabel}
                        </span>
                      </div>

                      {/* Tabular Count Badge */}
                      <span
                        className={cn(
                          "text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0 transition-colors",
                          isChecked
                            ? "bg-primary/20 text-primary font-bold"
                            : "bg-muted/80 text-muted-foreground group-hover:bg-muted font-medium"
                        )}
                      >
                        {opt.count.toLocaleString()}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Show More / Show Less */}
            {hasMore && (
              <button
                onClick={() => toggleShowMore(key)}
                className="w-full text-left text-[11px] font-semibold text-primary hover:underline pt-1 px-2 flex items-center gap-1"
              >
                <span>
                  {isExpanded
                    ? "Show less"
                    : `+${filteredOptions.length - 6} more`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // Group facets into Core & Dynamic
  const statusFacet = facets.find((f) => f.key_name === "status");
  const counselorFacet = facets.find((f) => f.key_name === "assigned_to");
  const campaignFacet = facets.find((f) => f.key_name === "campaign_id");
  const dispositionFacet = facets.find((f) => f.key_name === "disposition_id");

  const coreFacetKeys = new Set(["status", "assigned_to", "campaign_id", "disposition_id"]);
  const dynamicFacets = facets.filter((f) => !coreFacetKeys.has(f.key_name));

  // If mobile drawer, render dedicated full-width container
  if (isMobileDrawer) {
    return (
      <div className="w-full h-full bg-sidebar flex flex-col justify-between select-none">
        {/* Mobile Header */}
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between h-14 shrink-0 bg-sidebar">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-bold text-sm tracking-tight text-foreground truncate">
                Filters & Facets
              </span>
              {activeFiltersCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4.5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold rounded-full shrink-0"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAllFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 rounded-md"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </Button>
            )}

            {onCloseMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCloseMobile}
                className="h-8 px-3 text-xs font-semibold rounded-lg"
              >
                Done
              </Button>
            )}
          </div>
        </div>

        {/* Filter Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* Global Filter Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search all filter criteria..."
              value={globalFacetSearch}
              onChange={(e) => setGlobalFacetSearch(e.target.value)}
              className="h-9 text-xs pl-8 pr-7 bg-card border-border/70 rounded-lg shadow-2xs"
            />
            {globalFacetSearch && (
              <button
                onClick={() => setGlobalFacetSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Filters Pill Tray */}
          {activeFiltersCount > 0 && (
            <div className="p-2.5 rounded-lg bg-card border border-border/70 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-semibold">Active Filters ({activeFiltersCount})</span>
                <button onClick={onClearAllFilters} className="text-destructive hover:underline text-[10px] font-semibold">
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {activeFilterEntries.map(([key, vals]) => {
                  const meta = schemaMeta.find((m) => m.key_name === key);
                  const label =
                    key === "status"
                      ? "Status"
                      : key === "assigned_to"
                      ? "Counselor"
                      : key === "campaign_id"
                      ? "Campaign"
                      : key === "disposition_id"
                      ? "Disposition"
                      : meta?.display_label || key;

                  return vals.map((val) => {
                    const counselor = key === "assigned_to" ? userMap.get(val) : null;
                    const dispVal = counselor ? counselor.name : val === "unassigned" ? "Unassigned" : val;

                    return (
                      <span
                        key={`${key}-${val}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        <span className="opacity-70 font-semibold">{label}:</span>
                        <span className="truncate max-w-[120px] font-bold">{dispVal}</span>
                        <button
                          onClick={() => onFacetToggle(key, val)}
                          className="hover:text-destructive shrink-0 ml-0.5 cursor-pointer"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    );
                  });
                })}
              </div>
            </div>
          )}

          {/* Core Facets Accordions */}
          <div className="space-y-2">
            {statusFacet && renderFacetGroup(statusFacet, <Layers className="w-3.5 h-3.5 text-blue-500" />)}
            {counselorFacet && renderFacetGroup(counselorFacet, <Users className="w-3.5 h-3.5 text-emerald-500" />)}
            {campaignFacet && renderFacetGroup(campaignFacet, <Target className="w-3.5 h-3.5 text-amber-500" />)}
            {dispositionFacet && renderFacetGroup(dispositionFacet, <PhoneCall className="w-3.5 h-3.5 text-rose-500" />)}
          </div>

          {/* Dynamic Custom Fields Accordions */}
          {dynamicFacets.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                Custom Fields
              </div>
              <div className="space-y-2">
                {dynamicFacets.map((facet) => renderFacetGroup(facet, <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Sticky Footer */}
        <div className="p-3 border-t border-border/60 bg-card shrink-0 space-y-2">
          <Button
            onClick={onCloseMobile}
            className="w-full h-11 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm"
          >
            Apply Filters ({totalFilteredCount.toLocaleString()} Leads)
          </Button>
        </div>
      </div>
    );
  }

  // Desktop: If collapsed, display sleek vertical dock strip on the left (hidden on mobile)
  if (collapsed) {
    return (
      <aside
        className="hidden md:flex w-14 border-r border-border/80 bg-sidebar flex-col justify-between transition-all duration-200 shrink-0 z-10 select-none group/collapsed hover:border-primary/40 cursor-pointer"
        onClick={onToggleCollapse}
        title="Expand Filter Panel"
      >
        {/* Top Expand Button */}
        <div className="p-3 border-b border-border/60 flex items-center justify-center h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
            title="Expand Filters"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </Button>
        </div>

        {/* Center Vertical Strip */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-6">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover/collapsed:scale-105 transition-transform shadow-2xs">
              <Filter className="w-4 h-4" />
            </div>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-xs">
                {activeFiltersCount}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <span className="[writing-mode:vertical-lr] text-[10px] uppercase font-bold tracking-widest text-muted-foreground group-hover/collapsed:text-foreground transition-colors">
              FILTERS
            </span>
          </div>
        </div>

        {/* Bottom Filter Count Pill */}
        <div className="p-2 border-t border-border/60 flex flex-col items-center justify-center gap-1 bg-muted/20">
          <span className="text-[9px] font-mono text-muted-foreground text-center font-bold">
            {totalFilteredCount < 1000
              ? totalFilteredCount
              : `${(totalFilteredCount / 1000).toFixed(1)}k`}
          </span>
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground/70">
            Hits
          </span>
        </div>
      </aside>
    );
  }

  // Desktop: Expanded Filter Sidebar (Docked on Left, hidden on mobile)
  return (
    <aside className="hidden md:flex w-72 border-r border-border/80 bg-sidebar flex-col justify-between transition-all duration-200 shrink-0 z-10 select-none shadow-xs">
      {/* Top Header */}
      <div className="p-3.5 border-b border-border/60 flex items-center justify-between h-14 shrink-0 bg-sidebar">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-xs tracking-tight text-foreground truncate">
              Filters & Facets
            </span>
            {activeFiltersCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4.5 px-1.5 text-[10px] bg-primary text-primary-foreground font-bold rounded-full shrink-0"
              >
                {activeFiltersCount}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAllFilters}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 rounded-md"
              title="Reset all active filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md"
            title="Collapse filters (F)"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Filter Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Global Filter Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search all filter criteria..."
            value={globalFacetSearch}
            onChange={(e) => setGlobalFacetSearch(e.target.value)}
            className="h-8 text-xs pl-8 pr-7 bg-card border-border/70 rounded-lg shadow-2xs"
          />
          {globalFacetSearch && (
            <button
              onClick={() => setGlobalFacetSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Active Filters Pill Tray */}
        {activeFiltersCount > 0 && (
          <div className="p-2.5 rounded-lg bg-card border border-border/70 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Applied Filters ({activeFiltersCount})</span>
              <button
                onClick={onClearAllFilters}
                className="text-primary hover:underline lowercase font-medium text-[10px]"
              >
                clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {activeFilterEntries.flatMap(([key, values]) =>
                values.map((val) => {
                  const schema = schemaMap.get(key);
                  const facet = facets.find((f) => f.key_name === key);
                  const opt = facet?.options.find((o) => o.value === val);

                  const label =
                    key === "status"
                      ? "Status"
                      : key === "assigned_to"
                      ? "Counselor"
                      : key === "campaign_id"
                      ? "Campaign"
                      : key === "disposition_id"
                      ? "Disposition"
                      : schema?.display_label || key;

                  const displayVal =
                    opt?.label ||
                    (val === "unassigned" ? "Unassigned" : val === "none" ? "None" : val);

                  return (
                    <Badge
                      key={`${key}-${val}`}
                      variant="secondary"
                      className="h-5 gap-1 px-1.5 text-[10px] bg-muted/80 hover:bg-muted font-normal border border-border/60"
                    >
                      <span className="font-semibold text-muted-foreground truncate max-w-[80px]">
                        {label}:
                      </span>
                      <span className="truncate max-w-[100px] text-foreground font-medium">
                        {displayVal}
                      </span>
                      <button
                        onClick={() => onFacetToggle(key, val)}
                        className="rounded-full hover:bg-background/80 p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Section 1: Core Lead Status */}
        {statusFacet &&
          renderFacetGroup(statusFacet, <Sparkles className="w-3.5 h-3.5 text-sky-500" />)}

        {/* Section 2: Core Assigned Counselor */}
        {counselorFacet &&
          renderFacetGroup(counselorFacet, <Users className="w-3.5 h-3.5 text-blue-500" />)}

        {/* Section 3: Campaign / Channel */}
        {campaignFacet &&
          renderFacetGroup(campaignFacet, <Target className="w-3.5 h-3.5 text-amber-500" />)}

        {/* Section 4: Call Disposition */}
        {dispositionFacet &&
          renderFacetGroup(dispositionFacet, <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />)}

        {/* Section 5: Dynamic Schema Attributes */}
        {dynamicFacets.length > 0 && (
          <div className="pt-2">
            <div className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Dynamic Fields</span>
              <span className="text-[9px] font-mono text-muted-foreground/70">
                {dynamicFacets.length} schemas
              </span>
            </div>
            <div className="space-y-1">
              {dynamicFacets.map((facet) =>
                renderFacetGroup(
                  facet,
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Info */}
      <div className="p-3 border-t border-border/60 bg-muted/20 shrink-0 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground font-medium">Matching Leads:</span>
          <span className="font-mono font-bold text-foreground tabular-nums">
            {totalFilteredCount.toLocaleString()}
          </span>
        </div>

        {totalFilteredCount !== totalCount && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Filtered from {totalCount.toLocaleString()}</span>
            <span className="font-mono text-emerald-600 font-bold">
              {totalCount > 0
                ? `${((totalFilteredCount / totalCount) * 100).toFixed(1)}%`
                : "0%"}
            </span>
          </div>
        )}

        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearAllFilters}
            className="w-full h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 border-dashed border-border/80"
          >
            <RotateCcw className="w-3 h-3 text-red-500" />
            <span>Clear All Filters</span>
          </Button>
        )}
      </div>
    </aside>
  );
}
