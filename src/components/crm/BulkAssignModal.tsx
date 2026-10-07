"use client";

import React, { useState } from "react";
import { User, BulkAssignRequest, FilterParams, TaskPriority, BulkTaskConfig } from "@/types/crm";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, Shuffle, Sliders, UserCheck, Loader2, AlertCircle, CheckCircle2, ShieldCheck, Lock } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"auto" | "quota" | "single">("auto");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Policy Override State (Admin / Team Leader privilege)
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

  // Auto-Balance Calculations
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

  // Quota Calculations
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

  const handleExecuteAssignment = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      let requestPayload: BulkAssignRequest;

      if (activeTab === "auto") {
        if (selectedCounselorIds.length === 0) {
          setErrorMessage("Please select at least one counselor to distribute leads.");
          setLoading(false);
          return;
        }
        requestPayload = {
          mode: "auto",
          selected_user_ids: selectedCounselorIds,
          apply_to_all_filtered: isAllFilteredSelected,
          lead_ids: isAllFilteredSelected ? undefined : selectedLeadIds,
          filter_params: isAllFilteredSelected ? currentFilterParams : undefined,
          total_to_assign: autoAssignType === "custom" ? autoCustomCount : undefined,
          override_policy: overridePolicy,
        };
      } else if (activeTab === "quota") {
        if (totalQuotaAllocated === 0) {
          setErrorMessage("Please specify a quota greater than 0 for at least one counselor.");
          setLoading(false);
          return;
        }
        requestPayload = {
          mode: "quota",
          user_quotas: quotas,
          apply_to_all_filtered: isAllFilteredSelected,
          lead_ids: isAllFilteredSelected ? undefined : selectedLeadIds,
          filter_params: isAllFilteredSelected ? currentFilterParams : undefined,
          override_policy: overridePolicy,
        };
      } else {
        if (!singleUserId) {
          setErrorMessage("Please select a counselor to assign leads to.");
          setLoading(false);
          return;
        }
        requestPayload = {
          mode: "single",
          single_user_id: singleUserId,
          apply_to_all_filtered: isAllFilteredSelected,
          lead_ids: isAllFilteredSelected ? undefined : selectedLeadIds,
          filter_params: isAllFilteredSelected ? currentFilterParams : undefined,
          total_to_assign: singleAssignType === "custom" ? singleCustomCount : undefined,
          override_policy: overridePolicy,
        };
      }

      if (createFollowupTask) {
        requestPayload.task_config = {
          create_task: true,
          title: taskTitle.trim() || "Follow up with newly assigned student applicant",
          priority: taskPriority,
          due_in_hours: taskDueHours,
        };
      }

      const res = await fetch("/api/leads/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Assignment failed");

      onAssignComplete(data.affectedCount, data.message);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Assignment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !loading && !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 bg-muted/40 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                Bulk Lead Allocation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Targeting <span className="font-semibold text-foreground">{availableCount.toLocaleString()} leads</span>
                {isAllFilteredSelected ? " (all matching leads currently filtered in database)" : " selected from table"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* 7-Day Counselor Ownership Protection Notice */}
        <div className="mx-5 mt-3.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs space-y-1.5">
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
              <TabsTrigger value="auto" className="text-xs gap-1.5 font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <Shuffle className="w-3.5 h-3.5 text-primary" />
                <span>Auto Balance</span>
              </TabsTrigger>
              <TabsTrigger value="quota" className="text-xs gap-1.5 font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
                <Sliders className="w-3.5 h-3.5 text-amber-500" />
                <span>Custom Quota</span>
              </TabsTrigger>
              <TabsTrigger value="single" className="text-xs gap-1.5 font-semibold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs">
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
                  Ideal for balancing team workload instantly.
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

                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/80 rounded-xl p-2 bg-muted/20">
                  {users.map((user) => {
                    const checked = selectedCounselorIds.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleCounselorSelection(user.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer border transition-all ${
                          checked
                            ? "bg-primary/10 border-primary/40 shadow-2xs text-foreground"
                            : "border-transparent hover:bg-muted/60 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={checked} className="rounded" />
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: user.avatar_color || "#3b82f6" }}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-foreground">{user.name}</div>
                            <div className="text-[11px] text-muted-foreground capitalize">
                              {user.role.replace("_", " ")}
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-xs">
                          <span className="font-bold text-foreground">
                            {user.assigned_count?.toLocaleString() || 0}
                          </span>{" "}
                          <span className="text-[11px] text-muted-foreground">leads active</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Distribution Preview */}
              {selectedCounselorIds.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 p-3 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    <span>Distribution Breakdown</span>
                  </div>
                  <div className="text-muted-foreground text-xs leading-relaxed">
                    Each of the <span className="font-semibold text-foreground">{selectedCounselorIds.length}</span> selected counselors will receive{" "}
                    <span className="font-bold text-primary font-mono text-xs">~{perCounselorCount.toLocaleString()} leads</span>
                    {remainderCount > 0 && ` (plus 1 remaining lead for ${remainderCount} counselor${remainderCount > 1 ? "s" : ""})`}.
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: SPECIFIED QUOTA ALLOCATION */}
            <TabsContent value="quota" className="space-y-4 m-0">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs space-y-1">
                <div className="font-semibold text-primary flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Custom Quotas per Counselor</span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Enter exact quantities to assign to specific counselors. Remaining leads will stay unassigned.
                </p>
              </div>

              {/* Quota Progress */}
              <div className="space-y-2 bg-muted/40 border border-border/80 rounded-xl p-3.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-foreground">Total Quota Allocated</span>
                  <span className="font-mono text-primary font-bold">
                    {totalQuotaAllocated.toLocaleString()} / {availableCount.toLocaleString()} leads
                  </span>
                </div>
                <Progress value={quotaPercent} className="h-2 rounded-full" />
                <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span className="font-semibold text-foreground">{quotaPercent}% assigned</span>
                  <span>
                    {Math.max(0, availableCount - totalQuotaAllocated).toLocaleString()} leads remaining
                  </span>
                </div>
              </div>

              {/* Counselors Quota Inputs */}
              <div className="max-h-56 overflow-y-auto space-y-2 border border-border/80 rounded-xl p-2.5 bg-muted/10">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-card border border-border/70 hover:border-border transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: user.avatar_color || "#3b82f6" }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-foreground truncate">{user.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          Currently has {user.assigned_count?.toLocaleString() || 0} leads
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Input
                        type="number"
                        placeholder="0"
                        min={0}
                        value={quotas[user.id] || ""}
                        onChange={(e) => handleQuotaChange(user.id, e.target.value)}
                        className="w-24 h-8 text-xs font-semibold text-right rounded-lg bg-background"
                      />
                      <span className="text-xs text-muted-foreground">leads</span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB 3: SINGLE COUNSELOR */}
            <TabsContent value="single" className="space-y-4 m-0">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs space-y-1">
                <div className="font-semibold text-primary flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Assign to One Counselor</span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Allocate all or a specific batch of matching leads to a single agent.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Select Counselor
                </label>
                <Select
                  value={singleUserId}
                  onValueChange={(val) => {
                    if (val) setSingleUserId(val);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs rounded-lg">
                    <SelectValue placeholder="Choose counselor" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id} className="text-xs">
                        {u.name} ({u.role.replace("_", " ")}) - {u.assigned_count || 0} active leads
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Quantity
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSingleAssignType("all")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      singleAssignType === "all"
                        ? "border-primary bg-primary/10 font-semibold text-primary shadow-2xs"
                        : "border-border/80 hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <div>All Leads</div>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {availableCount.toLocaleString()}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSingleAssignType("custom")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      singleAssignType === "custom"
                        ? "border-primary bg-primary/10 font-semibold text-primary shadow-2xs"
                        : "border-border/80 hover:bg-muted/60 text-muted-foreground"
                    }`}
                  >
                    <div>Specific Count</div>
                    <Input
                      type="number"
                      value={singleCustomCount}
                      onChange={(e) => setSingleCustomCount(parseInt(e.target.value, 10) || 0)}
                      min={1}
                      max={availableCount}
                      className="h-8 mt-1.5 text-xs font-bold rounded-lg bg-background"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Task Scheduling & Caller Notification Section */}
        <div className="mx-5 mb-3 p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="create-task-assign"
                checked={createFollowupTask}
                onCheckedChange={(c) => setCreateFollowupTask(Boolean(c))}
              />
              <label
                htmlFor="create-task-assign"
                className="text-xs font-bold text-foreground cursor-pointer select-none flex items-center gap-1.5"
              >
                <span>🔔 Schedule Follow-up Tasks & Alert Callers</span>
              </label>
            </div>
            {createFollowupTask && (
              <Badge variant="outline" className="text-[10px] font-mono capitalize">
                Priority: {taskPriority}
              </Badge>
            )}
          </div>

          {createFollowupTask && (
            <div className="space-y-2 pt-1 border-t border-border/40">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                  Task Title / Action Brief
                </label>
                <Input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Follow up with newly assigned student applicant"
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

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="text-xs font-medium h-9 px-4 rounded-lg">
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleExecuteAssignment}
            disabled={loading}
            className="text-xs gap-2 font-semibold h-9 px-5 rounded-lg shadow-2xs bg-primary text-primary-foreground"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Assigning Leads...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4" />
                <span>
                  Confirm & Assign (
                  {activeTab === "auto"
                    ? effectiveAutoCount.toLocaleString()
                    : activeTab === "quota"
                    ? totalQuotaAllocated.toLocaleString()
                    : (singleAssignType === "all" ? availableCount : singleCustomCount).toLocaleString()}{" "}
                  leads)
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
