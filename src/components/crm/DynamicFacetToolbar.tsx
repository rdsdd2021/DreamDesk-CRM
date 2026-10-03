"use client";

import React, { useState } from "react";
import { FacetGroup, SchemaMeta, SavedView } from "@/types/crm";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { Search, X, Columns, RotateCcw, Keyboard, Rows3, LayoutList, SlidersHorizontal, Bookmark, Plus, Trash2 } from "lucide-react";

interface DynamicFacetToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  facets: FacetGroup[];
  selectedFacets: Record<string, string[]>;
  onFacetToggle: (key: string, value: string) => void;
  onClearAllFilters: () => void;
  schemaMeta: SchemaMeta[];
  visibleColumns: string[];
  onToggleColumnVisibility: (key: string) => void;
  totalFilteredCount: number;
  totalCount: number;
  density?: "compact" | "comfortable";
  onToggleDensity?: () => void;
  onOpenShortcuts?: () => void;
  filterSidebarOpen?: boolean;
  onToggleFilterSidebar?: () => void;
  savedViews?: SavedView[];
  onApplySavedView?: (view: SavedView) => void;
  onSaveCurrentView?: (name: string) => void;
  onDeleteSavedView?: (id: string) => void;
}

export function DynamicFacetToolbar({
  search,
  onSearchChange,
  facets,
  selectedFacets,
  onFacetToggle,
  onClearAllFilters,
  schemaMeta,
  visibleColumns,
  onToggleColumnVisibility,
  totalFilteredCount,
  totalCount,
  density = "comfortable",
  onToggleDensity,
  onOpenShortcuts,
  filterSidebarOpen = true,
  onToggleFilterSidebar,
  savedViews = [],
  onApplySavedView,
  onSaveCurrentView,
  onDeleteSavedView,
}: DynamicFacetToolbarProps) {
  const [newViewName, setNewViewName] = useState("");
  // Compute active filters count
  const activeFilterEntries = Object.entries(selectedFacets).filter(
    ([_, values]) => values && values.length > 0
  );
  const activeFiltersCount = activeFilterEntries.reduce(
    (acc, [_, values]) => acc + values.length,
    0
  );

  return (
    <div className="space-y-3 bg-card border rounded-xl p-4 shadow-xs">
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[260px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, phone, school, code..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm rounded-lg bg-background"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Toolbar Controls (Filter Toggle, Column Picker, Density, Shortcuts, Reset) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Left Filter Sidebar Toggle Button */}
          {onToggleFilterSidebar && (
            <Button
              variant={filterSidebarOpen ? "secondary" : "outline"}
              size="sm"
              onClick={onToggleFilterSidebar}
              className={cn(
                "h-9 px-3 gap-1.5 text-xs font-semibold cursor-pointer transition-all",
                filterSidebarOpen
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
                  : "text-foreground hover:bg-accent border-border/80"
              )}
              title={filterSidebarOpen ? "Collapse Filter Panel (F)" : "Open Filter Panel (F)"}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-0.5 h-4.5 px-1.5 text-[10px] font-bold rounded-full",
                    filterSidebarOpen
                      ? "bg-primary-foreground text-primary"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          )}

          {/* Saved Views Preset Selector */}
          {savedViews && onApplySavedView && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                )}
              >
                <Bookmark className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Views</span>
                {savedViews.length > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded-full font-semibold">
                    {savedViews.length}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 text-xs">
                <DropdownMenuLabel className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Saved Filter Views
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {savedViews.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    No saved views yet. Save your favorite filter combination below.
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    {savedViews.map((view) => (
                      <div
                        key={view.id}
                        className="flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer group"
                      >
                        <button
                          type="button"
                          className="flex-1 text-left truncate flex items-center gap-2"
                          onClick={() => onApplySavedView(view)}
                        >
                          <Bookmark className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                          <span className="truncate font-medium">{view.name}</span>
                        </button>
                        {onDeleteSavedView && !view.is_default && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSavedView(view.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-opacity"
                            title="Delete saved view"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <DropdownMenuSeparator />
                {/* Inline Save View input */}
                <div className="p-2 space-y-1.5">
                  <Input
                    placeholder="Name this view..."
                    value={newViewName}
                    onChange={(e) => setNewViewName(e.target.value)}
                    className="h-7 text-xs bg-muted/30"
                  />
                  <Button
                    size="sm"
                    disabled={!newViewName.trim()}
                    onClick={() => {
                      if (newViewName.trim() && onSaveCurrentView) {
                        onSaveCurrentView(newViewName.trim());
                        setNewViewName("");
                      }
                    }}
                    className="w-full h-7 text-xs gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Save Current Filters</span>
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Column Visibility Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 px-3 gap-1.5 text-xs text-muted-foreground cursor-pointer"
              )}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Columns</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">Customize Table Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-64 overflow-y-auto">
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.includes("lead_code")}
                  onCheckedChange={() => onToggleColumnVisibility("lead_code")}
                  className="text-xs"
                >
                  Lead Code
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.includes("name")}
                  onCheckedChange={() => onToggleColumnVisibility("name")}
                  className="text-xs"
                >
                  Student Name
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.includes("phone")}
                  onCheckedChange={() => onToggleColumnVisibility("phone")}
                  className="text-xs"
                >
                  Contact Phone
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.includes("status")}
                  onCheckedChange={() => onToggleColumnVisibility("status")}
                  className="text-xs"
                >
                  Status
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.includes("assigned_to")}
                  onCheckedChange={() => onToggleColumnVisibility("assigned_to")}
                  className="text-xs"
                >
                  Assigned Counselor
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.includes("disposition")}
                  onCheckedChange={() => onToggleColumnVisibility("disposition")}
                  className="text-xs"
                >
                  Call Disposition
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={visibleColumns.includes("campaign")}
                  onCheckedChange={() => onToggleColumnVisibility("campaign")}
                  className="text-xs"
                >
                  Campaign / Source
                </DropdownMenuCheckboxItem>

                {schemaMeta.map((meta) => (
                  <DropdownMenuCheckboxItem
                    key={meta.key_name}
                    checked={visibleColumns.includes(meta.key_name)}
                    onCheckedChange={() => onToggleColumnVisibility(meta.key_name)}
                    className="text-xs"
                  >
                    {meta.display_label} (Dynamic)
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Density Toggle Button */}
          {onToggleDensity && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleDensity}
              className="h-9 px-2.5 text-xs gap-1.5 bg-background border-border/80 text-muted-foreground hover:text-foreground"
              title={`Toggle Table Density (Currently ${density})`}
            >
              {density === "compact" ? (
                <>
                  <LayoutList className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Compact</span>
                </>
              ) : (
                <>
                  <Rows3 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Comfortable</span>
                </>
              )}
            </Button>
          )}

          {/* Keyboard Shortcuts Button */}
          {onOpenShortcuts && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenShortcuts}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 bg-background border-border/80"
              title="Keyboard Shortcuts Cheat Sheet (?)"
            >
              <Keyboard className="w-3.5 h-3.5 text-primary" />
              <span className="hidden md:inline text-[11px] font-mono text-muted-foreground">?</span>
            </Button>
          )}

          {/* Clear All Filters Button */}
          {(activeFiltersCount > 0 || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAllFilters}
              className="h-9 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t text-xs">
          <span className="text-muted-foreground text-[11px] font-medium mr-1">
            Active Filters ({activeFiltersCount}):
          </span>
          {activeFilterEntries.flatMap(([key, values]) =>
            values.map((val) => {
              const label =
                key === "status"
                  ? "Status"
                  : key === "assigned_to"
                  ? "Counselor"
                  : key === "campaign_id"
                  ? "Campaign"
                  : key === "disposition_id"
                  ? "Disposition"
                  : schemaMeta.find((m) => m.key_name === key)?.display_label || key;

              const facetGroup = facets.find((f) => f.key_name === key);
              const opt = facetGroup?.options.find((o) => o.value === val);
              const displayVal = opt?.label || (val === "unassigned" ? "Unassigned" : val === "none" ? "None" : val);

              return (
                <Badge
                  key={`${key}-${val}`}
                  variant="secondary"
                  className="h-6 gap-1 px-2 text-[11px] bg-accent/80 hover:bg-accent font-normal border"
                >
                  <span className="font-semibold text-muted-foreground">{label}:</span>
                  <span>{displayVal}</span>
                  <button
                    onClick={() => onFacetToggle(key, val)}
                    className="ml-0.5 rounded-full hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })
          )}
        </div>
      )}

      {/* Count Status Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
        <div>
          Showing <span className="font-semibold text-foreground">{totalFilteredCount.toLocaleString()}</span> matching leads
          {totalFilteredCount !== totalCount && (
            <span> (filtered from <span className="font-semibold text-foreground">{totalCount.toLocaleString()}</span> total)</span>
          )}
        </div>
      </div>
    </div>
  );
}
