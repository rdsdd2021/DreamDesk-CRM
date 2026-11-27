"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DailyTarget, PresenceStatus, User } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Lock,
  LogOut,
  PhoneCall,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";

interface MorningCheckinGateProps {
  currentUser: User | null;
  initialNeedsCheckin: boolean;
  initialTarget: DailyTarget | null;
  initialPresenceStatus?: PresenceStatus;
  initialPresenceUpdatedAt?: string | null;
  onLogout: () => void;
  children: React.ReactNode;
}

const PAUSED_STATUS_LABELS: Record<string, string> = {
  busy: "Busy",
  break: "On Break",
  wrap_up: "Wrap Up (EOD)",
  offline: "Offline",
};

function formatPausedTimer(sinceIso?: string | null, nowMs?: number): string {
  if (!sinceIso) return "00:00";
  const parsed = Date.parse(sinceIso);
  if (!Number.isFinite(parsed)) return "00:00";
  const totalSeconds = Math.max(0, Math.floor(((nowMs ?? Date.now()) - parsed) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function MorningCheckinGate({
  currentUser,
  initialNeedsCheckin,
  initialTarget,
  initialPresenceStatus = "available",
  initialPresenceUpdatedAt = null,
  onLogout,
  children,
}: MorningCheckinGateProps) {
  const [needsCheckin, setNeedsCheckin] = useState(initialNeedsCheckin);
  const [target, setTarget] = useState<DailyTarget | null>(initialTarget);
  const [presenceStatus, setPresenceStatus] = useState<PresenceStatus>(initialPresenceStatus);
  const [presenceUpdatedAt, setPresenceUpdatedAt] = useState<string | null>(initialPresenceUpdatedAt);
  const [resuming, setResuming] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [focus, setFocus] = useState("");
  const [startingStatus, setStartingStatus] = useState<PresenceStatus>("available");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNeedsCheckin(initialNeedsCheckin);
  }, [initialNeedsCheckin]);

  useEffect(() => {
    setTarget(initialTarget);
  }, [initialTarget]);

  useEffect(() => {
    setPresenceStatus(initialPresenceStatus);
  }, [initialPresenceStatus]);

  useEffect(() => {
    setPresenceUpdatedAt(initialPresenceUpdatedAt);
  }, [initialPresenceUpdatedAt]);

  const checkStatus = useCallback(async () => {
    if (!currentUser) {
      setNeedsCheckin(false);
      return;
    }
    try {
      const res = await fetch("/api/daily-ops/checkin", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNeedsCheckin(!data?.checkin?.checked_in_at);
        if (data?.target) setTarget(data.target);
        if (data?.checkin?.presence_status) {
          setPresenceStatus(data.checkin.presence_status);
          setPresenceUpdatedAt(data.checkin.updated_at || data.checkin.checked_in_at || null);
        }
      }
    } catch {
      // keep current state
    }
  }, [currentUser]);

  useEffect(() => {
    const onUpdated = () => checkStatus();
    window.addEventListener("daily-ops-updated", onUpdated);
    return () => window.removeEventListener("daily-ops-updated", onUpdated);
  }, [checkStatus]);

  const isCallerRole = Boolean(currentUser && !["admin", "team_lead"].includes(currentUser.role));
  const isCallerPaused =
    isCallerRole &&
    !needsCheckin &&
    presenceStatus !== "available";

  useEffect(() => {
    if (!isCallerPaused) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isCallerPaused]);

  const handleResumeActive = async () => {
    setResuming(true);
    try {
      const res = await fetch("/api/daily-ops/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "presence", presence_status: "available" }),
      });
      if (res.ok) {
        const data = await res.json();
        setPresenceStatus(data?.checkin?.presence_status || "available");
        setPresenceUpdatedAt(data?.checkin?.updated_at || new Date().toISOString());
        window.dispatchEvent(new CustomEvent("daily-ops-updated"));
      }
    } finally {
      setResuming(false);
    }
  };

  if (!currentUser) {
    return <>{children}</>;
  }

  if (isCallerPaused) {
    const statusLabel = PAUSED_STATUS_LABELS[presenceStatus] || "Inactive";
    const pausedTimer = formatPausedTimer(presenceUpdatedAt, nowMs);
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-amber-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-between p-4 sm:p-8">
        <div className="max-w-3xl w-full mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="DreamDesk CRM"
              className="h-9 w-9 rounded-xl object-contain bg-white p-0.5 shadow-xs ring-1 ring-border/50"
            />
            <div>
              <div className="text-sm font-bold text-foreground">DreamDesk CRM</div>
              <div className="text-[11px] text-muted-foreground">
                {currentUser.name} • {currentUser.role.replace("_", " ")}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-8 gap-1.5 text-xs rounded-xl"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>

        <div className="max-w-md w-full mx-auto my-8 rounded-2xl bg-card border border-border/80 shadow-2xl p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Lock className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <Badge
              variant="outline"
              className="text-xs px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-semibold gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{statusLabel}</span>
              <span className="font-mono tabular-nums border-l border-current/25 pl-1.5">
                {pausedTimer}
              </span>
            </Badge>
            <h1 className="text-lg font-bold text-foreground pt-2">
              CRM Access Paused
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The CRM workspace is hidden while your status is <span className="font-semibold text-foreground">{statusLabel}</span>.
              Switch back to an active status to continue working on leads.
            </p>
          </div>

          <div className="pt-1">
            <Button
              type="button"
              disabled={resuming}
              onClick={handleResumeActive}
              className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{resuming ? "Resuming..." : "Go Available"}</span>
            </Button>
          </div>
        </div>

        <div className="max-w-3xl w-full mx-auto text-center text-[11px] text-muted-foreground">
          Active status is required for caller access • {currentUser.email}
        </div>
      </div>
    );
  }

  if (!needsCheckin) {
    return <>{children}</>;
  }

  const todayDisplay = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!focus.trim()) {
      setError("Please enter your focus or shift plan before entering the CRM.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-ops/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin",
          morning_focus: focus.trim(),
          presence_status: startingStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Check-in failed");
      }
      setNeedsCheckin(false);
      window.dispatchEvent(new CustomEvent("daily-ops-updated"));
    } catch (err: any) {
      setError(err?.message || "Failed to check in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-indigo-50/40 to-amber-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30 flex flex-col justify-between p-4 sm:p-8">
      {/* Top Bar */}
      <div className="max-w-3xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="DreamDesk CRM"
            className="h-9 w-9 rounded-xl object-contain bg-white p-0.5 shadow-xs ring-1 ring-border/50"
          />
          <div>
            <div className="text-sm font-bold text-foreground">DreamDesk CRM</div>
            <div className="text-[11px] text-muted-foreground">{todayDisplay}</div>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onLogout}
          className="h-8 gap-1.5 text-xs rounded-xl"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </Button>
      </div>

      {/* Main Centered Check-In Card */}
      <div className="max-w-xl w-full mx-auto my-8 rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border/70 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Badge variant="outline" className="text-[10px] mb-2 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                <Clock className="h-3 w-3 mr-1" />
                Mandatory Daily Shift Check-In
              </Badge>
              <h1 className="text-xl font-bold text-foreground">
                Good Morning, {currentUser.name}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Submit your daily check-in below to unlock your leads, tasks, and calling workspace.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-5 text-xs">
            {target && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Your Daily Targets Today</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-2.5 text-center">
                    <div className="text-[10px] text-muted-foreground">Calls</div>
                    <div className="text-base font-bold text-foreground">{target.calls_target}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-2.5 text-center">
                    <div className="text-[10px] text-muted-foreground">Connected</div>
                    <div className="text-base font-bold text-emerald-600">{target.connected_target}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-2.5 text-center">
                    <div className="text-[10px] text-muted-foreground">Work Tasks</div>
                    <div className="text-base font-bold text-indigo-600">{target.tasks_target}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-2.5 text-center">
                    <div className="text-[10px] text-muted-foreground">Conversions</div>
                    <div className="text-base font-bold text-amber-600">{target.conversions_target}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                What is your main focus / plan for today&apos;s shift? *
              </label>
              <textarea
                autoFocus
                required
                rows={3}
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="e.g. Call 60 fresh NEET leads from Batch A, follow up on yesterday's 8 warm parents, and clear overdue callbacks."
                className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-y"
              />
              <p className="text-[11px] text-muted-foreground">
                Your Team Lead &amp; Admin will see your check-in timestamp and message on the Live Attendance Log.
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-xs">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border/70 bg-muted/20 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              Recorded with live timestamp
            </span>
            <Button
              type="submit"
              disabled={submitting}
              className="h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{submitting ? "Checking In..." : "Check In & Enter CRM"}</span>
            </Button>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="max-w-3xl w-full mx-auto text-center text-[11px] text-muted-foreground">
        Logged in as <span className="font-semibold text-foreground">{currentUser.email}</span> ({currentUser.role.replace("_", " ")})
      </div>
    </div>
  );
}
