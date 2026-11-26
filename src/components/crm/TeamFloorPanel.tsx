"use client";

import React, { useCallback, useEffect, useState } from "react";
import { DailyTarget, PresenceStatus, TeamFloorMember, User } from "@/types/crm";
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
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coffee,
  FileText,
  PhoneCall,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

interface TeamFloorPanelProps {
  users: User[];
  currentUser?: User | null;
}

const PRESENCE_META: Record<
  PresenceStatus,
  { label: string; dotClass: string; badgeClass: string; icon: React.ReactNode }
> = {
  available: {
    label: "Available",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  on_calls: {
    label: "On Calls",
    dotClass: "bg-blue-500 animate-pulse",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <PhoneCall className="h-3 w-3" />,
  },
  break: {
    label: "Break",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Coffee className="h-3 w-3" />,
  },
  wrap_up: {
    label: "Wrap Up / EOD",
    dotClass: "bg-purple-500",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    icon: <ClipboardCheck className="h-3 w-3" />,
  },
  offline: {
    label: "Not Checked In",
    dotClass: "bg-slate-300",
    badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
    icon: <Clock className="h-3 w-3" />,
  },
};

export function TeamFloorPanel({ users, currentUser }: TeamFloorPanelProps) {
  const [members, setMembers] = useState<TeamFloorMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamLeadFilter, setTeamLeadFilter] = useState<string>("all");
  const [eodPreviewMember, setEodPreviewMember] = useState<TeamFloorMember | null>(null);

  // Daily Targets Config Modal
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [targetScopeUserId, setTargetScopeUserId] = useState<string>("__default__");
  const [targetForm, setTargetForm] = useState<DailyTarget>({
    user_id: null,
    calls_target: 50,
    connected_target: 15,
    whatsapp_target: 15,
    tasks_target: 5,
    conversions_target: 1,
  });
  const [allTargets, setAllTargets] = useState<{ defaultTarget: DailyTarget; overrides: DailyTarget[] }>({
    defaultTarget: {
      user_id: null,
      calls_target: 50,
      connected_target: 15,
      whatsapp_target: 15,
      tasks_target: 5,
      conversions_target: 1,
    },
    overrides: [],
  });
  const [savingTarget, setSavingTarget] = useState(false);

  const teamLeads = users.filter(
    (u) => u.status === "active" && ["team_lead", "admin", "senior_counselor"].includes(u.role)
  );
  const isAdmin = currentUser?.role === "admin";

  const fetchFloor = useCallback(async () => {
    setLoading(true);
    try {
      const qs = teamLeadFilter !== "all" ? `?team_lead_id=${encodeURIComponent(teamLeadFilter)}` : "";
      const res = await fetch(`/api/daily-ops/floor${qs}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } finally {
      setLoading(false);
    }
  }, [teamLeadFilter]);

  const fetchTargets = useCallback(async () => {
    const res = await fetch("/api/daily-ops/targets", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setAllTargets(data);
      setTargetForm(data.defaultTarget);
      setTargetScopeUserId("__default__");
    }
  }, []);

  useEffect(() => {
    fetchFloor();
  }, [fetchFloor]);

  const handleOpenTargets = async () => {
    await fetchTargets();
    setShowTargetsModal(true);
  };

  const handleScopeChange = (val: string) => {
    setTargetScopeUserId(val);
    if (val === "__default__") {
      setTargetForm(allTargets.defaultTarget);
    } else {
      const found = allTargets.overrides.find((o) => o.user_id === val);
      setTargetForm(found ? { ...found } : { ...allTargets.defaultTarget, user_id: val });
    }
  };

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTarget(true);
    try {
      const res = await fetch("/api/daily-ops/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: targetScopeUserId === "__default__" ? null : targetScopeUserId,
          calls_target: Number(targetForm.calls_target),
          connected_target: Number(targetForm.connected_target),
          whatsapp_target: Number(targetForm.whatsapp_target),
          tasks_target: Number(targetForm.tasks_target),
          conversions_target: Number(targetForm.conversions_target),
        }),
      });
      if (res.ok) {
        setShowTargetsModal(false);
        fetchFloor();
      }
    } finally {
      setSavingTarget(false);
    }
  };

  const checkedInCount = members.filter((m) => m.checkin?.checked_in_at).length;
  const onCallsCount = members.filter((m) => m.checkin?.presence_status === "on_calls").length;
  const overdueTotal = members.reduce((acc, m) => acc + m.tasks.overdue, 0);
  const pendingReviewTotal = members.reduce((acc, m) => acc + m.tasks.pendingReview, 0);
  const eodCount = members.filter((m) => m.checkin?.eod_submitted_at).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Live Team Floor & Daily Standup
            </h3>
            <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
              {currentUser?.role === "team_lead" ? "My Team Pod" : "All Teams"}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time caller presence, daily quota attainment, task bottlenecks, and EOD check-outs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && teamLeads.length > 0 && (
            <select
              value={teamLeadFilter}
              onChange={(e) => setTeamLeadFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700"
            >
              <option value="all">All Team Leads</option>
              {teamLeads.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  Pod: {tl.name}
                </option>
              ))}
              <option value="__unassigned__">Unassigned (Admin)</option>
            </select>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenTargets}
            className="h-8 text-xs gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-600" />
            Daily Targets
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchFloor}
            disabled={loading}
            className="h-8 text-xs gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
          <div className="text-[11px] font-medium text-slate-500">Checked In</div>
          <div className="text-lg font-bold text-slate-900">
            {checkedInCount} <span className="text-xs font-normal text-slate-400">/ {members.length}</span>
          </div>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
          <div className="text-[11px] font-medium text-blue-600">On Calls Now</div>
          <div className="text-lg font-bold text-blue-700">{onCallsCount}</div>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2">
          <div className="text-[11px] font-medium text-rose-600">Overdue Tasks</div>
          <div className="text-lg font-bold text-rose-700">{overdueTotal}</div>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
          <div className="text-[11px] font-medium text-amber-700">Pending Sign-off</div>
          <div className="text-lg font-bold text-amber-800">{pendingReviewTotal}</div>
        </div>
        <div className="rounded-lg border border-purple-100 bg-purple-50/50 px-3 py-2">
          <div className="text-[11px] font-medium text-purple-600">EOD Submitted</div>
          <div className="text-lg font-bold text-purple-700">
            {eodCount} <span className="text-xs font-normal text-purple-400">/ {members.length}</span>
          </div>
        </div>
      </div>

      {/* Caller Floor Cards */}
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
          <Users className="h-6 w-6 mx-auto mb-1.5 text-slate-300" />
          No callers found in this team scope yet. Assign callers to a Team Lead below to build pods.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {members.map((m) => {
            const pStatus: PresenceStatus = m.checkin?.checked_in_at
              ? m.checkin.presence_status
              : "offline";
            const meta = PRESENCE_META[pStatus] || PRESENCE_META.offline;
            const callsPct = Math.min(100, Math.round((m.autoStats.callsMade / Math.max(1, m.target.calls_target)) * 100));
            const tasksPct = Math.min(100, Math.round((m.autoStats.tasksCompleted / Math.max(1, m.target.tasks_target)) * 100));

            return (
              <div
                key={m.user.id}
                className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 space-y-2.5 hover:border-indigo-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="relative h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                      style={{ backgroundColor: m.user.avatar_color || "#4f46e5" }}
                    >
                      {m.user.name.slice(0, 2).toUpperCase()}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${meta.dotClass}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{m.user.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {m.user.team_lead_name ? `Pod: ${m.user.team_lead_name}` : m.user.role.replace("_", " ")}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] gap-1 shrink-0 ${meta.badgeClass}`}>
                    {meta.icon}
                    {meta.label}
                  </Badge>
                </div>

                {m.checkin?.morning_focus ? (
                  <div className="rounded-md bg-white border border-slate-100 px-2.5 py-1.5 text-[11px] text-slate-700">
                    <span className="font-semibold text-indigo-600">Focus: </span>
                    {m.checkin.morning_focus}
                  </div>
                ) : (
                  <div className="text-[11px] italic text-slate-400">No morning focus set yet</div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-medium">Calls Today</span>
                    <span className="font-semibold text-slate-800">
                      {m.autoStats.callsMade} / {m.target.calls_target} ({callsPct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${callsPct}%` }} />
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <span className="text-slate-600 font-medium">Tasks Done</span>
                    <span className="font-semibold text-slate-800">
                      {m.autoStats.tasksCompleted} / {m.target.tasks_target} ({tasksPct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${tasksPct}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <Badge variant="secondary" className="text-[10px]">
                    {m.autoStats.connectedCalls} Connected
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {m.autoStats.conversions} Converted
                  </Badge>
                  {m.bottlenecks.map((b, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 gap-1"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {b}
                    </Badge>
                  ))}
                </div>

                {m.checkin?.eod_submitted_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEodPreviewMember(m)}
                    className="w-full h-7 text-[11px] gap-1.5 bg-white"
                  >
                    <FileText className="h-3 w-3 text-purple-600" />
                    View EOD Summary
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* EOD Summary Modal */}
      <Dialog open={Boolean(eodPreviewMember)} onOpenChange={(o) => !o && setEodPreviewMember(null)}>
        <DialogContent className="sm:max-w-lg p-0">
          <DialogHeader className="px-6 py-4 border-b border-border/70 bg-muted/25">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-4 w-4 text-purple-600" />
              EOD Summary — {eodPreviewMember?.user.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submitted at{" "}
              {eodPreviewMember?.checkin?.eod_submitted_at
                ? new Date(eodPreviewMember.checkin.eod_submitted_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          {eodPreviewMember && (
            <div className="px-6 py-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl bg-muted/30 p-3 text-center border border-border/70">
                  <div className="text-[11px] text-muted-foreground">Calls</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">
                    {eodPreviewMember.checkin?.eod_auto_stats?.callsMade ?? eodPreviewMember.autoStats.callsMade}
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3 text-center border border-emerald-500/20">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400">Connected</div>
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {eodPreviewMember.checkin?.eod_auto_stats?.connectedCalls ??
                      eodPreviewMember.autoStats.connectedCalls}
                  </div>
                </div>
                <div className="rounded-xl bg-indigo-500/10 p-3 text-center border border-indigo-500/20">
                  <div className="text-[11px] text-indigo-700 dark:text-indigo-400">Tasks Done</div>
                  <div className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mt-0.5">
                    {eodPreviewMember.checkin?.eod_auto_stats?.tasksCompleted ??
                      eodPreviewMember.autoStats.tasksCompleted}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 p-3 bg-muted/20">
                <div className="font-semibold text-foreground mb-1">Caller Notes</div>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {eodPreviewMember.checkin?.eod_notes || "No notes provided."}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 p-3 bg-amber-500/10">
                <div className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Blockers / Help Needed</div>
                <p className="text-amber-900 dark:text-amber-200 whitespace-pre-wrap leading-relaxed">
                  {eodPreviewMember.checkin?.eod_blockers || "None reported."}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Daily Targets Config Modal */}
      <Dialog open={showTargetsModal} onOpenChange={setShowTargetsModal}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="px-6 py-4 border-b border-border/70 bg-muted/25">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Target className="h-4 w-4 text-indigo-600" />
              Configure Daily Quotas & Targets
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set the team-wide daily baseline or override targets for a specific caller.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveTargets}>
            <div className="px-6 py-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-semibold text-foreground">Target Scope</label>
                <select
                  value={targetScopeUserId}
                  onChange={(e) => handleScopeChange(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs"
                >
                  <option value="__default__">Team-Wide Default (All Callers)</option>
                  {users
                    .filter((u) => u.status === "active" && u.role !== "admin")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        Override: {u.name} ({u.role.replace("_", " ")})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-medium text-muted-foreground">Calls / Day</label>
                  <Input
                    type="number"
                    min={1}
                    className="h-9 rounded-xl"
                    value={targetForm.calls_target}
                    onChange={(e) => setTargetForm({ ...targetForm, calls_target: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-medium text-muted-foreground">Connected Calls</label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 rounded-xl"
                    value={targetForm.connected_target}
                    onChange={(e) => setTargetForm({ ...targetForm, connected_target: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-medium text-muted-foreground">WhatsApp Sent</label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 rounded-xl"
                    value={targetForm.whatsapp_target}
                    onChange={(e) => setTargetForm({ ...targetForm, whatsapp_target: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-medium text-muted-foreground">Work Tasks Done</label>
                  <Input
                    type="number"
                    min={1}
                    className="h-9 rounded-xl"
                    value={targetForm.tasks_target}
                    onChange={(e) => setTargetForm({ ...targetForm, tasks_target: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="block font-medium text-muted-foreground">Admissions / Conversions</label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 rounded-xl"
                    value={targetForm.conversions_target}
                    onChange={(e) => setTargetForm({ ...targetForm, conversions_target: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-xl" onClick={() => setShowTargetsModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-9 px-5 rounded-xl" disabled={savingTarget}>
                {savingTarget ? "Saving..." : "Save Targets"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
