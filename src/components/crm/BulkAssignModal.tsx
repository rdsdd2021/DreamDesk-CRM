"use client";

import React, { useState } from "react";
import { User, BulkAssignRequest, FilterParams } from "@/types/crm";
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
import { Users, Shuffle, Sliders, UserCheck, Loader2, AlertCircle } from "lucide-react";

interface BulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  selectedLeadIds: number[];
  totalFilteredCount: number;
  isAllFilteredSelected: boolean;
  currentFilterParams: FilterParams;
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
  onAssignComplete,
}: BulkAssignModalProps) {
  const [activeTab, setActiveTab] = useState<"auto" | "quota" | "single">("auto");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 bg-muted/40 border-b">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Users className="w-4 h-4" />
            <span>High-Volume Bulk Allocation</span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Assign Student Leads
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Targeting{" "}
            <span className="font-semibold text-foreground">
              {availableCount.toLocaleString()} leads
            </span>
            {isAllFilteredSelected && " (all matching leads currently filtered in database)"}
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="mx-5 mt-4 p-2.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-5">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as any);
              setErrorMessage(null);
            }}
          >
            <TabsList className="grid grid-cols-3 mb-4 h-10">
              <TabsTrigger value="auto" className="text-xs gap-1.5 font-medium">
                <Shuffle className="w-3.5 h-3.5" />
                <span>Auto Balance</span>
              </TabsTrigger>
              <TabsTrigger value="quota" className="text-xs gap-1.5 font-medium">
                <Sliders className="w-3.5 h-3.5" />
                <span>Custom Quota</span>
              </TabsTrigger>
              <TabsTrigger value="single" className="text-xs gap-1.5 font-medium">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Single User</span>
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

                <div className="max-h-44 overflow-y-auto space-y-1.5 border rounded-lg p-2 bg-muted/20">
                  {users.map((user) => {
                    const checked = selectedCounselorIds.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleCounselorSelection(user.id)}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer border transition-colors ${
                          checked
                            ? "bg-accent border-primary/30"
                            : "border-transparent hover:bg-accent/50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Checkbox checked={checked} />
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: user.avatar_color || "#3b82f6" }}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-foreground">{user.name}</div>
                            <div className="text-[10px] text-muted-foreground capitalize">
                              {user.role.replace("_", " ")}
                            </div>
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {user.assigned_count?.toLocaleString() || 0}
                          </span>{" "}
                          leads active
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Distribution Preview */}
              {selectedCounselorIds.length > 0 && (
                <div className="bg-muted p-2.5 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-foreground">Distribution Summary:</div>
                  <div className="text-muted-foreground text-[11px]">
                    Each of the <span className="font-semibold text-foreground">{selectedCounselorIds.length}</span> counselors will receive{" "}
                    <span className="font-bold text-primary">~{perCounselorCount.toLocaleString()} leads</span>
                    {remainderCount > 0 && ` (+1 lead for ${remainderCount} counselors)`}.
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
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Enter exact quantities to assign to specific counselors. Remaining
                  leads will stay unassigned.
                </p>
              </div>

              {/* Quota Progress */}
              <div className="space-y-1.5 bg-muted/40 border rounded-lg p-3">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Total Allocated</span>
                  <span>
                    {totalQuotaAllocated.toLocaleString()} / {availableCount.toLocaleString()} leads
                  </span>
                </div>
                <Progress value={quotaPercent} className="h-2" />
                <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span>{quotaPercent}% assigned</span>
                  <span>
                    {Math.max(0, availableCount - totalQuotaAllocated).toLocaleString()} remaining
                  </span>
                </div>
              </div>

              {/* Counselors Quota Inputs */}
              <div className="max-h-56 overflow-y-auto space-y-2 border rounded-lg p-2.5">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg bg-card border"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: user.avatar_color || "#3b82f6" }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold truncate">{user.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Active: {user.assigned_count?.toLocaleString() || 0}
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
                        className="w-24 h-8 text-xs font-semibold text-right"
                      />
                      <span className="text-[11px] text-muted-foreground">leads</span>
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
                <p className="text-muted-foreground text-[11px] leading-relaxed">
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
                  <SelectTrigger className="h-9 text-xs">
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
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                      singleAssignType === "all"
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "border-border hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    <div>All Leads</div>
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
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t flex items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading} className="text-xs">
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleExecuteAssignment}
            disabled={loading}
            className="text-xs gap-1.5 font-semibold px-4"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Assigning Leads...</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
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
