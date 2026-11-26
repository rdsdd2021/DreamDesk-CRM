"use client";

import React, { useCallback, useEffect, useState } from "react";
import { User, WorkTaskTemplate } from "@/types/crm";
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
import { BookOpen, CheckSquare, Plus, Rocket, Trash2 } from "lucide-react";

interface SopPlaybookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onDeployed: () => void;
}

export function SopPlaybookModal({ open, onOpenChange, users, onDeployed }: SopPlaybookModalProps) {
  const [templates, setTemplates] = useState<WorkTaskTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  // Create template form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slot, setSlot] = useState<"morning" | "midday" | "evening" | "custom">("morning");
  const [requiresProof, setRequiresProof] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [checklistText, setChecklistText] = useState("");

  const activeCallers = users.filter((u) => u.status === "active" && u.role !== "admin");

  const loadTemplates = useCallback(async () => {
    const res = await fetch("/api/daily-ops/templates", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates || []);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTemplates();
      setResultMsg(null);
    }
  }, [open, loadTemplates]);

  const toggleTemplate = (id: number) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleUser = (id: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await fetch("/api/daily-ops/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        playbook_slot: slot,
        requires_proof: requiresProof,
        requires_approval: requiresApproval,
        checklist: checklistText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    if (res.ok) {
      setTitle("");
      setDescription("");
      setChecklistText("");
      setRequiresProof(false);
      setRequiresApproval(false);
      setShowCreate(false);
      loadTemplates();
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    await fetch(`/api/daily-ops/templates?id=${id}`, { method: "DELETE" });
    setSelectedTemplateIds((prev) => prev.filter((x) => x !== id));
    loadTemplates();
  };

  const handleDeploy = async () => {
    if (selectedTemplateIds.length === 0 || selectedUserIds.length === 0) return;
    setDeploying(true);
    setResultMsg(null);
    try {
      const res = await fetch("/api/daily-ops/templates/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateIds: selectedTemplateIds,
          targetUserIds: selectedUserIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResultMsg(
          `Assigned ${data.createdCount} task(s)${
            data.skippedDuplicates ? ` (${data.skippedDuplicates} already assigned today)` : ""
          }.`
        );
        onDeployed();
      }
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 max-h-[88vh]">
        <DialogHeader className="px-6 py-4 border-b border-border/70 bg-muted/25">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            SOP Playbooks & One-Click Daily Assignment
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select reusable SOP templates and deploy them to your callers in one click.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 text-xs overflow-y-auto max-h-[65vh]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800">1. Choose SOP Templates</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowCreate((v) => !v)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              New SOP Template
            </Button>
          </div>

          {showCreate && (
            <form
              onSubmit={handleCreateTemplate}
              className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 space-y-2.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Template title (e.g. Morning Dialer Prep)"
                  required
                />
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value as any)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                  <option value="morning">Morning Routine</option>
                  <option value="midday">Midday Follow-up</option>
                  <option value="evening">Evening Hygiene</option>
                  <option value="custom">Custom SOP</option>
                </select>
              </div>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short instructions for the caller..."
              />
              <textarea
                rows={2}
                value={checklistText}
                onChange={(e) => setChecklistText(e.target.value)}
                placeholder="Checklist steps (one per line)..."
                className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs"
              />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresProof}
                    onChange={(e) => setRequiresProof(e.target.checked)}
                  />
                  Require proof notes on completion
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresApproval}
                    onChange={(e) => setRequiresApproval(e.target.checked)}
                  />
                  Require Team Lead sign-off
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Save Template
                </Button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.map((tpl) => {
              const checked = selectedTemplateIds.includes(tpl.id);
              return (
                <div
                  key={tpl.id}
                  onClick={() => toggleTemplate(tpl.id)}
                  className={`rounded-lg border p-2.5 cursor-pointer transition-all ${
                    checked ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <CheckSquare
                        className={`h-3.5 w-3.5 shrink-0 ${checked ? "text-indigo-600" : "text-slate-300"}`}
                      />
                      <span>{tpl.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(tpl.id);
                      }}
                      className="text-slate-400 hover:text-rose-600"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {tpl.description && <p className="text-[11px] text-slate-500 mt-1">{tpl.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {tpl.playbook_slot}
                    </Badge>
                    {tpl.requires_proof && (
                      <Badge variant="secondary" className="text-[10px]">
                        Proof Required
                      </Badge>
                    )}
                    {tpl.requires_approval && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">
                        Sign-off Required
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">2. Select Callers</span>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px]"
                  onClick={() => setSelectedUserIds(activeCallers.map((u) => u.id))}
                >
                  Select All Active
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px]"
                  onClick={() => setSelectedUserIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeCallers.map((u) => {
                const selected = selectedUserIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-medium cursor-pointer transition-colors ${
                      selected
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>

          {resultMsg && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-emerald-700 dark:text-emerald-400 font-medium">
              {resultMsg}
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex justify-end gap-2.5">
          <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={deploying || selectedTemplateIds.length === 0 || selectedUserIds.length === 0}
            onClick={handleDeploy}
            className="h-9 px-5 rounded-xl gap-1.5 bg-indigo-600 hover:bg-indigo-700"
          >
            <Rocket className="h-3.5 w-3.5" />
            {deploying ? "Deploying..." : "Deploy Playbook"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
