"use client";

import React, { useState, useRef } from "react";
import { User, BulkAssignRequest, FilterParams, TaskPriority } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Shuffle,
  Sliders,
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Pause,
  Play,
  RotateCcw,
  Zap,
  Clock,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { BatchController, runBatchOperation, BatchProgress } from "@/lib/utils/batchRunner";
import { ApiClient } from "@/lib/api/apiClient";

interface BulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  selectedLeadIds: number[];
  totalFilteredCount: number;
  isAllFilteredSelected: boolean;
  currentFilterParams: FilterParams;
  currentUser?: User | null;
  onAssignComplete: (affected: number, message: string) => void;
}

export function BulkAssignModal({
  isOpen,
  onClose,
  users,
  selectedLeadIds,
  totalFilteredCount,
  isAllFilteredSelected,
  currentFilterParams,
  currentUser,
  onAssignComplete,
}: BulkAssignModalProps) {
  // Modal View Mode: "config" (select options) or "cockpit" (live execution & progress)
  const [viewMode, setViewMode] = useState<"config" | "cockpit">("config");

  const [activeTab, setActiveTab] = useState<"auto" | "quota" | "single">("auto");
  const [loading, setLoading] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Policy Override State
  const isPrivileged = currentUser?.role === "admin" || currentUser?.role === "team_lead";
  const [overridePolicy, setOverridePolicy] = useState<boolean>(true);

  // Task & Notification Engine State
  const [createFollowupTask, setCreateFollowupTask] = useState<boolean>(true);
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("normal");
  const [taskTitle, setTaskTitle] = useState<string>("Follow up with newly assigned student applicant");
  const [taskDueHours, setTaskDueHours] = useState<number>(24);

  // Available leads to assign
  const availableCount = isAllFilteredSelected ? totalFilteredCount : selectedLeadIds.length;

  // Auto-Balance State
  const [selectedCounselorIds, setSelectedCounselorIds] = useState<string[]>(
    users.map((u) => u.id)
  );
  const [autoAssignType, setAutoAssignType] = useState<"all" | "custom">("all");
  const [autoCustomCount, setAutoCustomCount] = useState<number>(
    Math.min(5000, availableCount)
  );

  // Quota-Based State
  const [quotas, setQuotas] = useState<Record<string, number>>({});

  // Single Counselor State
  const [singleUserId, setSingleUserId] = useState<string>(users[0]?.id || "");
  const [singleAssignType, setSingleAssignType] = useState<"all" | "custom">("all");
  const [singleCustomCount, setSingleCustomCount] = useState<number>(
    Math.min(1000, availableCount)
  );

  // Live Batch Processing State
  const batchControllerRef = useRef<BatchController | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [targetIdsCache, setTargetIdsCache] = useState<number[]>([]);
  const [progress, setProgress] = useState<BatchProgress>({
    processedCount: 0,
    totalCount: 0,
    percent: 0,
    currentBatchIndex: 0,
    totalBatches: 0,
    speedLeadsPerSec: 0,
    estimatedSecondsRemaining: 0,
    elapsedSeconds: 0,
    counselorTally: {},
    skippedLockedCount: 0,
    status: "idle",
  });

  // Calculations
  const effectiveAutoCount =
    autoAssignType === "all" ? availableCount : Math.min(autoCustomCount || 0, availableCount);
  const perCounselorCount =
    selectedCounselorIds.length > 0
      ? Math.floor(effectiveAutoCount / selectedCounselorIds.length)
      : 0;
  const remainderCount =
    selectedCounselorIds.length > 0
      ? effectiveAutoCount % selectedCounselorIds.length
      : 0;

  const totalQuotaAllocated = Object.values(quotas).reduce((a, b) => a + (b || 0), 0);
  const quotaPercent = Math.min(100, Math.round((totalQuotaAllocated / (availableCount || 1)) * 100));

  const toggleCounselorSelection = (userId: string) => {
    setSelectedCounselorIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllCounselors = () => {
    if (selectedCounselorIds.length === users.length) {
      setSelectedCounselorIds([]);
    } else {
      setSelectedCounselorIds(users.map((u) => u.id));
    }
  };

  const handleQuotaChange = (userId: string, value: string) => {
    const num = parseInt(value, 10);
    setQuotas((prev) => ({
      ...prev,
      [userId]: isNaN(num) ? 0 : Math.max(0, num),
    }));
  };

  // Safe Close Guard
  const handleModalClose = () => {
    if (progress.status === "running") {
      if (confirm("Allocation is actively processing. Are you sure you want to stop?")) {
        batchControllerRef.current?.cancel();
        onClose();
      }
      return;
    }
    setViewMode("config");
    setErrorMessage(null);
    onClose();
  };

  // Launch Chunked Lead Allocation
  const handleStartAllocation = async () => {
    setErrorMessage(null);

    // Validation
    if (activeTab === "auto" && selectedCounselorIds.length === 0) {
      setErrorMessage("Please select at least one counselor to distribute leads.");
      return;
    }
    if (activeTab === "quota" && totalQuotaAllocated === 0) {
      setErrorMessage("Please specify a quota greater than 0 for at least one counselor.");
      return;
    }
    if (activeTab === "single" && !singleUserId) {
      setErrorMessage("Please select a counselor to assign leads to.");
      return;
    }

    setLoading(true);
    setLoadingStatusText("Resolving target lead cohort...");

    try {
      let finalTargetIds: number[] = [];

      if (!isAllFilteredSelected) {
        finalTargetIds = [...selectedLeadIds];
      } else {
        // Query IDs of all matching filtered leads
        const requestedLimit =
          activeTab === "auto" && autoAssignType === "custom"
            ? autoCustomCount
            : activeTab === "single" && singleAssignType === "custom"
            ? singleCustomCount
            : activeTab === "quota"
            ? totalQuotaAllocated
            : undefined;

        const res = await ApiClient.fetchJson<{ leadIds: number[] }>("/api/leads/target-ids", {
          method: "POST",
          body: JSON.stringify({
            filter_params: currentFilterParams,
            limit: requestedLimit,
          }),
        });

        if (res.error || !res.data) {
          throw new Error(res.error?.message || "Failed to resolve target leads.");
        }
        finalTargetIds = res.data.leadIds;
      }

      if (finalTargetIds.length === 0) {
        throw new Error("No matching leads found for assignment.");
      }

      setTargetIdsCache(finalTargetIds);
      setLoading(false);
      setViewMode("cockpit");

      // Initialize initial counselor tally
      const initialTally: Record<string, number> = {};
      users.forEach((u) => {
        initialTally[u.id] = 0;
      });

      const controller = new BatchController();
      batchControllerRef.current = controller;
      setIsPaused(false);

      // Execute Chunked Assignment (350 leads per batch for optimal 40ms SQLite WAL transactions)
      const batchResult = await runBatchOperation(
        {
          items: finalTargetIds,
          chunkSize: 350,
          initialCounselorTally: initialTally,
          onProgress: (p) => setProgress(p),
          processChunk: async (chunkIds) => {
            const payload: BulkAssignRequest = {
              mode: activeTab,
              selected_user_ids: activeTab === "auto" ? selectedCounselorIds : undefined,
              user_quotas: activeTab === "quota" ? quotas : undefined,
              single_user_id: activeTab === "single" ? singleUserId : undefined,
              lead_ids: chunkIds,
              apply_to_all_filtered: false,
              override_policy: overridePolicy,
              task_config: createFollowupTask
                ? {
                    create_task: true,
                    title: taskTitle.trim() || "Follow up with newly assigned student applicant",
                    priority: taskPriority,
                    due_in_hours: taskDueHours,
                  }
                : undefined,
            };

            const chunkRes = await ApiClient.fetchJson<any>("/api/leads/bulk-assign", {
              method: "POST",
              body: JSON.stringify(payload),
            });

            if (chunkRes.error || !chunkRes.data) {
              throw new Error(chunkRes.error?.message || "Chunk assignment failed");
            }

            return {
              affectedCount: chunkRes.data.affectedCount || 0,
              skippedLockedCount: chunkRes.data.skippedLockedCount || 0,
              counselorTally: chunkRes.data.counselorTally || {},
              message: chunkRes.data.message,
            };
          },
        },
        controller
      );

      if (!batchResult.success && batchResult.error) {
        setErrorMessage(batchResult.error);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to start bulk assignment");
      setLoading(false);
    }
  };

  const handlePauseToggle = () => {
    if (!batchControllerRef.current) return;
    if (isPaused) {
      batchControllerRef.current.resume();
      setIsPaused(false);
      setProgress((prev) => ({ ...prev, status: "running" }));
    } else {
      batchControllerRef.current.pause();
      setIsPaused(true);
      setProgress((prev) => ({ ...prev, status: "paused" }));
    }
  };

  const handleStopSafely = () => {
    if (confirm("Stop assignment? Leads processed so far will remain assigned.")) {
      batchControllerRef.current?.cancel();
    }
  };

  const handleDone = () => {
    const msg = `Successfully allocated ${progress.processedCount.toLocaleString()} student leads.`;
    onAssignComplete(progress.processedCount, msg);
    setViewMode("config");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleModalClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border border-border/80 shadow-2xl rounded-xl">
        {/* ========================================================================= */}
        {/* VIEW 1: LIVE ALLOCATION COCKPIT (PROGRESS & TELEMETRY)                    */}
        {/* ========================================================================= */}
        {viewMode === "cockpit" ? (
          <div className="flex flex-col">
            {/* Header */}
            <div className="p-3.5 pb-2.5 bg-muted/40 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                  <Zap className="w-4 h-4" />
                  <span>Real-Time Allocation Cockpit</span>
                </div>
                <Badge
                  variant={
                    progress.status === "completed"
                      ? "default"
                      : progress.status === "error"
                      ? "destructive"
                      : "outline"
                  }
                  className="text-[11px] font-mono"
                >
                  {progress.status === "completed"
                    ? "Complete"
                    : progress.status === "error"
                    ? "Attention Needed"
                    : progress.status === "paused"
                    ? "Paused"
                    : `Batch ${progress.currentBatchIndex} of ${progress.totalBatches}`}
                </Badge>
              </div>

              <DialogTitle className="text-lg font-bold text-foreground mt-1">
                {progress.status === "completed"
                  ? "Lead Allocation Complete!"
                  : progress.status === "error"
                  ? "Allocation Paused on Error"
                  : progress.status === "paused"
                  ? "Allocation Paused"
                  : "Allocating Student Leads..."}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Distributing <strong className="text-foreground">{progress.totalCount.toLocaleString()} leads</strong> across {users.length} counselors in real-time.
              </DialogDescription>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {/* Progress Bar & Percentage */}
              <div className="p-4 rounded-xl border border-border/80 bg-card shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    {progress.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : progress.status === "error" ? (
                      <XCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    <span>
                      {progress.processedCount.toLocaleString()} of {progress.totalCount.toLocaleString()} leads processed
                    </span>
                  </span>
                  <span className="text-sm font-bold font-mono text-primary">{progress.percent}%</span>
                </div>

                <Progress value={progress.percent} className="h-3 rounded-full" />

                {/* Telemetry Stats Strip */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-muted-foreground">
                  <div className="bg-muted/40 p-2 rounded-lg border border-border/50 text-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Speed</div>
                    <div className="text-xs font-bold font-mono text-foreground mt-0.5">
                      {progress.speedLeadsPerSec} leads/s
                    </div>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-lg border border-border/50 text-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Elapsed</div>
                    <div className="text-xs font-bold font-mono text-foreground mt-0.5">
                      {progress.elapsedSeconds}s
                    </div>
                  </div>
                  <div className="bg-muted/40 p-2 rounded-lg border border-border/50 text-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">ETA</div>
                    <div className="text-xs font-bold font-mono text-foreground mt-0.5">
                      {progress.status === "completed"
                        ? "0s"
                        : progress.estimatedSecondsRemaining > 0
                        ? `~${progress.estimatedSecondsRemaining}s`
                        : "Calculating..."}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Recovery Card (if error encountered) */}
              {progress.status === "error" && (
                <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Processing Interrupted: {progress.errorMessage}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {progress.processedCount.toLocaleString()} leads have been safely committed. You can retry the failed batch or conclude the operation now.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleStartAllocation()}
                      className="text-xs font-semibold gap-1.5 h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Failed Batch</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDone}
                      className="text-xs font-medium h-8"
                    >
                      Finish with Current Leads ({progress.processedCount})
                    </Button>
                  </div>
                </div>
              )}

              {/* Live Counselor Tally Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>Counselor Allocation Counters</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">Real-time breakdown</span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                  {users
                    .filter((u) => {
                      if (activeTab === "single") return u.id === singleUserId;
                      if (activeTab === "quota") return (quotas[u.id] || 0) > 0;
                      return selectedCounselorIds.includes(u.id);
                    })
                    .map((counselor) => {
                      const count = progress.counselorTally[counselor.id] || 0;
                      return (
                        <div
                          key={counselor.id}
                          className="p-2.5 rounded-xl border border-border/70 bg-card flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-2xs"
                              style={{ backgroundColor: counselor.avatar_color || "#3b82f6" }}
                            >
                              {counselor.name.charAt(0)}
                            </div>
                            <span className="font-medium text-foreground truncate">{counselor.name}</span>
                          </div>
                          <Badge variant="secondary" className="font-mono text-xs font-bold text-primary">
                            +{count.toLocaleString()}
                          </Badge>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 7-Day Policy Lock Protection Tally */}
              <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-medium">
                  <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>7-Day Call Lock Policy Status:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-foreground font-semibold">
                    {(progress.processedCount - progress.skippedLockedCount).toLocaleString()} Assigned
                  </span>
                  {progress.skippedLockedCount > 0 && (
                    <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300 border-amber-500/30">
                      {progress.skippedLockedCount} Preserved
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Cockpit Action Footer */}
            <div className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between">
              {progress.status === "completed" ? (
                <Button
                  onClick={handleDone}
                  className="w-full text-xs font-semibold h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done & Refresh ({progress.processedCount.toLocaleString()} Leads Assigned)</span>
                </Button>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePauseToggle}
                      disabled={progress.status === "error"}
                      className="text-xs h-8 font-medium gap-1.5"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{isPaused ? "Resume" : "Pause"}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStopSafely}
                      className="text-xs h-8 text-destructive hover:bg-destructive/10"
                    >
                      Stop Safely
                    </Button>
                  </div>

                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span>Processing chunk in SQLite...</span>
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: ALLOCATION CONFIGURATION FORM                                     */
          /* ========================================================================= */
          <>
            <DialogHeader className="p-3.5 pb-2.5 bg-muted/40 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                    Bulk Lead Allocation
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Targeting <span className="font-semibold text-foreground">{availableCount.toLocaleString()} leads</span>
                    {isAllFilteredSelected ? " (all matching leads in current query)" : " selected from table"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {errorMessage && (
              <div className="mx-4 mt-3 p-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="font-medium">{errorMessage}</span>
              </div>
            )}

            {/* 7-Day Counselor Ownership Protection Notice */}
            <div className="mx-4 mt-2.5 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>7-Day Counselor Ownership Policy Protection Active</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Leads with recorded calls or dispositions in the last 7 days are protected from reassignment.
                {isPrivileged
                  ? " As an Administrator or Admissions Team Leader, you can choose whether to override this lock for target leads."
                  : " Protected leads will be automatically skipped from reassignment to safeguard counselor effort."}
              </p>
              {isPrivileged && (
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <Checkbox
                    checked={overridePolicy}
                    onCheckedChange={(c) => setOverridePolicy(Boolean(c))}
                  />
                  <span className="text-[11px] font-semibold text-foreground">
                    Override 7-day call lock for protected leads (generates audit trail entries)
                  </span>
                </label>
              )}
            </div>

            <div className="p-5 overflow-y-auto max-h-[65vh]">
              <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  setActiveTab(v as any);
                  setErrorMessage(null);
                }}
              >
                <TabsList className="grid grid-cols-3 mb-4 h-10 p-1 bg-muted/60 rounded-xl">
                  <TabsTrigger value="auto" className="text-xs gap-1.5 font-semibold rounded-lg">
                    <Shuffle className="w-3.5 h-3.5 text-primary" />
                    <span>Auto Balance</span>
                  </TabsTrigger>
                  <TabsTrigger value="quota" className="text-xs gap-1.5 font-semibold rounded-lg">
                    <Sliders className="w-3.5 h-3.5 text-amber-500" />
                    <span>Custom Quota</span>
                  </TabsTrigger>
                  <TabsTrigger value="single" className="text-xs gap-1.5 font-semibold rounded-lg">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Single Agent</span>
                  </TabsTrigger>
                </TabsList>

                {/* TAB 1: AUTO BALANCE (ROUND ROBIN) */}
                <TabsContent value="auto" className="space-y-4 m-0">
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs space-y-1">
                    <div className="font-semibold text-primary flex items-center gap-1.5">
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Even Distribution (Round-Robin)</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Leads will be distributed equally among the selected counselors.
                    </p>
                  </div>

                  {/* Quantity Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                      Number of Leads to Distribute
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAutoAssignType("all")}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          autoAssignType === "all"
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <div>All Matching Leads</div>
                        <div className="text-sm font-bold text-foreground">
                          {availableCount.toLocaleString()}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAutoAssignType("custom")}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          autoAssignType === "custom"
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <div>Specific Count</div>
                        <Input
                          type="number"
                          value={autoCustomCount}
                          onChange={(e) => setAutoCustomCount(parseInt(e.target.value, 10) || 0)}
                          min={1}
                          max={availableCount}
                          className="h-7 mt-1 text-xs font-bold"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Counselors Selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Select Counselors ({selectedCounselorIds.length} of {users.length})
                      </label>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={selectAllCounselors}
                        className="p-0 h-auto text-xs text-primary"
                      >
                        {selectedCounselorIds.length === users.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>

                    <div className="border border-border/80 rounded-xl divide-y divide-border/60 max-h-48 overflow-y-auto bg-card">
                      {users.map((counselor) => {
                        const isSelected = selectedCounselorIds.includes(counselor.id);
                        return (
                          <div
                            key={counselor.id}
                            onClick={() => toggleCounselorSelection(counselor.id)}
                            className="flex items-center justify-between p-2.5 hover:bg-muted/40 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Checkbox checked={isSelected} />
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                style={{ backgroundColor: counselor.avatar_color || "#3b82f6" }}
                              >
                                {counselor.name.charAt(0)}
                              </div>
                              <span className="text-xs font-medium text-foreground">{counselor.name}</span>
                            </div>
                            {isSelected && (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                ~{perCounselorCount.toLocaleString()} leads
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                {/* TAB 2: QUOTA BASED */}
                <TabsContent value="quota" className="space-y-4 m-0">
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs space-y-1">
                    <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Capacity-Based Quota Allocation</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Specify exact lead counts for each counselor according to shift capacity.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span>Total Allocated:</span>
                      <span className="font-bold text-foreground">
                        {totalQuotaAllocated.toLocaleString()} / {availableCount.toLocaleString()} leads ({quotaPercent}%)
                      </span>
                    </div>
                    <Progress value={quotaPercent} className="h-2 rounded-full" />
                  </div>

                  <div className="border border-border/80 rounded-xl divide-y divide-border/60 max-h-48 overflow-y-auto bg-card">
                    {users.map((counselor) => (
                      <div key={counselor.id} className="flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                            style={{ backgroundColor: counselor.avatar_color || "#3b82f6" }}
                          >
                            {counselor.name.charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-foreground">{counselor.name}</span>
                        </div>
                        <Input
                          type="number"
                          placeholder="0"
                          value={quotas[counselor.id] || ""}
                          onChange={(e) => handleQuotaChange(counselor.id, e.target.value)}
                          className="w-24 h-7 text-xs font-bold text-right"
                          min={0}
                        />
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* TAB 3: SINGLE COUNSELOR */}
                <TabsContent value="single" className="space-y-4 m-0">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs space-y-1">
                    <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Dedicated Counselor Assignment</span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Assign all or a specific batch of leads directly to a single counselor.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Target Counselor</label>
                    <select
                      value={singleUserId}
                      onChange={(e) => setSingleUserId(e.target.value)}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-medium focus:ring-1 focus:ring-primary"
                    >
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">Quantity to Assign</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSingleAssignType("all")}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          singleAssignType === "all"
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <div>All Matching Leads</div>
                        <div className="text-sm font-bold text-foreground">
                          {availableCount.toLocaleString()}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSingleAssignType("custom")}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          singleAssignType === "custom"
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-border hover:bg-accent text-muted-foreground"
                        }`}
                      >
                        <div>Specific Count</div>
                        <Input
                          type="number"
                          value={singleCustomCount}
                          onChange={(e) => setSingleCustomCount(parseInt(e.target.value, 10) || 0)}
                          min={1}
                          max={availableCount}
                          className="h-7 mt-1 text-xs font-bold"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Task Automation Option */}
              <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={createFollowupTask}
                    onCheckedChange={(c) => setCreateFollowupTask(Boolean(c))}
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Automatically generate prioritized follow-up task for counselors
                  </span>
                </label>
              </div>
            </div>

            <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={loading}
                className="text-xs font-medium h-9 px-4 rounded-lg"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={handleStartAllocation}
                disabled={loading}
                className="text-xs gap-2 font-semibold h-9 px-5 rounded-lg shadow-2xs bg-primary text-primary-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{loadingStatusText || "Preparing..."}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Start Lead Allocation ({availableCount.toLocaleString()} Leads)</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
