"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DailyAutoStats, DailyCheckin, DailyTarget, PresenceStatus } from "@/types/crm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
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
    pillClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  },
  {
    value: "on_calls",
    label: "On Calls",
    dotClass: "bg-blue-500 animate-pulse",
    pillClass: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  },
  {
    value: "busy",
    label: "Busy",
    dotClass: "bg-rose-500",
    pillClass: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
  },
  {
    value: "break",
    label: "Break",
    dotClass: "bg-amber-500",
    pillClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  },
  {
    value: "wrap_up",
    label: "Wrap Up",
    dotClass: "bg-purple-500",
    pillClass: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  },
];

function formatElapsedDuration(sinceIso?: string | null, nowMs?: number): string {
  if (!sinceIso) return "00:00";
  const parsed = Date.parse(sinceIso);
  if (!Number.isFinite(parsed)) return "00:00";
  const totalSeconds = Math.max(0, Math.floor(((nowMs ?? Date.now()) - parsed) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function DailyPresencePill() {
  const [checkin, setCheckin] = useState<DailyCheckin | null>(null);
  const [autoStats, setAutoStats] = useState<DailyAutoStats>({
    callsMade: 0,
    connectedCalls: 0,
    whatsappSent: 0,
    tasksCompleted: 0,
    conversions: 0,
  });
  const [updating, setUpdating] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Wrap-Up / EOD Modal triggered directly from "Wrap Up" status
  const [showEodModal, setShowEodModal] = useState(false);
  const [eodNotes, setEodNotes] = useState("");
  const [eodBlockers, setEodBlockers] = useState("");
  const [savingEod, setSavingEod] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/daily-ops/checkin", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCheckin(data.checkin || null);
        if (data.autoStats) setAutoStats(data.autoStats);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
    const onUpdated = () => load();
    window.addEventListener("daily-ops-updated", onUpdated);
    return () => window.removeEventListener("daily-ops-updated", onUpdated);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = async (next: PresenceStatus) => {
    if (next === "wrap_up") {
      await load();
      setEodNotes(checkin?.eod_notes || "");
      setEodBlockers(checkin?.eod_blockers || "");
      setShowEodModal(true);
      return;
    }

    setUpdating(true);
    const optimisticNow = new Date().toISOString();
    setCheckin((prev) =>
      prev
        ? { ...prev, presence_status: next, updated_at: optimisticNow }
        : {
            id: 0,
            user_id: "",
            checkin_date: optimisticNow.slice(0, 10),
            presence_status: next,
            morning_focus: null,
            checked_in_at: null,
            eod_submitted_at: null,
            eod_notes: null,
            eod_blockers: null,
            updated_at: optimisticNow,
          }
    );
    try {
      const res = await fetch("/api/daily-ops/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "presence", presence_status: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setCheckin(data.checkin);
        window.dispatchEvent(new CustomEvent("daily-ops-updated"));
      }
    } finally {
      setUpdating(false);
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
        const data = await res.json();
        setCheckin(data.checkin);
        setShowEodModal(false);
        window.dispatchEvent(new CustomEvent("daily-ops-updated"));
      }
    } finally {
      setSavingEod(false);
    }
  };

  const current = checkin?.presence_status || "available";
  const meta = PRESENCE_OPTIONS.find((p) => p.value === current) || PRESENCE_OPTIONS[0];
  const elapsedLabel = formatElapsedDuration(checkin?.updated_at || checkin?.checked_in_at, nowMs);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={updating}
          aria-label="Live Presence Status"
          className={`h-8 rounded-full border px-2.5 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-90 ${meta.pillClass}`}
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dotClass}`} />
          <span>{meta.label}</span>
          <span className="font-mono tabular-nums text-[10px] opacity-75 border-l border-current/20 pl-1.5">
            {elapsedLabel}
          </span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44 p-1 rounded-xl">
          {PRESENCE_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              className="flex items-center justify-between gap-2 text-xs rounded-lg px-2.5 py-2 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${opt.dotClass}`} />
                <span className="font-medium">
                  {opt.value === "wrap_up" ? "Wrap Up (EOD)" : opt.label}
                </span>
              </div>
              {current === opt.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showEodModal} onOpenChange={setShowEodModal}>
        <DialogContent className="sm:max-w-lg p-0">
          <DialogHeader className="px-6 py-4 border-b border-border/70 bg-muted/25">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-4 w-4 text-purple-600" />
              Wrap Up &amp; End-of-Day (EOD) Summary
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Your live stats are auto-calculated below. Submit your notes to switch to Wrap Up.
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
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {autoStats.connectedCalls}
                  </div>
                </div>
                <div className="rounded-xl bg-indigo-500/10 p-3 text-center border border-indigo-500/20">
                  <div className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">Tasks Done</div>
                  <div className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mt-0.5">
                    {autoStats.tasksCompleted}
                  </div>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-4 rounded-xl"
                onClick={() => setShowEodModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingEod}
                className="h-9 px-5 rounded-xl bg-purple-600 hover:bg-purple-700"
              >
                {savingEod ? "Submitting..." : "Submit EOD & Wrap Up"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
    const onUpdated = () => fetchOps();
    window.addEventListener("daily-ops-updated", onUpdated);
    return () => window.removeEventListener("daily-ops-updated", onUpdated);
  }, [fetchOps]);

  if (loading) return null;

  const callsPct = Math.min(100, Math.round((autoStats.callsMade / Math.max(1, target.calls_target)) * 100));
  const connectedPct = Math.min(100, Math.round((autoStats.connectedCalls / Math.max(1, target.connected_target)) * 100));
  const tasksPct = Math.min(100, Math.round((autoStats.tasksCompleted / Math.max(1, target.tasks_target)) * 100));
  const convPct = Math.min(100, Math.round((autoStats.conversions / Math.max(1, target.conversions_target)) * 100));

  return (
    <div className="rounded-xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50/70 via-card to-purple-50/40 dark:from-indigo-950/30 dark:via-card dark:to-purple-950/20 p-3.5 shadow-2xs space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Sun className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs font-bold text-foreground">Today&apos;s Focus:</span>
          <span className="text-xs text-muted-foreground truncate">
            {checkin?.morning_focus || "Shift active"}
          </span>
        </div>
        {checkin?.eod_submitted_at && (
          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
            EOD Submitted
          </span>
        )}
      </div>

      {/* Daily Quotas Progress Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-lg bg-card border border-border/70 px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <PhoneCall className="h-3 w-3 text-indigo-500" /> Calls
            </span>
            <span className="font-bold text-foreground">
              {autoStats.callsMade}/{target.calls_target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${callsPct}%` }} />
          </div>
        </div>

        <div className="rounded-lg bg-card border border-border/70 px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Connected
            </span>
            <span className="font-bold text-foreground">
              {autoStats.connectedCalls}/{target.connected_target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${connectedPct}%` }} />
          </div>
        </div>

        <div className="rounded-lg bg-card border border-border/70 px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="h-3 w-3 text-blue-500" /> Tasks Done
            </span>
            <span className="font-bold text-foreground">
              {autoStats.tasksCompleted}/{target.tasks_target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${tasksPct}%` }} />
          </div>
        </div>

        <div className="rounded-lg bg-card border border-border/70 px-2.5 py-2 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Flame className="h-3 w-3 text-amber-500" /> Conversions
            </span>
            <span className="font-bold text-foreground">
              {autoStats.conversions}/{target.conversions_target}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${convPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
