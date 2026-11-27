"use client";

import React, { useCallback, useEffect, useState } from "react";
import { User, UserRole } from "@/types/crm";
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
  KeyRound,
  LogOut,
  Shield,
  Trash2,
  UserCog,
} from "lucide-react";

interface UserManageModalProps {
  user: User | null;
  allUsers: User[];
  currentUser?: User | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

const PERMISSION_KEYS: { key: string; label: string; desc: string }[] = [
  { key: "canViewAllLeads", label: "View All Leads", desc: "Access entire institutional database instead of only assigned leads" },
  { key: "canAssignLeads", label: "Assign & Distribute Leads", desc: "Bulk assign, auto-distribute, and create assignment batches" },
  { key: "canExportLeads", label: "Export CSV", desc: "Download lead spreadsheets" },
  { key: "canImportLeads", label: "Import CSV", desc: "Upload and ingest new lead files" },
  { key: "canDeleteLeads", label: "Delete Leads", desc: "Permanently purge lead records" },
  { key: "canManageCampaigns", label: "Manage Campaigns", desc: "Create and edit marketing campaigns" },
  { key: "canManageDispositions", label: "Manage Dispositions & SOPs", desc: "Edit call outcomes and SOP automation rules" },
  { key: "canViewAuditLogs", label: "View Audit Logs", desc: "Inspect system compliance and activity logs" },
];

export function UserManageModal({
  user,
  allUsers,
  currentUser,
  onClose,
  onSaved,
}: UserManageModalProps) {
  const [tab, setTab] = useState<"profile" | "permissions" | "sessions">("profile");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("counselor");
  const [teamLeadId, setTeamLeadId] = useState("");
  const [maxCap, setMaxCap] = useState(500);
  const [permOverride, setPermOverride] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audit & Sessions
  const [auditLoading, setAuditLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  // Delete User Handoff
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLeadAction, setDeleteLeadAction] = useState<"unassign" | "reassign">("unassign");
  const [reassignToUserId, setReassignToUserId] = useState("");

  const loadAudit = useCallback(async (userId: string) => {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/audit`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setCheckins(data.checkins || []);
        setLogs(data.logs || []);
      }
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setTab("profile");
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setTeamLeadId(user.team_lead_id || "");
    setMaxCap(user.max_leads_cap || 500);
    setPermOverride(user.permissions_override ? { ...user.permissions_override } : {});
    setShowDeleteConfirm(false);
    setError(null);
    loadAudit(user.id);
  }, [user, loadAudit]);

  if (!user) return null;

  const isPrimaryAdmin = user.id === "usr_admin";
  const isSelf = currentUser?.id === user.id;

  const handleSaveProfileAndPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_user",
          userId: user.id,
          name: name.trim(),
          email: email.trim(),
          role,
          team_lead_id: teamLeadId || null,
          max_leads_cap: Number(maxCap),
          permissions_override: permOverride,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update user");
      onSaved(`Updated ${name.trim()} successfully.`);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleForceLogout = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "force_logout", userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to terminate sessions");
      await loadAudit(user.id);
      onSaved(data.message || "Terminated active sessions.");
    } catch (err: any) {
      setError(err?.message || "Failed to force logout");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_user",
          userId: user.id,
          leadAction: deleteLeadAction,
          reassignToUserId: deleteLeadAction === "reassign" ? reassignToUserId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      onSaved(data.message || "User deleted.");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to delete user");
    } finally {
      setSaving(false);
    }
  };

  const togglePerm = (key: string) => {
    setPermOverride((prev) => {
      const next = { ...prev };
      if (next[key] === true) next[key] = false;
      else if (next[key] === false) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl p-0 max-h-[88vh]">
        <DialogHeader className="px-6 py-4 border-b border-border/70 bg-muted/25">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <UserCog className="w-4 h-4 text-primary" />
            Manage User — {user.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Edit profile, role, lead capacity, per-user permissions, active sessions, or account removal.
          </DialogDescription>
        </DialogHeader>

        {/* Sub-Tabs */}
        <div className="px-6 pt-3 border-b border-border/60 flex items-center gap-2 bg-muted/10">
          {[
            { id: "profile", label: "Profile & Role", icon: UserCog },
            { id: "permissions", label: "Permissions", icon: Shield },
            { id: "sessions", label: `Sessions & Audit (${sessions.length})`, icon: Activity },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  tab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSaveProfileAndPermissions}>
          <div className="px-6 py-5 space-y-4 text-xs overflow-y-auto max-h-[56vh]">
            {error && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-destructive">
                {error}
              </div>
            )}

            {tab === "profile" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold">Full Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-xl" required />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Email Address</label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 rounded-xl" required />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Role</label>
                    <select
                      value={role}
                      disabled={isPrimaryAdmin}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs disabled:opacity-60"
                    >
                      <option value="telecaller">Telecaller</option>
                      <option value="counselor">Admissions Counselor</option>
                      <option value="senior_counselor">Senior Academic Advisor</option>
                      <option value="team_lead">Team Lead / Manager</option>
                      <option value="admin">System Administrator</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Reports To (Team Lead)</label>
                    <select
                      value={teamLeadId}
                      disabled={role === "admin"}
                      onChange={(e) => setTeamLeadId(e.target.value)}
                      className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs disabled:opacity-60"
                    >
                      <option value="">Unassigned (Admin)</option>
                      {allUsers
                        .filter(
                          (u) =>
                            u.id !== user.id &&
                            u.status === "active" &&
                            ["team_lead", "admin", "senior_counselor"].includes(u.role)
                        )
                        .map((tl) => (
                          <option key={tl.id} value={tl.id}>
                            {tl.name} ({tl.role.replace("_", " ")})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold">Max Active Leads Capacity</label>
                    <Input
                      type="number"
                      min={10}
                      max={10000}
                      value={maxCap}
                      onChange={(e) => setMaxCap(Number(e.target.value))}
                      className="h-9 rounded-xl"
                    />
                  </div>
                </div>

                {!isPrimaryAdmin && !isSelf && (
                  <div className="pt-3 border-t border-border/70">
                    {!showDeleteConfirm ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="h-8 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete User Permanently...
                      </Button>
                    ) : (
                      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-3">
                        <div className="font-bold text-rose-600">
                          Permanent Delete ({user.assigned_count || 0} assigned leads)
                        </div>
                        <div className="space-y-1.5">
                          <label className="block font-semibold">What should happen to their leads?</label>
                          <select
                            value={deleteLeadAction}
                            onChange={(e) => setDeleteLeadAction(e.target.value as any)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs"
                          >
                            <option value="unassign">Move all leads to Unassigned Pool</option>
                            <option value="reassign">Reassign all leads to another caller</option>
                          </select>
                        </div>
                        {deleteLeadAction === "reassign" && (
                          <select
                            value={reassignToUserId}
                            onChange={(e) => setReassignToUserId(e.target.value)}
                            className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs"
                          >
                            <option value="">Select target caller...</option>
                            {allUsers
                              .filter((u) => u.id !== user.id && u.status === "active")
                              .map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.role.replace("_", " ")})
                                </option>
                              ))}
                          </select>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={saving || (deleteLeadAction === "reassign" && !reassignToUserId)}
                            onClick={handleDeleteUser}
                          >
                            Confirm Permanent Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "permissions" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Click a permission to cycle: <strong>Default (Role)</strong> → <strong>Allow</strong> → <strong>Deny</strong>.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => setPermOverride({})}
                  >
                    Reset to Role Defaults
                  </Button>
                </div>
                <div className="divide-y divide-border/60 border border-border/80 rounded-xl overflow-hidden">
                  {PERMISSION_KEYS.map((p) => {
                    const val = permOverride[p.key];
                    return (
                      <div
                        key={p.key}
                        onClick={() => togglePerm(p.key)}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30 cursor-pointer"
                      >
                        <div>
                          <div className="font-semibold text-foreground">{p.label}</div>
                          <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            val === true
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                              : val === false
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/30"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {val === true ? "Allowed (Override)" : val === false ? "Denied (Override)" : "Role Default"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "sessions" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Active Login Sessions ({sessions.length})</span>
                  {sessions.length > 0 && !isSelf && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleForceLogout}
                      disabled={saving}
                      className="h-7 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50 gap-1"
                    >
                      <LogOut className="w-3 h-3" />
                      Force Logout All Devices
                    </Button>
                  )}
                </div>

                {auditLoading ? (
                  <div className="text-muted-foreground py-4 text-center">Loading sessions &amp; audit logs...</div>
                ) : sessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">
                    No active sessions right now.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => (
                      <div key={s.id} className="rounded-xl border border-border/70 p-2.5 bg-muted/20 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground truncate">
                            {s.ip_address || "Unknown IP"} · {s.location || "Local / Unknown Location"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {s.user_agent || "Browser Session"} · Started {new Date(s.created_at).toLocaleString()}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30 shrink-0">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="font-bold text-foreground">Recent Shift Check-Ins</div>
                  {checkins.length === 0 ? (
                    <div className="text-muted-foreground">No check-ins recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-border/50 border border-border/70 rounded-xl overflow-hidden">
                      {checkins.map((c, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between gap-2 bg-card">
                          <div className="min-w-0">
                            <div className="font-semibold">{c.checkin_date} · {c.presence_status}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{c.morning_focus || "No focus note"}</div>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            {c.checked_in_at ? new Date(c.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {logs.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-bold text-foreground">Recent Security &amp; Audit Logs</div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {logs.map((l, idx) => (
                        <div key={idx} className="rounded-lg border border-border/60 p-2 text-[11px] bg-muted/10">
                          <span className="font-mono font-bold text-primary mr-1.5">{l.action_type}</span>
                          <span className="text-muted-foreground">{l.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-3.5 border-t border-border/70 bg-muted/20 flex justify-end gap-2.5">
            <Button type="button" variant="outline" size="sm" className="h-9 px-4 rounded-xl" onClick={onClose}>
              Close
            </Button>
            {tab !== "sessions" && (
              <Button type="submit" size="sm" className="h-9 px-5 rounded-xl" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
