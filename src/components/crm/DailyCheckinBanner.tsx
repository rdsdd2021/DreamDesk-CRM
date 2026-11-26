"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DailyAutoStats, DailyCheckin, DailyTarget, PresenceStatus } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coffee,
  Flame,
  PhoneCall,
  Sparkles,
  Sun,
} from "lucide-react";

const PRESENCE_OPTIONS: {
  value: PresenceStatus;
  label: string;
  dotClass: string;
  pillClass: string;
}[] = [
  {
    value: "available",
    label: "Available",
    dotClass: "bg-emerald-500",
    pillClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    value: "on_calls",
    label: "On Calls",
    dotClass: "bg-blue-500 animate-pulse",
    pillClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    value: "break",
    label: "Break",
    dotClass: "bg-amber-500",
    pillClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    value: "wrap_up",
    label: "Wrap Up",
    dotClass: "bg-purple-500",
    pillClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
];

export function DailyPresencePill() {
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-ops/checkin", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCheckin(data.checkin || null);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = async (next: PresenceStatus) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/daily-ops/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "presence", presence_status: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setCheckin(data.checkin);
      }
    } finally {
      setUpdating(false);
    }
  };

  const current = checkin?.checked_in_at ? checkin.presence_status : "available";
  const meta = PRESENCE_OPTIONS.find((p) => p.value === current) || PRESENCE_OPTIONS[0];

  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
      <select
        value={current}
        disabled={updating}
        onChange={(e) => handleChange(e.target.value as PresenceStatus)}
        aria-label="Live Presence Status"
        className={`h-7 rounded-full border px-2 text-[11px] font-semibold cursor-pointer focus:outline-none ${meta.pillClass}`}
      >
        {PRESENCE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DailyCheckinBanner() {
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [autoStats, setAutoStats] = useState<DailyAutoStats>({
    callsMade: 0,
    connectedCalls: 0,
    whatsappSent: 0,
    tasksCompleted: 0,
    conversions: 0,
  });
  const [target, setTarget] = useState<DailyTarget>({
    user_id: null,
    calls_target: 50,
    connected_target: 15,
    whatsapp_target: 15,
    tasks_target: 5,
    conversions_target: 1,
  });
  const [loading, setLoading] = useState(true);

  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [focusInput, setFocusInput] = useState("");
  const [savingCheckin, setSavingCheckin] = useState(false);

  const [showEodModal, setShowEodModal] = useState(false);
  const [eodNotes, setEodNotes] = useState("");
  const [eodBlockers, setEodBlockers] = useState("");
  const [savingEod, setSavingEod] = useState(false);

  const fetchOps = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-ops/checkin", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCheckin(data.checkin || null);
        if (data.autoStats) setAutoStats(data.autoStats);
        if (data.target) setTarget(data.target);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOps();
  }, [fetchOps]);

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCheckin(true);
    try {
      const res = await fetch("/api/daily-ops/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin",
          morning_focus: focusInput,
          presence_status: "available",
        }),
      });
      if (res.ok) {
        setShowCheckinModal(false);
        fetchOps();
      }
    } finally {
      setSavingCheckin(false);
    }
  };

  const handlePresenceSwitch = async (next: PresenceStatus) => {
    const res = await fetch("/api/daily-ops/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "presence", presence_status: next }),
    });
    if (res.ok) {
      fetchOps();
    }
  };

  const handleEodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEod(true);
    try {
      const res = await fetch("/api/daily-ops/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "eod",
          eod_notes: eodNotes,
          eod_blockers: eodBlockers,
        }),
      });
      if (res.ok) {
        setShowEodModal(false);
        fetchOps();
      }
    } finally {
      setSavingEod(false);
    }
  };

  if (loading) return null;

  const isCheckedIn = Boolean(checkin?.checked_in_at);
  const isEodDone = Boolean(checkin?.eod_submitted_at);
  const callsPct = Math.min(100, Math.round((autoStats.callsMade / Math.max(1, target.calls_target)) * 100));
  const connectedPct = Math.min(100, Math.round((autoStats.connectedCalls / Math.max(1, target.connected_target)) * 100));
  const tasksPct = Math.min(100, Math.round((autoStats.tasksCompleted / Math.max(1, target.tasks_target)) * 100));
  const convPct = Math.min(100, Math.round((autoStats.conversions / Math.max(1, target.conversions_target)) * 100));

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/50 p-3.5 shadow-2xs space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold text-slate-900">
              {isCheckedIn ? "Checked In for Today" : "Start Your Shift"}
            </span>
            {isCheckedIn && checkin?.presence_status && (
              <div className="flex items-center gap-1">
                {PRESENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handlePresenceSwitch(opt.value)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                      checkin.presence_status === opt.value
                        ? opt.pillClass
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-slate-600">
            {checkin?.morning_focus ? (
              <>
                <span className="font-semibold text-indigo-700">Today&apos;s Focus:</span>{" "}
                {checkin.morning_focus}
              </>
            ) : (
              "Set your morning focus so your Team Lead knows your priority today."
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isCheckedIn ? (
            <Button
              size="sm"
              onClick={() => {
                setFocusInput("");
                setShowCheckinModal(true);
              }}
              className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Morning Check-In
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setFocusInput(checkin?.morning_focus || "");
                setShowCheckinModal(true);
              }}
              className="h-8 text-xs"
            >
              Edit Focus
            </Button>
          )}

          <Button
            size="sm"
            variant={isEodDone ? "outline" : "default"}
            onClick={() => {
              setEodNotes(checkin?.eod_notes || "");
              setEodBlockers(checkin?.eod_blockers || "");
              setShowEodModal(true);
            }}
            className={`h-8 text-xs gap-1.5 ${
              isEodDone ? "border-purple-200 text-purple-700 bg-purple-50" : "bg-purple-600 hover:bg-purple-700"
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            {isEodDone ? "EOD Submitted (Update)" : "Submit EOD"}
          </Button>
        </div>
      </div>

      {/* Daily Quotas Progress Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <PhoneCall className="h-3 w-3 text-indigo-500" /> Calls
            </span>
            <span className="font-bold text-slate-900">
              {autoStats.callsMade}/{target.calls_target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${callsPct}%` }} />
          </div>
        </div>

        <div className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Connected
            </span>
            <span className="font-bold text-slate-900">
              {autoStats.connectedCalls}/{target.connected_target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${connectedPct}%` }} />
          </div>
        </div>

        <div className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-500" /> Tasks Done
            </span>
            <span className="font-bold text-slate-900">
              {autoStats.tasksCompleted}/{target.tasks_target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${tasksPct}%` }} />
          </div>
        </div>

        <div className="rounded-lg bg-white border border-slate-200/80 px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Flame className="h-3 w-3 text-amber-500" /> Conversions
            </span>
            <span className="font-bold text-slate-900">
              {autoStats.conversions}/{target.conversions_target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${convPct}%` }} />
          </div>
        </div>
      </div>

      {/* Morning Check-in Modal */}
      <Dialog open={showCheckinModal} onOpenChange={setShowCheckinModal}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="px-6 py-4 border-b border-border/70 bg-muted/25">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sun className="h-4 w-4 text-amber-500" />
              Morning Check-In
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Share your main calling or follow-up priority for today.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckInSubmit}>
            <div className="px-6 py-5 space-y-3 text-xs">
              <div className="space-y-1.5">
                <label className="block font-semibold text-foreground">Today&apos;s Focus</label>
                <Input
                  value={focusInput}
                  onChange={(e) => setFocusInput(e.target.value)}
                  placeholder="e.g. Call 50 fresh NEET leads and close 3 warm callbacks"
                  className="h-10 rounded-xl"
                  required
                />
              </div>
            </div>
            <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-xl" onClick={() => setShowCheckinModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700" disabled={savingCheckin}>
                {savingCheckin ? "Saving..." : "Check In Now"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* EOD Summary Modal */}
      <Dialog open={showEodModal} onOpenChange={setShowEodModal}>
        <DialogContent className="sm:max-w-lg p-0">
          <DialogHeader className="px-6 py-4 border-b border-border/70 bg-muted/25">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-4 w-4 text-purple-600" />
              Submit End-of-Day (EOD) Summary
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your live stats are auto-calculated below. Add highlights or blockers for your Team Lead.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEodSubmit}>
            <div className="px-6 py-5 space-y-4 text-xs max-h-[68vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl bg-muted/30 p-3 text-center border border-border/70">
                  <div className="text-[11px] font-medium text-muted-foreground">Calls</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">{autoStats.callsMade}</div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3 text-center border border-emerald-500/20">
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Connected</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{autoStats.connectedCalls}</div>
                </div>
                <div className="rounded-xl bg-indigo-500/10 p-3 text-center border border-indigo-500/20">
                  <div className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">Tasks Done</div>
                  <div className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mt-0.5">{autoStats.tasksCompleted}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-foreground">Key Highlights / Notes</label>
                <textarea
                  rows={3}
                  value={eodNotes}
                  onChange={(e) => setEodNotes(e.target.value)}
                  placeholder="Summary of hot leads, callbacks scheduled, or wins today..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-foreground">Blockers / Help Needed</label>
                <textarea
                  rows={2}
                  value={eodBlockers}
                  onChange={(e) => setEodBlockers(e.target.value)}
                  placeholder="Any issues, lead shortages, or escalations for your Team Lead..."
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-y"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-xl" onClick={() => setShowEodModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingEod} className="h-9 px-5 rounded-xl bg-purple-600 hover:bg-purple-700">
                {savingEod ? "Submitting..." : "Submit EOD"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
