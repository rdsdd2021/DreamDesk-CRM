"use client";

import React, { useState } from "react";
import { WhatsAppAiAssistResult } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Check, Loader2, Sparkles, Wand2, X } from "lucide-react";

interface WhatsAppAiCopilotPanelProps {
  assist: WhatsAppAiAssistResult | null;
  loading: boolean;
  error?: string | null;
  leadId?: number | null;
  assignedTo?: string | null;
  currentUserId?: string | null;
  onUseDraft: (text: string) => void;
  onUseTemplate?: (templateName: string, variables: Record<string, string>) => void;
  onDismiss: () => void;
  onNotify?: (text: string, type: "success" | "error") => void;
}

const INTENT_STYLES: Record<string, { label: string; className: string }> = {
  hot: {
    label: "Hot Intent",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  warm: {
    label: "Warm",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  fee_inquiry: {
    label: "Fee Inquiry",
    className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  },
  callback_requested: {
    label: "Callback Requested",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  cold: {
    label: "Cold",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  },
  not_interested: {
    label: "Not Interested",
    className: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  },
};

export function WhatsAppAiCopilotPanel({
  assist,
  loading,
  error,
  leadId,
  assignedTo,
  currentUserId,
  onUseDraft,
  onUseTemplate,
  onDismiss,
  onNotify,
}: WhatsAppAiCopilotPanelProps) {
  const [appliedFields, setAppliedFields] = useState<Record<string, boolean>>({});
  const [applyingField, setApplyingField] = useState<string | null>(null);
  const [taskCreated, setTaskCreated] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

  if (!loading && !error && !assist) return null;

  const handleApplyField = async (field: string, value: string, label: string) => {
    if (!leadId) {
      onNotify?.("Save this contact as a Lead first to apply fields.", "error");
      return;
    }
    setApplyingField(field);
    try {
      const res = await fetch(`/api/leads/${leadId}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update lead field");
      setAppliedFields((prev) => ({ ...prev, [field]: true }));
      onNotify?.(`Updated ${label} → "${value}"`, "success");
    } catch (err: any) {
      onNotify?.(err?.message || "Could not apply field", "error");
    } finally {
      setApplyingField(null);
    }
  };

  const handleCreateTask = async () => {
    if (!assist?.suggestedTask || !leadId) {
      onNotify?.("Save this contact as a Lead first to schedule a task.", "error");
      return;
    }
    const assignee = assignedTo || currentUserId;
    if (!assignee) {
      onNotify?.("No assignee available for this task.", "error");
      return;
    }
    setCreatingTask(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          assigned_to: assignee,
          title: assist.suggestedTask.title,
          description: assist.suggestedTask.notes || "Suggested by WhatsApp AI Copilot",
          priority: assist.suggestedTask.priority === "medium" ? "normal" : assist.suggestedTask.priority,
          due_date: assist.suggestedTask.due_at,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create task");
      setTaskCreated(true);
      onNotify?.(`Scheduled follow-up: "${assist.suggestedTask.title}"`, "success");
    } catch (err: any) {
      onNotify?.(err?.message || "Failed to schedule task", "error");
    } finally {
      setCreatingTask(false);
    }
  };

  const intentMeta = assist ? INTENT_STYLES[assist.intent] || INTENT_STYLES.warm : null;

  return (
    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="font-bold text-indigo-700 dark:text-indigo-300">Gemini AI Copilot</span>
          {intentMeta && (
            <Badge variant="outline" className={`text-[10px] py-0 ${intentMeta.className}`}>
              {intentMeta.label}
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
          title="Close AI Copilot"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground py-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
          <span>Analyzing thread & Knowledge Base with Gemini...</span>
        </div>
      )}

      {error && !loading && (
        <div className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5">
          {error}
        </div>
      )}

      {assist && !loading && (
        <div className="space-y-2">
          <p className="text-[11px] text-foreground/90 leading-snug">{assist.summary}</p>

          {/* Reply Drafts (24h Window Open) */}
          {assist.replyDrafts.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Click a draft to insert
              </div>
              <div className="flex flex-col gap-1">
                {assist.replyDrafts.map((draft, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onUseDraft(draft)}
                    className="text-left px-2.5 py-1.5 rounded-lg bg-card border border-border/80 hover:border-indigo-500/50 hover:bg-indigo-500/5 text-[11px] text-foreground transition-colors cursor-pointer flex items-start gap-1.5"
                  >
                    <Wand2 className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                    <span className="leading-snug">{draft}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Template (24h Window Closed) */}
          {assist.recommendedTemplate && onUseTemplate && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 truncate">
                  Recommended Template: {assist.recommendedTemplate.name}
                </div>
                {assist.recommendedTemplate.reason && (
                  <div className="text-[10px] text-muted-foreground truncate">
                    {assist.recommendedTemplate.reason}
                  </div>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  onUseTemplate(
                    assist.recommendedTemplate!.name,
                    assist.recommendedTemplate!.variables || {}
                  )
                }
                className="h-7 text-[11px] bg-amber-600 hover:bg-amber-700 text-white shrink-0 cursor-pointer"
              >
                Use & Pre-fill
              </Button>
            </div>
          )}

          {/* 1-Click Apply Chips (Extracted Fields & Follow-up Task) */}
          {(assist.extractedFields.length > 0 || assist.suggestedTask) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {assist.extractedFields.map((ef) => {
                const done = appliedFields[ef.field];
                const busy = applyingField === ef.field;
                return (
                  <button
                    key={ef.field}
                    type="button"
                    disabled={done || busy}
                    onClick={() => handleApplyField(ef.field, ef.value, ef.label)}
                    title={ef.reason || `Apply ${ef.label}`}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors cursor-pointer ${
                      done
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-card border-border hover:border-emerald-500/50 text-foreground"
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : done ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <span className="text-emerald-600 font-bold">+</span>
                    )}
                    <span>
                      {ef.label}: <strong>{ef.value}</strong>
                    </span>
                  </button>
                );
              })}

              {assist.suggestedTask && (
                <button
                  type="button"
                  disabled={taskCreated || creatingTask}
                  onClick={handleCreateTask}
                  title={assist.suggestedTask.notes || "Create follow-up task"}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors cursor-pointer ${
                    taskCreated
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                      : "bg-card border-indigo-500/30 hover:border-indigo-500 text-indigo-700 dark:text-indigo-300"
                  }`}
                >
                  {creatingTask ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : taskCreated ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <CalendarPlus className="w-3 h-3" />
                  )}
                  <span>
                    {taskCreated ? "Task Scheduled" : `Schedule: ${assist.suggestedTask.title}`}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
