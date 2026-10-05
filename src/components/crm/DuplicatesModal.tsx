"use client";

import React, { useState, useEffect } from "react";
import { Lead, DuplicateCluster } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Users,
  GitMerge,
  AlertTriangle,
  CheckCircle2,
  Phone,
  Mail,
  ArrowRight,
  ShieldCheck,
  Trash2,
} from "lucide-react";

interface DuplicatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMergeComplete?: (mergedCount: number) => void;
}

export function DuplicatesModal({
  isOpen,
  onClose,
  onMergeComplete,
}: DuplicatesModalProps) {
  const [data, setData] = useState<{
    phoneDuplicates: DuplicateCluster[];
    emailDuplicates: DuplicateCluster[];
    totalDuplicateLeads: number;
  }>({
    phoneDuplicates: [],
    emailDuplicates: [],
    totalDuplicateLeads: 0,
  });

  const [loading, setLoading] = useState(false);
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<number>(0);
  const [primaryLeadId, setPrimaryLeadId] = useState<number | null>(null);
  const [merging, setMerging] = useState(false);

  const fetchDuplicates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads/duplicates");
      const resData = await res.json();
      setData(resData);
      if (resData.phoneDuplicates?.length > 0) {
        setSelectedClusterIndex(0);
        setPrimaryLeadId(resData.phoneDuplicates[0].leads[0]?.id || null);
      }
    } catch (err) {
      console.error("Failed to scan duplicates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDuplicates();
    }
  }, [isOpen]);

  const allClusters = [...data.phoneDuplicates, ...data.emailDuplicates];
  const currentCluster: DuplicateCluster | undefined = allClusters[selectedClusterIndex];

  useEffect(() => {
    if (currentCluster && currentCluster.leads.length > 0) {
      setPrimaryLeadId(currentCluster.leads[0].id);
    }
  }, [selectedClusterIndex, currentCluster]);

  const handleMerge = async () => {
    if (!currentCluster || !primaryLeadId) return;
    const duplicatesToDelete = currentCluster.leads
      .filter((l) => l.id !== primaryLeadId)
      .map((l) => l.id);

    if (duplicatesToDelete.length === 0) return;

    setMerging(true);
    try {
      const res = await fetch("/api/leads/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primary_lead_id: primaryLeadId,
          duplicate_lead_ids: duplicatesToDelete,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to merge");

      if (onMergeComplete) {
        onMergeComplete(duplicatesToDelete.length);
      }
      fetchDuplicates();
    } catch (err: any) {
      alert(err.message || "Merge failed");
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-w-[95vw] p-0 overflow-hidden max-h-[85vh] flex flex-col border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 bg-muted/40 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <GitMerge className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                  Duplicate Records Scanner
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
                  {allClusters.length} Clusters ({data.totalDuplicateLeads} Leads)
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Identify records sharing identical phone numbers or emails and consolidate their history with zero data loss.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-20 text-center text-xs text-muted-foreground">
            Scanning 112,500+ records in SQLite WAL...
          </div>
        ) : allClusters.length === 0 ? (
          <div className="py-20 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-80" />
            <p className="text-sm font-bold text-foreground">Zero Duplicates Detected</p>
            <p className="text-xs text-muted-foreground">
              Your database has pristine integrity with no duplicate phone numbers or email addresses!
            </p>
          </div>
        ) : (
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Left Cluster Picker */}
            <div className="w-64 border-r overflow-y-auto p-2 space-y-1 shrink-0 bg-muted/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
                Detected Clusters
              </div>
              {allClusters.map((cluster, idx) => {
                const isSelected = selectedClusterIndex === idx;
                return (
                  <button
                    key={`${cluster.field}-${cluster.key}`}
                    onClick={() => setSelectedClusterIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="truncate flex items-center gap-2">
                      {cluster.field === "phone" ? (
                        <Phone className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      ) : (
                        <Mail className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      )}
                      <span className="truncate font-mono">{cluster.key}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] font-bold h-4 px-1.5 rounded-full ${
                        isSelected ? "bg-white/20 text-white" : ""
                      }`}
                    >
                      {cluster.count}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* Right Comparison & Merge View */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {currentCluster && (
                <>
                  <div className="flex items-center justify-between pb-2 border-b">
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-2">
                        <span>Cluster:</span>
                        <span className="font-mono text-primary">{currentCluster.key}</span>
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Select which record should be kept as the <strong>Primary Record</strong>.
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={handleMerge}
                      disabled={merging}
                      className="h-8 text-xs font-semibold gap-1.5 shadow-2xs"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      <span>{merging ? "Merging..." : "Merge Leads into Primary"}</span>
                    </Button>
                  </div>

                  {/* Side-by-Side Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentCluster.leads.map((l) => {
                      const isPrimary = l.id === primaryLeadId;
                      const attrs = l.raw_attributes || {};

                      return (
                        <div
                          key={l.id}
                          onClick={() => setPrimaryLeadId(l.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 relative ${
                            isPrimary
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                              : "border-border/80 bg-card hover:border-muted-foreground/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted">
                                {l.lead_code}
                              </span>
                              <Badge
                                variant={isPrimary ? "default" : "outline"}
                                className="text-[10px] font-semibold"
                              >
                                {isPrimary ? "Master / Primary Record" : "Secondary Duplicate"}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(l.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs">
                            <div className="font-bold text-foreground text-sm">
                              {l.name || "Unnamed Student"}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-2">
                              <span>Phone: <strong className="text-foreground">{l.phone || "-"}</strong></span>
                            </div>
                            <div className="text-muted-foreground flex items-center gap-2">
                              <span>Status: <strong className="text-foreground">{l.status}</strong></span>
                              <span>•</span>
                              <span>Counselor: <strong className="text-foreground">{l.assigned_user_name || "Unassigned"}</strong></span>
                            </div>
                            <div className="text-muted-foreground">
                              <span>Stream: <strong className="text-foreground">{String(attrs.stream || "-")}</strong></span>
                            </div>
                            <div className="text-muted-foreground">
                              <span>School: <strong className="text-foreground">{String(attrs.school || "-")}</strong></span>
                            </div>
                            <div className="text-muted-foreground">
                              <span>Score: <strong className="text-emerald-600 font-bold">{String(attrs.score || 0)} pts</strong></span>
                            </div>
                            {l.notes && (
                              <div className="p-2 rounded bg-muted/40 text-[11px] text-muted-foreground italic border mt-2">
                                "{l.notes}"
                              </div>
                            )}
                          </div>

                          <div className="pt-2 border-t flex items-center justify-between text-[11px]">
                            <span className={isPrimary ? "text-primary font-bold" : "text-muted-foreground"}>
                              {isPrimary ? "✓ Will be Preserved & Updated" : "✕ Will be Merged & Deleted"}
                            </span>
                            <Button
                              size="sm"
                              variant={isPrimary ? "default" : "outline"}
                              className="h-6 text-[10px] px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrimaryLeadId(l.id);
                              }}
                            >
                              {isPrimary ? "Selected Master" : "Set as Master"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="p-3 border-t bg-muted/20 flex items-center justify-between shrink-0">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>SQLite ACID Merge: Preserves all notes, picks highest score, and avoids data loss.</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 text-xs font-semibold px-4 rounded-lg">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
