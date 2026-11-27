"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Disposition,
  DispositionSopRule,
  TaskPriority,
  User,
  WorkTaskTemplate,
} from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  GitBranch,
  ListChecks,
  PhoneCall,
  Plus,
  Trash2,
  UserCheck,
  Zap,
} from "lucide-react";

interface DispositionSopRulesPanelProps {
  dispositions: Disposition[];
}

export function DispositionSopRulesPanel({ dispositions }: DispositionSopRulesPanelProps) {
  const [rules, setRules] = useState<DispositionSopRule[]>([]);
  const [templates, setTemplates] = useState<WorkTaskTemplate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [dispositionId, setDispositionId] = useState("");
  const [subDispositionId, setSubDispositionId] = useState("");
  const [targetRole, setTargetRole] = useState<DispositionSopRule["target_role"]>("team_lead");
  const [specificUserId, setSpecificUserId] = useState("");
  const [taskMode, setTaskMode] = useState<DispositionSopRule["task_mode"]>("both");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("high");
  const [slaHours, setSlaHours] = useState(4);
  const [requiresProof, setRequiresProof] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [rulesRes, tplRes, usersRes] = await Promise.all([
        fetch("/api/dispositions/sop-rules", { cache: "no-store" }),
        fetch("/api/daily-ops/templates", { cache: "no-store" }),
        fetch("/api/users", { cache: "no-store" }),
      ]);
      if (rulesRes.ok) {
        const d = await rulesRes.json();
        setRules(d.rules || []);
      }
      if (tplRes.ok) {
        const d = await tplRes.json();
        setTemplates(d.templates || []);
      }
      if (usersRes.ok) {
        const d = await usersRes.json();
        if (Array.isArray(d)) setUsers(d.filter((u: User) => u.status === "active"));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selectedDisposition = dispositions.find((d) => d.id === dispositionId);
  const availableSubs = selectedDisposition?.sub_dispositions || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || (!dispositionId && !subDispositionId)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dispositions/sop-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition_id: dispositionId || null,
          sub_disposition_id: subDispositionId || null,
          target_role: targetRole,
          specific_user_id: specificUserId || null,
          task_mode: taskMode,
          template_id: templateId ? Number(templateId) : null,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          sla_hours: Number(slaHours),
          requires_proof: requiresProof,
          requires_approval: requiresApproval,
        }),
      });
      if (res.ok) {
        setTitle("");
        setDescription("");
        setTemplateId("");
        setSpecificUserId("");
        setRequiresProof(false);
        setRequiresApproval(false);
        setShowForm(false);
        loadAll();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/dispositions/sop-rules?id=${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-600" />
            <span>Disposition → SOP Automation Rules</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically trigger Call Tasks and/or Daily Work Tasks for specific user roles whenever a disposition or sub-disposition is logged. Link multiple rules to any disposition.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add SOP Trigger Rule</span>
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-indigo-500/30 bg-indigo-500/[0.03] p-4 space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold">When Disposition Is *</label>
              <select
                required
                value={dispositionId}
                onChange={(e) => {
                  setDispositionId(e.target.value);
                  setSubDispositionId("");
                }}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="">Select disposition...</option>
                {dispositions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Sub-Disposition (Optional)</label>
              <select
                value={subDispositionId}
                disabled={availableSubs.length === 0}
                onChange={(e) => setSubDispositionId(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs disabled:opacity-50"
              >
                <option value="">Any sub-disposition (whole outcome)</option>
                {availableSubs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Create Task Type</label>
              <select
                value={taskMode}
                onChange={(e) => setTaskMode(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="call_task">Call Task Only</option>
                <option value="daily_task">Daily / Work Task Only</option>
                <option value="both">Both Call Task &amp; Daily Task</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Target User Role</label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="team_lead">Team Lead (Caller&apos;s Pod Lead)</option>
                <option value="senior_counselor">Senior Counselor</option>
                <option value="counselor">Counselor</option>
                <option value="telecaller">Telecaller</option>
                <option value="lead_owner">Lead&apos;s Assigned Owner</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Specific Person Override (Optional)</label>
              <select
                value={specificUserId}
                onChange={(e) => setSpecificUserId(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="">Smart Route by Role</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Link SOP Template (Optional)</label>
              <select
                value={templateId}
                onChange={(e) => {
                  const val = e.target.value;
                  setTemplateId(val);
                  const found = templates.find((t) => String(t.id) === val);
                  if (found && !title.trim()) {
                    setTitle(found.title);
                    setDescription(found.description || "");
                    setRequiresProof(found.requires_proof);
                    setRequiresApproval(found.requires_approval);
                  }
                }}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="">Custom Task (No Template)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.playbook_slot})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold">Triggered Task Title *</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Follow up Campus Visit & verify parent documents"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full h-9 rounded-lg border border-border bg-background px-2 text-xs"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold">SLA (Hours)</label>
                <Input
                  type="number"
                  min={1}
                  value={slaHours}
                  onChange={(e) => setSlaHours(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={requiresProof}
                  onChange={(e) => setRequiresProof(e.target.checked)}
                />
                Require proof notes
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                />
                Require Team Lead sign-off
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving..." : "Save Trigger Rule"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No Disposition → SOP automation rules configured yet. Click &quot;Add SOP Trigger Rule&quot; to link dispositions to Call or Daily Tasks.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {rules.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-border/80 bg-muted/20 p-3 flex items-start justify-between gap-2 text-xs"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30">
                    <Zap className="w-2.5 h-2.5 mr-1" />
                    {r.disposition_name || "Disposition"}
                    {r.sub_disposition_name ? ` → ${r.sub_disposition_name}` : ""}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    {r.task_mode === "call_task" ? (
                      <>
                        <PhoneCall className="w-2.5 h-2.5" /> Call Task
                      </>
                    ) : r.task_mode === "daily_task" ? (
                      <>
                        <ListChecks className="w-2.5 h-2.5" /> Daily Task
                      </>
                    ) : (
                      <>
                        <ListChecks className="w-2.5 h-2.5" /> Call + Daily Task
                      </>
                    )}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1 capitalize">
                    <UserCheck className="w-2.5 h-2.5" />
                    {r.specific_user_name ? r.specific_user_name : r.target_role.replace("_", " ")}
                  </Badge>
                </div>
                <div className="font-semibold text-foreground">{r.title}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>SLA: {r.sla_hours}h</span>
                  <span>• Priority: {r.priority}</span>
                  {r.template_title && <span>• SOP: {r.template_title}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="text-muted-foreground hover:text-destructive p-1 cursor-pointer shrink-0"
                title="Remove rule"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
