"use client";

import React, { useEffect, useState } from "react";
import { AiCommandResponse, AiProposedAction, User } from "@/types/crm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Filter,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: AiCommandResponse;
  executedMsg?: string;
}

interface GlobalAiCopilotDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentUser: User | null;
  currentView: string;
  onApplyFilters: (filters: NonNullable<AiCommandResponse["applyFilters"]>) => void;
  onActionExecuted: (actionType: AiProposedAction["type"], message: string) => void;
}

export function GlobalAiCopilotDrawer({
  isOpen,
  onOpenChange,
  currentUser,
  currentView,
  onApplyFilters,
  onActionExecuted,
}: GlobalAiCopilotDrawerProps) {
  const isOps = Boolean(currentUser && ["admin", "team_lead"].includes(currentUser.role));

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [brief, setBrief] = useState<AiCommandResponse | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const quickPrompts = isOps
    ? [
        "Summarize today's counselor workload and campaign breakdown",
        "Show unassigned New Leads so I can review them",
        "Set my status to available",
        "Tag all Cold leads as Follow-up Needed",
      ]
    : [
        "What are my top priorities right now?",
        "Show my Follow-up leads",
        "Set my status to on_break",
        "Open my WhatsApp Inbox",
      ];

  const loadShiftBrief = async () => {
    setLoadingBrief(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/command", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load shift brief");
      setBrief(data.result);
    } catch (err: any) {
      setError(err?.message || "Could not load AI shift brief");
    } finally {
      setLoadingBrief(false);
    }
  };

  useEffect(() => {
    if (isOpen && !brief && !loadingBrief) {
      loadShiftBrief();
    }
  }, [isOpen]);

  const handleSend = async (customPrompt?: string) => {
    const q = (customPrompt ?? prompt).trim();
    if (!q || loading) return;
    if (!customPrompt) setPrompt("");
    setError(null);

    const userTurn: ChatTurn = { id: `u_${Date.now()}`, role: "user", text: q };
    setTurns((prev) => [...prev, userTurn]);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "plan", prompt: q, current_view: currentView }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI Copilot failed");
      const assistantTurn: ChatTurn = {
        id: `a_${Date.now()}`,
        role: "assistant",
        text: data.result?.answer || "Done.",
        response: data.result,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err: any) {
      setError(err?.message || "AI request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (turnId: string, action: AiProposedAction) => {
    setExecutingId(turnId);
    setError(null);
    try {
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "execute", action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution failed");
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, executedMsg: data.message } : t))
      );
      onActionExecuted(action.type, data.message || "Action executed");
    } catch (err: any) {
      setError(err?.message || "Failed to execute action");
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-4 py-3.5 border-b border-border/80 bg-card shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <SheetTitle className="text-sm font-bold">DreamDesk AI Copilot</SheetTitle>
                <SheetDescription className="text-[11px]">
                  {isOps
                    ? "Reports, Bulk Actions, Assignments & Shift Brief"
                    : "Your Leads, Tasks, Status & Shift Brief"}
                </SheetDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              Ctrl+J
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
          {/* Daily Shift Brief Card */}
          <div className="rounded-xl border border-indigo-500/25 bg-card p-3 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Live Shift Brief
              </span>
              <button
                type="button"
                onClick={loadShiftBrief}
                disabled={loadingBrief}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {loadingBrief ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {loadingBrief && !brief ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Preparing your live CRM brief...</span>
              </div>
            ) : brief ? (
              <>
                <p className="text-xs text-foreground/90 leading-relaxed">{brief.answer}</p>
                {brief.highlights && brief.highlights.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {brief.highlights.map((h, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-muted/50 border border-border/60 px-2.5 py-1.5"
                      >
                        <div className="text-[10px] text-muted-foreground truncate">{h.label}</div>
                        <div className="text-xs font-bold text-foreground truncate">{h.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Quick Prompt Chips */}
          {turns.length === 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Try asking
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((qp) => (
                  <button
                    key={qp}
                    type="button"
                    onClick={() => handleSend(qp)}
                    className="text-left px-2.5 py-1.5 rounded-lg bg-card border border-border/80 hover:border-indigo-500/50 text-[11px] text-foreground transition-colors cursor-pointer"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Turns */}
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={`flex flex-col gap-1.5 ${
                turn.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  turn.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-xs"
                    : "bg-card border border-border/80 text-foreground rounded-bl-xs space-y-2 shadow-2xs"
                }`}
              >
                <p className="whitespace-pre-wrap">{turn.text}</p>

                {turn.response?.highlights && turn.response.highlights.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {turn.response.highlights.map((h, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-muted/50 border border-border/60 px-2 py-1"
                      >
                        <div className="text-[10px] text-muted-foreground truncate">{h.label}</div>
                        <div className="text-[11px] font-bold text-foreground truncate">{h.value}</div>
                      </div>
                    ))}
                  </div>
                )}

                {turn.response?.applyFilters && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onApplyFilters(turn.response!.applyFilters!);
                      onOpenChange(false);
                    }}
                    className="h-7 text-[11px] gap-1.5 cursor-pointer"
                  >
                    <Filter className="w-3 h-3 text-indigo-600" />
                    <span>Apply Filters & Open View</span>
                  </Button>
                )}

                {turn.response?.proposedAction && (
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-2.5 space-y-2">
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-foreground">
                          {turn.response.proposedAction.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {turn.response.proposedAction.summary}
                        </div>
                        <div className="text-[10px] font-mono font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
                          Affected records: {turn.response.proposedAction.affectedCount.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {turn.executedMsg ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{turn.executedMsg}</span>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          executingId === turn.id ||
                          turn.response.proposedAction.affectedCount === 0
                        }
                        onClick={() =>
                          handleExecuteAction(turn.id, turn.response!.proposedAction!)
                        }
                        className="h-7 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                      >
                        {executingId === turn.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            Executing...
                          </>
                        ) : (
                          "Confirm & Execute"
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>Thinking with Gemini...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t border-border/80 bg-card flex items-center gap-2 shrink-0"
        >
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask reports, filter leads, or run bulk actions..."
            className="h-9 text-xs flex-1"
          />
          <Button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
