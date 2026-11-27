"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BroadcastActionButton,
  BroadcastActionVariant,
  BroadcastRecipientRecord,
  BroadcastRecord,
  BroadcastTargetType,
  TaskPriority,
  User,
} from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Clock,
  Eye,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";

interface BroadcastsWorkspaceProps {
  currentUser: User | null;
  onShowToast?: (text: string, type: "success" | "error") => void;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "counselor", label: "Counselor" },
  { value: "senior_counselor", label: "Senior Counselor" },
  { value: "telecaller", label: "Telecaller" },
  { value: "team_lead", label: "Team Lead" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
];

const BUTTON_PRESETS: BroadcastActionButton[] = [
  { id: "acknowledge", label: "Acknowledge", variant: "success" },
  { id: "on_it", label: "On It", variant: "primary" },
  { id: "need_help", label: "Need Help", variant: "warning" },
  { id: "cannot_attend", label: "Cannot Attend", variant: "danger" },
];

const VARIANT_CLASSES: Record<BroadcastActionVariant, string> = {
  primary: "bg-indigo-600 text-white border-indigo-600",
  secondary: "bg-muted text-foreground border-border",
  success: "bg-emerald-600 text-white border-emerald-600",
  warning: "bg-amber-500 text-white border-amber-500",
  danger: "bg-rose-600 text-white border-rose-600",
};

export function BroadcastsWorkspace({ currentUser, onShowToast }: BroadcastsWorkspaceProps) {
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Composer State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [targetType, setTargetType] = useState<BroadcastTargetType>("all");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [actionButtons, setActionButtons] = useState<BroadcastActionButton[]>([
    { id: "acknowledge", label: "Acknowledge", variant: "success" },
  ]);
  const [newBtnLabel, setNewBtnLabel] = useState("");
  const [newBtnVariant, setNewBtnVariant] = useState<BroadcastActionVariant>("primary");
  const [requireAck, setRequireAck] = useState(false);

  // Audit Detail Modal
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditDetail, setAuditDetail] = useState<{
    broadcast: BroadcastRecord;
    recipients: BroadcastRecipientRecord[];
  } | null>(null);

  const loadBroadcasts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/broadcasts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.broadcasts || []);
        setEligibleUsers(data.eligibleRecipients || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBroadcasts();
  }, [loadBroadcasts]);

  const availableRoles = useMemo(() => {
    const present = new Set(eligibleUsers.map((u) => u.role));
    return ROLE_OPTIONS.filter((r) => present.has(r.value as any));
  }, [eligibleUsers]);

  const previewRecipientCount = useMemo(() => {
    if (targetType === "all") return eligibleUsers.length;
    if (targetType === "roles") {
      const set = new Set(selectedRoles);
      return eligibleUsers.filter((u) => set.has(u.role)).length;
    }
    const set = new Set(selectedUserIds);
    return eligibleUsers.filter((u) => set.has(u.id)).length;
  }, [eligibleUsers, targetType, selectedRoles, selectedUserIds]);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAddButton = () => {
    const clean = newBtnLabel.trim();
    if (!clean || actionButtons.length >= 6) return;
    const id =
      clean
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "") || `action_${Date.now()}`;
    setActionButtons((prev) => [
      ...prev,
      { id: prev.some((b) => b.id === id) ? `${id}_${prev.length + 1}` : id, label: clean, variant: newBtnVariant },
    ]);
    setNewBtnLabel("");
  };

  const handleAddPreset = (preset: BroadcastActionButton) => {
    if (actionButtons.length >= 6) return;
    if (actionButtons.some((b) => b.label.toLowerCase() === preset.label.toLowerCase())) return;
    setActionButtons((prev) => [...prev, preset]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      onShowToast?.("Title and message are required.", "error");
      return;
    }
    if (previewRecipientCount === 0) {
      onShowToast?.("Select at least one recipient.", "error");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          priority,
          target_type: targetType,
          target_values: targetType === "roles" ? selectedRoles : targetType === "users" ? selectedUserIds : [],
          action_buttons: actionButtons,
          require_ack: requireAck && actionButtons.length > 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send broadcast");
      }

      onShowToast?.(`Broadcast sent to ${data.broadcast?.total_recipients || previewRecipientCount} user(s)`, "success");
      setTitle("");
      setMessage("");
      setRequireAck(false);
      await loadBroadcasts();
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to send broadcast", "error");
    } finally {
      setSending(false);
    }
  };

  const openAudit = async (broadcastId: number) => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setAuditDetail(data);
      }
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-indigo-600" />
            <span>Broadcast & Action Alerts</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentUser?.role === "team_lead"
              ? "Send targeted announcements & action prompts to your team pod with full delivery and response tracking."
              : "Broadcast announcements & interactive action prompts to all users, specific roles, or individuals across web & Android."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadBroadcasts} disabled={loading} className="h-8 gap-1.5 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Composer Card */}
        <form
          onSubmit={handleSend}
          className="lg:col-span-5 bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="text-sm font-bold text-foreground">Compose Broadcast</span>
            <Badge variant="outline" className="text-[11px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
              {previewRecipientCount} recipient{previewRecipientCount === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Urgent: Evening Calling Sprint at 5 PM"
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Message *</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write clear instructions for your team..."
              className="w-full rounded-xl border border-border bg-background p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-y"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
                <option value="low">Low</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Target Audience</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as BroadcastTargetType)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="all">
                  {currentUser?.role === "team_lead" ? "All My Team Pod" : "All Active Users"}
                </option>
                <option value="roles">Specific User Type / Role</option>
                <option value="users">Specific User(s)</option>
              </select>
            </div>
          </div>

          {targetType === "roles" && (
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/60">
              <div className="text-[11px] font-semibold text-muted-foreground">Select Roles</div>
              <div className="flex flex-wrap gap-1.5">
                {availableRoles.map((r) => {
                  const active = selectedRoles.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRole(r.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-background text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {targetType === "users" && (
            <div className="space-y-1.5 p-3 rounded-xl bg-muted/30 border border-border/60 max-h-40 overflow-y-auto">
              <div className="text-[11px] font-semibold text-muted-foreground">Select Users</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {eligibleUsers.map((u) => {
                  const active = selectedUserIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-left text-xs border cursor-pointer flex items-center justify-between gap-1.5 ${
                        active
                          ? "bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 font-semibold"
                          : "bg-background text-foreground border-border hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{u.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize shrink-0">
                        {u.role.replace("_", " ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dynamic Action Buttons Builder */}
          <div className="space-y-2.5 p-3 rounded-xl bg-muted/20 border border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Dynamic Action Buttons ({actionButtons.length}/6)
              </label>
              <span className="text-[10px] text-muted-foreground">Single-click tracked</span>
            </div>

            {actionButtons.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {actionButtons.map((btn) => (
                  <span
                    key={btn.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${VARIANT_CLASSES[btn.variant]}`}
                  >
                    <span>{btn.label}</span>
                    <button
                      type="button"
                      onClick={() => setActionButtons((prev) => prev.filter((b) => b.id !== btn.id))}
                      className="opacity-80 hover:opacity-100 cursor-pointer"
                      title="Remove button"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <Input
                value={newBtnLabel}
                onChange={(e) => setNewBtnLabel(e.target.value)}
                placeholder="Custom button label..."
                className="h-8 text-xs flex-1"
              />
              <select
                value={newBtnVariant}
                onChange={(e) => setNewBtnVariant(e.target.value as BroadcastActionVariant)}
                className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
              >
                <option value="primary">Primary</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
                <option value="secondary">Neutral</option>
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddButton}
                disabled={!newBtnLabel.trim() || actionButtons.length >= 6}
                className="h-8 px-2.5 text-xs gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-muted-foreground font-medium">Presets:</span>
              {BUTTON_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAddPreset(p)}
                  className="text-[11px] px-2 py-0.5 rounded-md border border-border bg-background hover:bg-muted text-foreground cursor-pointer"
                >
                  + {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requireAck}
              onChange={(e) => setRequireAck(e.target.checked)}
              disabled={actionButtons.length === 0}
              className="rounded border-border"
            />
            <span className="font-medium text-foreground">
              Require acknowledgement popup until recipient clicks an action
            </span>
          </label>

          <Button
            type="submit"
            disabled={sending || previewRecipientCount === 0}
            className="w-full h-9 text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? "Sending Broadcast..." : `Send Broadcast (${previewRecipientCount})`}</span>
          </Button>
        </form>

        {/* Broadcast History & Audit List */}
        <div className="lg:col-span-7 bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <span className="text-sm font-bold text-foreground">Broadcast History & Audit</span>
            <span className="text-xs text-muted-foreground">{broadcasts.length} recorded</span>
          </div>

          {broadcasts.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-1.5">
              <Megaphone className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="font-semibold text-foreground">No broadcasts sent yet</p>
              <p>Use the composer to send your first team or role broadcast.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b) => (
                <div
                  key={b.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-muted/15 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-foreground">{b.title}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {b.priority}
                        </Badge>
                        {b.require_ack && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            <span>Ack Required</span>
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{b.message}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openAudit(b.id)}
                      disabled={auditLoading}
                      className="h-7 px-2.5 text-[11px] gap-1 shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Audit</span>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>
                          {b.read_count ?? 0}/{b.total_recipients} read
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>
                          {b.responded_count ?? 0}/{b.total_recipients} responded
                        </span>
                      </span>
                      {b.action_breakdown &&
                        Object.entries(b.action_breakdown).map(([label, count]) => (
                          <Badge key={label} variant="outline" className="text-[10px] bg-background">
                            {label}: {count}
                          </Badge>
                        ))}
                    </div>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <Clock className="w-3 h-3" />
                      {new Date(b.created_at).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                      {" · "}
                      {b.created_by_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recipient Audit Drill-Down Modal */}
      <Dialog open={Boolean(auditDetail)} onOpenChange={(open) => !open && setAuditDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {auditDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold">{auditDetail.broadcast.title}</DialogTitle>
                <DialogDescription className="text-xs">
                  Sent by {auditDetail.broadcast.created_by_name} on{" "}
                  {new Date(auditDetail.broadcast.created_at).toLocaleString("en-IN")} ·{" "}
                  {auditDetail.recipients.length} recipient(s)
                </DialogDescription>
              </DialogHeader>

              <div className="border border-border/70 rounded-xl overflow-hidden mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border/70">
                    <tr>
                      <th className="text-left p-2.5 font-semibold">Recipient</th>
                      <th className="text-left p-2.5 font-semibold">Role</th>
                      <th className="text-left p-2.5 font-semibold">Read At</th>
                      <th className="text-left p-2.5 font-semibold">Action Response</th>
                      <th className="text-left p-2.5 font-semibold">Responded At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {auditDetail.recipients.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2.5 font-medium text-foreground">
                          <div>{r.user_name}</div>
                          <div className="text-[10px] text-muted-foreground">{r.user_email}</div>
                        </td>
                        <td className="p-2.5 capitalize text-muted-foreground">
                          {r.user_role.replace("_", " ")}
                        </td>
                        <td className="p-2.5 text-muted-foreground">
                          {r.read_at
                            ? new Date(r.read_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                            : "Unread"}
                        </td>
                        <td className="p-2.5">
                          {r.response_action_label ? (
                            <Badge className="text-[10px] bg-emerald-600 text-white">
                              {r.response_action_label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground italic">Pending</span>
                          )}
                        </td>
                        <td className="p-2.5 text-muted-foreground">
                          {r.responded_at
                            ? new Date(r.responded_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
