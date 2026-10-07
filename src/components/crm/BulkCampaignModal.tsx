"use client";

import React, { useState } from "react";
import { Campaign, TaskPriority, BulkTaskConfig } from "@/types/crm";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, Loader2, Sparkles, CheckCircle2 } from "lucide-react";

interface BulkCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  selectedLeadIds: number[];
  totalFilteredCount: number;
  isAllFilteredSelected: boolean;
  onCampaignApplied: (message: string) => void;
  currentFilterParams?: Record<string, any>;
}

export function BulkCampaignModal({
  isOpen,
  onClose,
  campaigns,
  selectedLeadIds,
  totalFilteredCount,
  isAllFilteredSelected,
  onCampaignApplied,
  currentFilterParams,
}: BulkCampaignModalProps) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  // Task & Caller Notification Engine State
  const [createFollowupTask, setCreateFollowupTask] = useState(true);
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("high");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueHours, setTaskDueHours] = useState(24);

  const effectiveCount = isAllFilteredSelected ? totalFilteredCount : selectedLeadIds.length;

  const selectedCampaignName =
    selectedCampaignId === "none"
      ? "None / Unassigned"
      : campaigns.find((c) => c.id === selectedCampaignId)?.name || "Selected Campaign";

  const handleSubmit = async () => {
    setSubmitting(true);
    const taskConfigPayload: BulkTaskConfig | undefined = createFollowupTask
      ? {
          create_task: true,
          title: taskTitle.trim() || `Campaign Outreach: ${selectedCampaignName}`,
          priority: taskPriority,
          due_in_hours: taskDueHours,
        }
      : undefined;

    try {
      const res = await fetch("/api/leads/bulk-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_ids: isAllFilteredSelected ? undefined : selectedLeadIds,
          apply_to_all_filtered: isAllFilteredSelected,
          filter_params: currentFilterParams,
          campaign_id: selectedCampaignId === "none" ? null : selectedCampaignId,
          task_config: taskConfigPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update campaign");

      onCampaignApplied(data.message || "Campaign updated successfully!");
      onClose();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !submitting && !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-5 sm:p-6 gap-4">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Target className="w-4 h-4" />
            </div>
            <DialogTitle className="text-base font-bold text-foreground">
              Bulk Campaign Re-attribution
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Re-assign marketing attribution across{" "}
            <span className="font-semibold text-foreground">
              {effectiveCount.toLocaleString()} leads
            </span>
            {isAllFilteredSelected && " (all filtered)"}.
          </DialogDescription>
        </DialogHeader>

        {/* Campaign Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            Select Destination Campaign
          </label>
          <Select
            value={selectedCampaignId}
            onValueChange={(val) => {
              const safeVal = val || "none";
              setSelectedCampaignId(safeVal);
              const camp = campaigns.find((c) => c.id === safeVal);
              if (camp) {
                setTaskTitle(`Campaign Outreach: ${camp.name}`);
              }
            }}
          >
            <SelectTrigger className="w-full text-xs h-9 bg-background">
              <SelectValue placeholder="Select Campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Clear Campaign Attribution)</SelectItem>
              {campaigns.map((camp) => (
                <SelectItem key={camp.id} value={camp.id}>
                  {camp.name} ({camp.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Task Scheduling & Priority for Callers */}
        <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-task-campaign"
                checked={createFollowupTask}
                onCheckedChange={(c) => setCreateFollowupTask(Boolean(c))}
              />
              <label
                htmlFor="create-task-campaign"
                className="text-xs font-bold text-foreground cursor-pointer select-none flex items-center gap-1.5"
              >
                <span>🔔 Schedule Tasks for Assigned Callers</span>
              </label>
            </div>
            {createFollowupTask && (
              <Badge variant="outline" className="text-[10px] font-mono capitalize">
                {taskPriority}
              </Badge>
            )}
          </div>

          {createFollowupTask && (
            <div className="space-y-2 pt-1 border-t border-border/40">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Task Title / Outreach Brief
                </label>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder={`Campaign Outreach: ${selectedCampaignName}`}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { key: "urgent", label: "Urgent", color: "text-red-600 border-red-500/40 bg-red-500/10" },
                      { key: "high", label: "High", color: "text-amber-600 border-amber-500/40 bg-amber-500/10" },
                      { key: "normal", label: "Normal", color: "text-blue-600 border-blue-500/40 bg-blue-500/10" },
                      { key: "low", label: "Low", color: "text-zinc-600 border-zinc-500/40 bg-zinc-500/10" },
                    ].map((p) => (
                      <button
                        type="button"
                        key={p.key}
                        onClick={() => setTaskPriority(p.key as TaskPriority)}
                        className={`py-1 text-[10px] font-semibold rounded-md border text-center transition-all ${
                          taskPriority === p.key
                            ? `${p.color} ring-1 ring-primary/40 font-bold`
                            : "border-border/60 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    Due SLA Timeframe
                  </label>
                  <select
                    value={taskDueHours}
                    onChange={(e) => setTaskDueHours(parseInt(e.target.value, 10))}
                    className="w-full h-7 rounded-md border border-border/80 bg-background px-2 text-[11px] text-foreground focus:outline-none"
                  >
                    <option value={4}>4 Hours (Immediate)</option>
                    <option value={12}>12 Hours (Same Day)</option>
                    <option value={24}>24 Hours (Next Day)</option>
                    <option value={48}>48 Hours (2 Days)</option>
                    <option value={72}>72 Hours (3 Days)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
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
            disabled={submitting}
            className="text-xs font-bold h-9 px-4 rounded-xl gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Apply Campaign</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
