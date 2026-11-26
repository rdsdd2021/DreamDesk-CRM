"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BackgroundJob } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";

interface BackgroundJobsTrackerProps {
  onJobCompleted?: (job: BackgroundJob) => void;
}

export function BackgroundJobsTracker({ onJobCompleted }: BackgroundJobsTrackerProps) {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevActiveIdsRef = useRef<Set<string>>(new Set());

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (!res.ok) return;
      const data = await res.json();
      const nextJobs: BackgroundJob[] = data.jobs || [];
      setJobs(nextJobs);

      // Notify parent when any previously active job finishes
      const nextActive = new Set<string>();
      for (const j of nextJobs) {
        if (j.status === "queued" || j.status === "running") {
          nextActive.add(j.id);
        } else if (j.status === "completed" && prevActiveIdsRef.current.has(j.id)) {
          onJobCompleted?.(j);
        }
      }
      prevActiveIdsRef.current = nextActive;
    } catch {
      // ignore transient errors
    }
  }, [onJobCompleted]);

  useEffect(() => {
    fetchJobs();
    const onQueued = () => {
      setDismissed(false);
      setExpanded(true);
      fetchJobs();
    };
    window.addEventListener("background-job-queued", onQueued);
    return () => window.removeEventListener("background-job-queued", onQueued);
  }, [fetchJobs]);

  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");

  // Only poll every 1.5s while at least one job is queued or running
  useEffect(() => {
    if (activeJobs.length === 0) return;
    const timer = setInterval(fetchJobs, 1500);
    return () => clearInterval(timer);
  }, [activeJobs.length, fetchJobs]);

  if (jobs.length === 0 || (dismissed && activeJobs.length === 0)) {
    return null;
  }

  const recentJobs = jobs.slice(0, 6);
  const primaryActive = activeJobs[0];
  const activePct =
    primaryActive && primaryActive.total_items > 0
      ? Math.min(100, Math.round((primaryActive.processed_items / primaryActive.total_items) * 100))
      : 0;

  return (
    <div className="fixed bottom-16 sm:bottom-4 right-3 sm:right-4 z-40 w-[calc(100%-1.5rem)] sm:w-80">
      <div className="bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Compact Header Pill */}
        <div
          onClick={() => setExpanded((e) => !e)}
          className="px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            {activeJobs.length > 0 ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
            ) : (
              <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground truncate">
                {activeJobs.length > 0
                  ? `${activeJobs.length} Background Job${activeJobs.length > 1 ? "s" : ""} Running`
                  : "Recent Background Jobs"}
              </div>
              {primaryActive && (
                <div className="text-[10px] text-muted-foreground truncate">
                  {primaryActive.title} · {activePct}%
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {activeJobs.length === 0 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissed(true);
                }}
                className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Expanded Live Progress List */}
        {expanded && (
          <div className="border-t border-border/60 max-h-72 overflow-y-auto divide-y divide-border/50">
            {recentJobs.map((job) => {
              const pct =
                job.total_items > 0
                  ? Math.min(100, Math.round((job.processed_items / job.total_items) * 100))
                  : job.status === "completed"
                  ? 100
                  : 0;

              return (
                <div key={job.id} className="p-3 space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-foreground leading-snug line-clamp-1">
                      {job.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        job.status === "completed"
                          ? "text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0"
                          : job.status === "failed"
                          ? "text-[10px] border-rose-500/40 bg-rose-500/10 text-rose-600 shrink-0"
                          : "text-[10px] border-primary/40 bg-primary/10 text-primary shrink-0"
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>

                  {(job.status === "queued" || job.status === "running") && (
                    <div className="space-y-1">
                      <Progress value={pct} className="h-1.5" />
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span>
                          {job.processed_items.toLocaleString()} / {job.total_items.toLocaleString()}
                        </span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  )}

                  {job.status === "completed" && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>
                        Done ({job.success_count.toLocaleString()} updated
                        {job.skipped_count > 0 ? `, ${job.skipped_count.toLocaleString()} skipped` : ""})
                      </span>
                    </div>
                  )}

                  {job.status === "failed" && (
                    <div className="text-[11px] text-rose-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">{job.error_message || "Job failed"}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
