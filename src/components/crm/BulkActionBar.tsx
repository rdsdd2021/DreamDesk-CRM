"use client";

import React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserCheck,
  Tag,
  Download,
  Trash2,
  X,
  CheckCircle2,
  Users,
} from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  totalFilteredCount: number;
  isAllFilteredSelected: boolean;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onOpenAssignModal?: () => void;
  onBulkStatusChange: (status: string) => void;
  onBulkDelete?: () => void;
  onExportCsv?: () => void;
}

export function BulkActionBar({
  selectedCount,
  totalFilteredCount,
  isAllFilteredSelected,
  onSelectAllFiltered,
  onClearSelection,
  onOpenAssignModal,
  onBulkStatusChange,
  onBulkDelete,
  onExportCsv,
}: BulkActionBarProps) {
  if (selectedCount === 0 && !isAllFilteredSelected) {
    return null;
  }

  const effectiveCount = isAllFilteredSelected ? totalFilteredCount : selectedCount;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-24px)] animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-card/95 backdrop-blur-md border-2 border-primary/20 shadow-2xl px-4 py-2.5 rounded-2xl overflow-x-auto max-w-full">
        {/* Selection Indicator */}
        <div className="flex items-center gap-2 pr-2 border-r border-border">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <span className="font-bold text-foreground">
              {effectiveCount.toLocaleString()}
            </span>{" "}
            leads selected
          </div>

          {!isAllFilteredSelected && totalFilteredCount > selectedCount && (
            <Button
              variant="link"
              size="sm"
              onClick={onSelectAllFiltered}
              className="text-xs text-primary font-medium p-0 h-auto underline"
            >
              Select all {totalFilteredCount.toLocaleString()} matching
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Bulk Assign Button */}
          {/* Assign Leads (If allowed) */}
          {onOpenAssignModal && (
            <Button
              size="sm"
              onClick={onOpenAssignModal}
              className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assign Leads</span>
            </Button>
          )}

          {/* Change Status Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 gap-1.5 text-xs cursor-pointer"
              )}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Change Status</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-44">
              <DropdownMenuLabel className="text-xs">Select New Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {["New", "Contacted", "Interested", "Follow-up", "Admitted", "Not Interested", "Invalid"].map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onBulkStatusChange(status)}
                  className="text-xs cursor-pointer"
                >
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export CSV (If allowed by RBAC) */}
          {onExportCsv && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </Button>
          )}

          {/* Delete Leads (If allowed by RBAC) */}
          {onBulkDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBulkDelete}
              className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>
          )}

          {/* Clear selection */}
          <button
            onClick={onClearSelection}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted ml-1"
            title="Deselect all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
