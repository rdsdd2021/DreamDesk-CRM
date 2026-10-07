"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bookmark, Plus, X, Tag as TagIcon, CheckCircle2, Sparkles } from "lucide-react";

interface BulkTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeadIds: number[];
  totalFilteredCount: number;
  isAllFilteredSelected: boolean;
  onTagsApplied: (message: string) => void;
  currentFilterParams?: Record<string, any>;
}

const PRESET_TAGS = [
  "High Priority",
  "Hostel Required",
  "Fee Sensitive",
  "Scholarship",
  "VIP Referral",
  "Local Candidate",
  "Parent Decision",
  "Document Pending",
  "Exam Cleared",
  "Merit Candidate",
];

export function BulkTagsModal({
  isOpen,
  onClose,
  selectedLeadIds,
  totalFilteredCount,
  isAllFilteredSelected,
  onTagsApplied,
  currentFilterParams,
}: BulkTagsModalProps) {
  const [action, setAction] = useState<"add" | "remove">("add");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const effectiveCount = isAllFilteredSelected ? totalFilteredCount : selectedLeadIds.length;

  const handleTogglePreset = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customTagInput.trim();
    if (!clean) return;
    if (!selectedTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      setSelectedTags((prev) => [...prev, clean]);
    }
    setCustomTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (selectedTags.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads/bulk-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_ids: isAllFilteredSelected ? undefined : selectedLeadIds,
          apply_to_all_filtered: isAllFilteredSelected,
          filter_params: currentFilterParams,
          action,
          tags: selectedTags,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update tags");

      onTagsApplied(data.message || "Tags updated successfully!");
      setSelectedTags([]);
      onClose();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-5 sm:p-6 gap-4">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Bookmark className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Manage Tags in Bulk
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Apply or remove operational tags across{" "}
            <span className="font-semibold text-foreground">
              {effectiveCount.toLocaleString()} {effectiveCount === 1 ? "lead" : "leads"}
            </span>
            {isAllFilteredSelected && " (all matching active filters)"}.
          </DialogDescription>
        </DialogHeader>

        {/* Action Toggle (Add vs Remove) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Select Tag Operation</label>
          <Tabs value={action} onValueChange={(v) => setAction(v as any)} className="w-full">
            <TabsList className="grid grid-cols-2 h-9 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="add" className="text-xs font-semibold rounded-lg">
                Add Tags to Selected
              </TabsTrigger>
              <TabsTrigger value="remove" className="text-xs font-semibold rounded-lg">
                Remove Tags from Selected
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Selected Tags Pills */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Tags to {action === "add" ? "Attach" : "Remove"} ({selectedTags.length})</span>
            {selectedTags.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-[11px] text-muted-foreground hover:text-foreground font-medium"
              >
                Clear all
              </button>
            )}
          </label>
          <div className="min-h-[44px] p-2 bg-muted/30 border border-border/70 rounded-xl flex flex-wrap gap-1.5 items-center">
            {selectedTags.length === 0 ? (
              <span className="text-xs text-muted-foreground italic px-1">
                Select preset tags below or type custom tag...
              </span>
            ) : (
              selectedTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs font-medium pl-2.5 pr-1 py-1 gap-1 rounded-lg bg-background border border-border/80 shadow-2xs"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:bg-muted p-0.5 rounded-full text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Custom Tag Input */}
        <form onSubmit={handleAddCustomTag} className="flex gap-2">
          <Input
            placeholder="Type custom tag name and press Enter..."
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            className="h-9 text-xs rounded-xl bg-background border-border/80 focus-visible:ring-primary/20"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!customTagInput.trim()}
            className="h-9 px-3 text-xs font-semibold rounded-xl gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </Button>
        </form>

        {/* Popular Presets */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" />
            <span>Quick Suggestions</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            {PRESET_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTogglePreset(tag)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-muted/40 hover:bg-muted text-foreground border-border/70"
                  }`}
                >
                  {isSelected ? <CheckCircle2 className="w-3 h-3" /> : <Plus className="w-3 h-3 opacity-60" />}
                  <span>{tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="pt-2 sm:pt-3 border-t border-border/70 flex sm:justify-between items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="text-xs h-9 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || selectedTags.length === 0}
            className="text-xs font-bold h-9 px-4 rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>
              {submitting
                ? "Applying..."
                : `${action === "add" ? "Attach" : "Remove"} ${selectedTags.length} ${selectedTags.length === 1 ? "Tag" : "Tags"}`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
