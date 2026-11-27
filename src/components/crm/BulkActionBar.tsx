"use client";

import React from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Campaign } from "@/types/crm";
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
  Target,
  Bookmark,
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
  campaigns?: Campaign[];
  onBulkCampaignChange?: (campaignId: string | null) => void;
  onOpenBulkCampaignModal?: () => void;
  onOpenBulkTagsModal?: () => void;
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
  campaigns = [],
  onBulkCampaignChange,
  onOpenBulkCampaignModal,
  onOpenBulkTagsModal,
}: BulkActionBarProps) {
  if (selectedCount === 0 && !isAllFilteredSelected) {
    return null;
  }

  const effectiveCount = isAllFilteredSelected ? totalFilteredCount : selectedCount;

  return (
    <div className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-24px)] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border/80 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.28)] px-3 py-2 rounded-2xl overflow-x-auto max-w-full">
        {/* Selection Pill */}
        <div className="flex items-center gap-2 pr-2.5 border-r border-border/80 shrink-0 whitespace-nowrap">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{effectiveCount.toLocaleString()}</span>
            <span className="font-medium text-primary/80">selected</span>
          </div>

          {!isAllFilteredSelected && totalFilteredCount > selectedCount && (
            <button
              type="button"
              onClick={onSelectAllFiltered}
              className="text-[11px] font-semibold text-primary bg-primary/5 hover:bg-primary/15 border border-primary/20 px-2 py-1 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Select all {totalFilteredCount.toLocaleString()}
            </button>
          )}
        </div>

        {/* Single-Row Action Dock */}
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {onOpenAssignModal && (
            <Button
              size="sm"
              onClick={onOpenAssignModal}
              className="h-8 px-3 gap-1.5 text-xs font-semibold rounded-xl shadow-xs whitespace-nowrap cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assign</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 px-2.5 gap-1.5 text-xs font-medium rounded-xl whitespace-nowrap cursor-pointer"
              )}
            >
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Status</span>
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

          {onOpenBulkCampaignModal ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenBulkCampaignModal}
              className="h-8 px-2.5 gap-1.5 text-xs font-medium rounded-xl whitespace-nowrap cursor-pointer"
            >
              <Target className="w-3.5 h-3.5 text-amber-500" />
              <span>Campaign</span>
            </Button>
          ) : onBulkCampaignChange && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-8 px-2.5 gap-1.5 text-xs font-medium rounded-xl whitespace-nowrap cursor-pointer"
                )}
              >
                <Target className="w-3.5 h-3.5 text-primary" />
                <span>Campaign</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-52 max-h-64 overflow-y-auto">
                <DropdownMenuLabel className="text-xs">Re-attribute to Campaign</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onBulkCampaignChange(null)}
                  className="text-xs text-muted-foreground cursor-pointer italic"
                >
                  None (Clear Campaign)
                </DropdownMenuItem>
                {campaigns.map((camp) => (
                  <DropdownMenuItem
                    key={camp.id}
                    onClick={() => onBulkCampaignChange(camp.id)}
                    className="text-xs cursor-pointer font-medium"
                  >
                    {camp.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {onOpenBulkTagsModal && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenBulkTagsModal}
              className="h-8 px-2.5 gap-1.5 text-xs font-medium rounded-xl whitespace-nowrap cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-primary" />
              <span>Tags</span>
            </Button>
          )}

          {onExportCsv && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              className="h-8 px-2.5 gap-1.5 text-xs font-medium rounded-xl whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Export</span>
            </Button>
          )}

          {onBulkDelete && (
            <>
              <div className="h-5 w-px bg-border/80 mx-0.5 shrink-0" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onBulkDelete}
                className="h-8 px-2.5 gap-1.5 text-xs font-medium rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </Button>
            </>
          )}

          <button
            type="button"
            onClick={onClearSelection}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors ml-0.5 shrink-0 cursor-pointer"
            title="Clear selection"
            aria-label="Clear selection"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
