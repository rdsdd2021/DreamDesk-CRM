"use client";

import React, { useCallback, useEffect, useState } from "react";
import { User } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock, Sparkles, Sun } from "lucide-react";

interface MorningCheckinGateProps {
  currentUser: User | null;
}

export function MorningCheckinGate({ currentUser }: MorningCheckinGateProps) {
  const [needsCheckin, setNeedsCheckin] = useState(false);
  const [focus, setFocus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCallerRole =
    currentUser &&
    ["counselor", "senior_counselor", "telecaller"].includes(currentUser.role);

  const checkStatus = useCallback(async () => {
    if (!isCallerRole) {
      setNeedsCheckin(false);
      return;
    }
    try {
      const res = await fetch("/api/daily-ops/checkin", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNeedsCheckin(!data?.checkin?.checked_in_at);
      }
    } catch {
      // Do not lock out on transient network failure
    }
  }, [isCallerRole]);

  useEffect(() => {
    checkStatus();
    const onUpdated = () => checkStatus();
    window.addEventListener("daily-ops-updated", onUpdated);
    return () => window.removeEventListener("daily-ops-updated", onUpdated);
  }, [checkStatus]);

  if (!isCallerRole || !needsCheckin || !currentUser) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!focus.trim()) {
      setError("Please enter your focus or shift plan before starting.");
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
          presence_status: "available",
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
    <div
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="morning-gate-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-card border border-border/80 shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border/70 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sun className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h2 id="morning-gate-title" className="text-base font-bold text-foreground">
                Good Morning, {currentUser.name}!
              </h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3" />
                Mandatory Daily Shift Check-In
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Before accessing your leads and calling workspace, please check in and share your main focus for today&apos;s shift. Your Team Lead &amp; Admin will see your check-in time and message.
            </p>

            <div className="space-y-1.5">
              <label className="block font-semibold text-foreground">
                Today&apos;s Focus / Shift Message *
              </label>
              <Input
                autoFocus
                required
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="e.g. Calling 60 fresh NEET leads & clearing morning callbacks"
                className="h-10 rounded-xl"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive text-xs">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border/70 bg-muted/20 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
              Status will be set to Available
            </span>
            <Button
              type="submit"
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-1.5"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submitting ? "Checking In..." : "Check In & Start Shift"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
