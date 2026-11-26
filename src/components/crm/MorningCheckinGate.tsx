"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DailyTarget, PresenceStatus, User } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  LogOut,
  PhoneCall,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";

interface MorningCheckinGateProps {
  currentUser: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export function MorningCheckinGate({
  currentUser,
  onLogout,
  children,
}: MorningCheckinGateProps) {
  const [checking, setChecking] = useState(true);
  const [needsCheckin, setNeedsCheckin] = useState(false);
  const [target, setTarget] = useState<DailyTarget | null>(null);
  const [focus, setFocus] = useState("");
  const [startingStatus, setStartingStatus] = useState<PresenceStatus>("available");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGatedRole = Boolean(currentUser);

  const checkStatus = useCallback(async () => {
    if (!currentUser || !isGatedRole) {
      setNeedsCheckin(false);
      setChecking(false);
      return;
    }
    try {
      const res = await fetch("/api/daily-ops/checkin", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNeedsCheckin(!data?.checkin?.checked_in_at);
        if (data?.target) setTarget(data.target);
      } else {
        setNeedsCheckin(false);
      }
    } catch {
      setNeedsCheckin(false);
    } finally {
      setChecking(false);
    }
  }, [currentUser, isGatedRole]);

  useEffect(() => {
    setChecking(true);
    checkStatus();
    const onUpdated = () => checkStatus();
    window.addEventListener("daily-ops-updated", onUpdated);
    return () => window.removeEventListener("daily-ops-updated", onUpdated);
  }, [checkStatus]);

  if (!currentUser || !isGatedRole) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <Sun className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-xs font-medium text-muted-foreground">
            Verifying today&apos;s shift check-in...
          </p>
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

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">Starting Status</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStartingStatus("available")}
                  className={`h-10 rounded-xl border px-3 flex items-center justify-center gap-2 font-semibold cursor-pointer transition-all ${
                    startingStatus === "available"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Available</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStartingStatus("on_calls")}
                  className={`h-10 rounded-xl border px-3 flex items-center justify-center gap-2 font-semibold cursor-pointer transition-all ${
                    startingStatus === "on_calls"
                      ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  <span>Starting On Calls</span>
                </button>
              </div>
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
