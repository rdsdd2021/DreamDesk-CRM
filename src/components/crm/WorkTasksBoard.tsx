"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User, WorkTask, WorkTaskType, WorkTaskRecurrence, TaskPriority } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  Circle,
  Clock,
  Repeat,
  Timer,
  Link2,
  BellRing,
  Plus,
  Play,
  Trash2,
  Loader2,
  X,
  AlertTriangle,
  CheckSquare,
  Square,
  Sparkles,
  BookOpen,
  ShieldCheck,
  FileCheck2,
  Send,
  RotateCcw,
} from "lucide-react";
import { SopPlaybookModal } from "@/components/crm/SopPlaybookModal";

interface WorkTasksBoardProps {
  roleMode: "admin" | "counselor";
  users: User[];
}

export function WorkTasksBoard({ roleMode, users }: WorkTasksBoardProps) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [remindedTaskIds, setRemindedTaskIds] = useState<Record<number, boolean>>({});
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<WorkTaskType>("one_time");
  const [newRecurrence, setNewRecurrence] = useState<WorkTaskRecurrence>("daily");
  const [newTimeLimit, setNewTimeLimit] = useState<number>(30);
  const [newDueAt, setNewDueAt] = useState<string>("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("normal");
  const [newAssignedTo, setNewAssignedTo] = useState<string>("");
  const [newDependsOnId, setNewDependsOnId] = useState<string>("");
  const [newChecklistText, setNewChecklistText] = useState<string>("");
  const [newRequiresProof, setNewRequiresProof] = useState(false);
  const [newRequiresApproval, setNewRequiresApproval] = useState(false);
  const [creating, setCreating] = useState(false);

  // Playbook, Proof, Review & Nudge Modals
  const [isPlaybookOpen, setIsPlaybookOpen] = useState(false);
  const [proofTask, setProofTask] = useState<WorkTask | null>(null);
  const [proofText, setProofText] = useState("");
  const [reviewTask, setReviewTask] = useState<WorkTask | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("task_type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/work-tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Live 15-second tick for timed task countdowns
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setCreating(true);
      const checklist = newChecklistText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/work-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          task_type: newType,
          recurrence_rule: newType === "recurring" ? newRecurrence : null,
          time_limit_minutes: newType === "timed" ? newTimeLimit : null,
          due_at: newDueAt ? new Date(newDueAt).toISOString() : null,
          priority: newPriority,
          assigned_to: newAssignedTo || undefined,
          depends_on_task_id: newDependsOnId ? Number(newDependsOnId) : null,
          checklist: checklist.length > 0 ? checklist : undefined,
          requires_proof: newRequiresProof,
          requires_approval: newRequiresApproval,
        }),
      });
      if (res.ok) {
        setIsCreateOpen(false);
        setNewTitle("");
        setNewDesc("");
        setNewDueAt("");
        setNewDependsOnId("");
        setNewChecklistText("");
        setNewRequiresProof(false);
        setNewRequiresApproval(false);
        loadTasks();
      }
    } finally {
      setCreating(false);
    }
  };

  const handlePatchTask = async (taskId: number, payload: Record<string, any>) => {
    try {
      setBusyTaskId(taskId);
      const res = await fetch(`/api/work-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
        } else {
          loadTasks();
        }
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleRemind = async (taskId: number) => {
    await handlePatchTask(taskId, { remind_dependency: true });
    setRemindedTaskIds((prev) => ({ ...prev, [taskId]: true }));
    setTimeout(() => {
      setRemindedTaskIds((prev) => ({ ...prev, [taskId]: false }));
    }, 3000);
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm("Archive this work task? Its historical logs will remain in Track & Print.")) return;
    const res = await fetch(`/api/work-tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const handleToggleDone = async (task: WorkTask) => {
    if (task.status !== "done" && task.requires_proof && !task.proof_notes) {
      setProofTask(task);
      setProofText("");
      return;
    }
    await handlePatchTask(task.id, {
      status: task.status === "done" ? "todo" : "done",
    });
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofTask || !proofText.trim()) return;
    await handlePatchTask(proofTask.id, {
      status: "done",
      proof_notes: proofText.trim(),
    });
    setProofTask(null);
    setProofText("");
  };

  const handleReviewDecision = async (taskId: number, decision: "approved" | "revision_requested", feedback?: string) => {
    setBusyTaskId(taskId);
    try {
      const res = await fetch(`/api/work-tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, feedback }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
        }
        setReviewTask(null);
        setReviewFeedback("");
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleNudge = async (taskId: number) => {
    setBusyTaskId(taskId);
    try {
      const res = await fetch(`/api/work-tasks/${taskId}/nudge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task) {
          setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
        }
      }
    } finally {
      setBusyTaskId(null);
    }
  };

  const getTimerText = (task: WorkTask) => {
    if (!task.time_limit_minutes) return null;
    if (!task.started_at) return `${task.time_limit_minutes}m limit`;
    const elapsedMin = Math.floor((nowMs - new Date(task.started_at).getTime()) / 60000);
    const left = task.time_limit_minutes - elapsedMin;
    if (left <= 0) return `Time up (${Math.abs(left)}m over)`;
    return `${left}m left`;
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: "All Types" },
            { id: "recurring", label: "Daily / Recurring" },
            { id: "timed", label: "Time-Limited" },
            { id: "one_time", label: "One-Time" },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setTypeFilter(chip.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                typeFilter === chip.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium"
          >
            <option value="all">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>

          {roleMode === "admin" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsPlaybookOpen(true)}
                className="h-8 gap-1.5 text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>SOP Playbooks</span>
              </Button>

              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="h-8 gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Task</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Loading work tasks...</span>
        </div>
      ) : tasks.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-10 text-center space-y-2 bg-card/40">
          <Sparkles className="w-7 h-7 text-primary mx-auto opacity-70" />
          <div className="text-sm font-bold">No operational tasks yet</div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Create daily recurring checklists, timed tasks, or tasks linked to a teammate&apos;s task.
          </p>
          {roleMode === "admin" && (
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2 gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Task</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const isDone = task.status === "done";
            const timerLabel = getTimerText(task);
            const isOverdue =
              !isDone && task.due_at && new Date(task.due_at).getTime() < nowMs;

            return (
              <div
                key={task.id}
                className={`border rounded-2xl p-3.5 sm:p-4 bg-card transition-all space-y-3 ${
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                    : task.is_blocked
                    ? "border-amber-500/40 bg-amber-500/[0.02]"
                    : "border-border/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* 1-Tap Progress / Done Checkbox Button */}
                  <button
                    type="button"
                    disabled={busyTaskId === task.id}
                    onClick={() => handleToggleDone(task)}
                    className="mt-0.5 shrink-0 cursor-pointer transition-transform active:scale-90"
                    title={isDone ? "Mark as To Do" : "Mark Done"}
                  >
                    {busyTaskId === task.id ? (
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    ) : isDone ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    ) : (
                      <Circle className="w-6 h-6 text-muted-foreground hover:text-primary" />
                    )}
                  </button>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3
                          className={`text-sm font-bold leading-snug ${
                            isDone ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </div>

                      {roleMode === "admin" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(task.id)}
                          className="text-muted-foreground/60 hover:text-destructive p-1 cursor-pointer"
                          title="Archive task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Badges Row */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      {task.task_type === "recurring" && (
                        <Badge
                          variant="outline"
                          className="gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 capitalize"
                        >
                          <Repeat className="w-3 h-3" />
                          <span>{task.recurrence_rule || "daily"}</span>
                          {task.completion_count ? ` • ${task.completion_count}x` : ""}
                        </Badge>
                      )}

                      {task.task_type === "timed" && timerLabel && (
                        <Badge
                          variant="outline"
                          className="gap-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30"
                        >
                          <Timer className="w-3 h-3" />
                          <span>{timerLabel}</span>
                        </Badge>
                      )}

                      {task.due_at && (
                        <Badge
                          variant="outline"
                          className={`gap-1 ${
                            isOverdue
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : "bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>
                            Due{" "}
                            {new Date(task.due_at).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </Badge>
                      )}

                      {task.assigned_user_name && (
                        <Badge variant="outline" className="text-[10px] font-medium">
                          Owner: {task.assigned_user_name}
                        </Badge>
                      )}

                      {task.requires_proof && (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-slate-50 text-slate-600">
                          <FileCheck2 className="w-3 h-3" />
                          Proof Required
                        </Badge>
                      )}

                      {task.approval_status === "pending_review" && (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200">
                          <ShieldCheck className="w-3 h-3" />
                          Pending Sign-off
                        </Badge>
                      )}
                      {task.approval_status === "approved" && (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                          <ShieldCheck className="w-3 h-3" />
                          Approved{task.reviewed_by_name ? ` by ${task.reviewed_by_name}` : ""}
                        </Badge>
                      )}
                      {task.approval_status === "revision_requested" && (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-rose-50 text-rose-700 border-rose-200">
                          <RotateCcw className="w-3 h-3" />
                          Revision Requested
                        </Badge>
                      )}
                      {(task.nudge_count || 0) > 0 && !isDone && (
                        <Badge variant="outline" className="text-[10px] gap-1 bg-rose-600 text-white border-rose-600">
                          <BellRing className="w-3 h-3" />
                          Nudged ({task.nudge_count}x)
                        </Badge>
                      )}
                    </div>

                    {task.proof_notes && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 text-[11px] text-slate-700">
                        <span className="font-semibold text-slate-900">Proof: </span>
                        {task.proof_notes}
                      </div>
                    )}

                    {task.review_feedback && task.approval_status === "revision_requested" && (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[11px] text-rose-800">
                        <span className="font-semibold">Lead Feedback: </span>
                        {task.review_feedback}
                      </div>
                    )}

                    {/* Soft Dependency Warning + 1-Tap Remind */}
                    {task.depends_on && (
                      <div
                        className={`flex items-center justify-between gap-2 flex-wrap p-2 rounded-xl border text-xs ${
                          task.is_blocked
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {task.is_blocked ? (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span className="truncate">
                            {task.is_blocked ? "Waiting on: " : "Linked task ready: "}
                            <strong>{task.depends_on.title}</strong>
                            {task.depends_on.assigned_user_name
                              ? ` (${task.depends_on.assigned_user_name})`
                              : ""}
                          </span>
                        </div>

                        {task.is_blocked && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemind(task.id)}
                            disabled={remindedTaskIds[task.id]}
                            className="h-7 px-2.5 text-[11px] gap-1 bg-background/80 border-amber-500/40"
                          >
                            <BellRing className="w-3 h-3" />
                            <span>{remindedTaskIds[task.id] ? "Reminded!" : "Remind"}</span>
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Optional Sub-Checklist */}
                    {task.checklist && task.checklist.length > 0 && (
                      <div className="space-y-1 pt-1">
                        {task.checklist.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              handlePatchTask(task.id, { toggle_checklist_id: item.id })
                            }
                            className="w-full flex items-center gap-2 text-left text-xs py-1 px-2 rounded-lg hover:bg-muted/40 cursor-pointer"
                          >
                            {item.is_done ? (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span
                              className={
                                item.is_done
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground"
                              }
                            >
                              {item.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Simple Progress Bar + Quick Action Buttons */}
                    <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              isDone ? "bg-emerald-500" : "bg-primary"
                            }`}
                            style={{ width: `${task.progress_pct}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-muted-foreground w-9 text-right">
                          {task.progress_pct}%
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {task.task_type === "timed" && !task.started_at && !isDone && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handlePatchTask(task.id, { start_timer: true })}
                            className="h-7 px-2 text-[11px] gap-1 text-violet-600 border-violet-500/30"
                          >
                            <Play className="w-3 h-3" />
                            <span>Start</span>
                          </Button>
                        )}
                        {roleMode === "admin" && isOverdue && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyTaskId === task.id}
                            onClick={() => handleNudge(task.id)}
                            className="h-7 px-2 text-[11px] gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            <Send className="w-3 h-3" />
                            <span>Nudge</span>
                          </Button>
                        )}
                        {roleMode === "admin" && task.approval_status === "pending_review" && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={busyTaskId === task.id}
                              onClick={() => handleReviewDecision(task.id, "approved")}
                              className="h-7 px-2 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <ShieldCheck className="w-3 h-3" />
                              <span>Approve</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busyTaskId === task.id}
                              onClick={() => {
                                setReviewTask(task);
                                setReviewFeedback("");
                              }}
                              className="h-7 px-2 text-[11px] gap-1 text-amber-700 border-amber-200 hover:bg-amber-50"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Revise</span>
                            </Button>
                          </>
                        )}
                        {[25, 50, 75].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handlePatchTask(task.id, { progress_pct: pct })}
                            className={`px-2 py-1 rounded-md text-[10px] font-mono font-semibold border cursor-pointer ${
                              task.progress_pct === pct
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-muted/30 text-muted-foreground border-border/60 hover:text-foreground"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE WORK TASK MODAL */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsCreateOpen(false)}
        >
          <form
            onSubmit={handleCreateTask}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="text-sm font-bold">New Operational / Daily Task</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg hover:bg-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold">Task Title *</label>
                <Input
                  required
                  placeholder="e.g. Audit daily lead sheet & send summary"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Task Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "one_time", label: "One-Time" },
                    { id: "recurring", label: "Recurring" },
                    { id: "timed", label: "Time-Limited" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewType(t.id as WorkTaskType)}
                      className={`py-2 rounded-lg border font-semibold cursor-pointer ${
                        newType === t.id
                          ? "bg-primary/15 text-primary border-primary"
                          : "bg-muted/20 text-muted-foreground border-border"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {newType === "recurring" && (
                <div className="space-y-1">
                  <label className="font-semibold">Repeat Schedule</label>
                  <select
                    value={newRecurrence}
                    onChange={(e) => setNewRecurrence(e.target.value as WorkTaskRecurrence)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
                  >
                    <option value="daily">Every Day (Daily)</option>
                    <option value="weekdays">Weekdays (Mon–Fri)</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}

              {newType === "timed" && (
                <div className="space-y-1">
                  <label className="font-semibold">Time Limit (Minutes)</label>
                  <div className="flex items-center gap-2">
                    {[15, 30, 60, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNewTimeLimit(m)}
                        className={`px-3 py-1.5 rounded-lg border font-mono cursor-pointer ${
                          newTimeLimit === m
                            ? "bg-primary/15 text-primary border-primary"
                            : "bg-muted/20 border-border text-muted-foreground"
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                    <Input
                      type="number"
                      min={1}
                      value={newTimeLimit}
                      onChange={(e) => setNewTimeLimit(parseInt(e.target.value, 10) || 30)}
                      className="w-20 h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold">Deadline (Optional)</label>
                  <Input
                    type="datetime-local"
                    value={newDueAt}
                    onChange={(e) => setNewDueAt(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {roleMode === "admin" && users.length > 0 && (
                <div className="space-y-1">
                  <label className="font-semibold">Assign To Staff Member</label>
                  <select
                    value={newAssignedTo}
                    onChange={(e) => setNewAssignedTo(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
                  >
                    <option value="">Myself</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold">Link to Another Task (Optional)</label>
                <select
                  value={newDependsOnId}
                  onChange={(e) => setNewDependsOnId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
                >
                  <option value="">None (Independent Task)</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.id}: {t.title} ({t.assigned_user_name || "Staff"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Notes / Description (Optional)</label>
                <Input
                  placeholder="Extra instructions..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Checklist Sub-Steps (One per line, optional)</label>
                <textarea
                  rows={3}
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder={"Verify CSV count\nCheck duplicate leads\nNotify team lead"}
                  className="w-full p-2.5 rounded-lg border border-border bg-background text-xs resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={newRequiresProof}
                    onChange={(e) => setNewRequiresProof(e.target.checked)}
                  />
                  Require proof notes on completion
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={newRequiresApproval}
                    onChange={(e) => setNewRequiresApproval(e.target.checked)}
                  />
                  Require Team Lead sign-off
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={creating} className="gap-1.5">
                {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Create Task</span>
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* SOP Playbooks Modal */}
      <SopPlaybookModal
        open={isPlaybookOpen}
        onOpenChange={setIsPlaybookOpen}
        users={users}
        onDeployed={loadTasks}
      />

      {/* Proof Notes Modal */}
      {proofTask && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setProofTask(null)}
        >
          <form
            onSubmit={handleProofSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border/80 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-border/70 bg-muted/25 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-600" />
                Completion Proof Required
              </h3>
              <button
                type="button"
                onClick={() => setProofTask(null)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add a short proof note or summary for &quot;{proofTask.title}&quot; before marking it complete.
              </p>
              <textarea
                rows={3}
                required
                value={proofText}
                onChange={(e) => setProofText(e.target.value)}
                placeholder="e.g. Updated 18 stale leads and scheduled callbacks for tomorrow 11 AM..."
                className="w-full p-3 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-y"
              />
            </div>
            <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-xl" onClick={() => setProofTask(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700">
                Submit Proof & Complete
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Request Revision Feedback Modal */}
      {reviewTask && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/55 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setReviewTask(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleReviewDecision(reviewTask.id, "revision_requested", reviewFeedback);
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border/80 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-border/70 bg-muted/25 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                Request Task Revision
              </h3>
              <button
                type="button"
                onClick={() => setReviewTask(null)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tell {reviewTask.assigned_user_name || "the caller"} what needs to be fixed on &quot;{reviewTask.title}&quot;.
              </p>
              <textarea
                rows={3}
                required
                value={reviewFeedback}
                onChange={(e) => setReviewFeedback(e.target.value)}
                placeholder="e.g. Please include the list of lead IDs you followed up on..."
                className="w-full p-3 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-y"
              />
            </div>
            <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-xl" onClick={() => setReviewTask(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-9 px-5 rounded-xl bg-amber-600 hover:bg-amber-700">
                Send Back for Revision
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
