"use client";

import React, { useState } from "react";
import { User } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Mail,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  UserX,
  UserCheck,
} from "lucide-react";

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  totalAssignedLeads: number;
  onUserAdded?: () => void;
  currentUser?: User | null;
  canManageTeam?: boolean;
  onUserUpdated?: () => void;
}

export function TeamModal({
  isOpen,
  onClose,
  users,
  totalAssignedLeads,
  onUserAdded,
  currentUser,
  canManageTeam = true,
  onUserUpdated,
}: TeamModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("counselor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [targetUserToDeactivate, setTargetUserToDeactivate] = useState<User | null>(null);

  const handleCreateCounselor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please provide both name and email.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create counselor");

      setName("");
      setEmail("");
      setShowAddForm(false);
      if (onUserAdded) onUserAdded();
      if (onUserUpdated) onUserUpdated();
    } catch (err: any) {
      setError(err.message || "Failed to create counselor");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId: string, newStatus: "active" | "inactive") => {
    setActionLoadingId(userId);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff status");

      setTargetUserToDeactivate(null);
      if (onUserUpdated) onUserUpdated();
      else if (onUserAdded) onUserAdded();
    } catch (err: any) {
      setError(err.message || "Failed to update user status");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 bg-muted/40 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                <Users className="w-4 h-4" />
                <span>Admissions & Counseling Team</span>
              </div>
              {canManageTeam && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    setError(null);
                  }}
                  className="h-7 text-xs gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{showAddForm ? "Cancel" : "Add Counselor"}</span>
                </Button>
              )}
            </div>
            <DialogTitle className="text-xl font-bold">
              Counselors & Staff Access Control
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Monitor active workloads, audited login locations, and manage staff activation.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 max-h-[65vh] overflow-y-auto space-y-3">
            {error && (
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Add Counselor Form */}
            {showAddForm && (
              <form
                onSubmit={handleCreateCounselor}
                className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3"
              >
                <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-primary" />
                  <span>Onboard New Admissions Counselor</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Full Name</label>
                    <Input
                      placeholder="e.g. Suman Sen"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-8 text-xs bg-background"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Email Address</label>
                    <Input
                      type="email"
                      placeholder="e.g. suman.sen@dreamdesk.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-8 text-xs bg-background"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-muted-foreground">Role:</label>
                    <Select value={role} onValueChange={(v) => { if (v) setRole(v); }}>
                      <SelectTrigger className="h-7 text-xs w-36 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="counselor" className="text-xs">Counselor</SelectItem>
                        <SelectItem value="senior_counselor" className="text-xs">Senior Counselor</SelectItem>
                        <SelectItem value="team_lead" className="text-xs">Team Lead</SelectItem>
                        <SelectItem value="admin" className="text-xs">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={loading}
                    className="h-7 text-xs px-3 font-semibold"
                  >
                    {loading ? "Adding..." : "Add to Pool"}
                  </Button>
                </div>
              </form>
            )}

            {users.map((user) => {
              const count = user.assigned_count || 0;
              const percent = totalAssignedLeads > 0 ? Math.round((count / totalAssignedLeads) * 100) : 0;
              const isDeactivated = user.status === "inactive";
              const isCurrentUser = currentUser?.id === user.id;
              const isPrimaryAdmin = user.id === "usr_admin";
              const isActionLoading = actionLoadingId === user.id;

              return (
                <div
                  key={user.id}
                  className={`p-3.5 rounded-xl border bg-card space-y-2.5 transition-colors ${
                    isDeactivated
                      ? "border-destructive/30 bg-destructive/5 opacity-85"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: isDeactivated ? "#64748b" : user.avatar_color || "#3b82f6" }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                          <span>{user.name}</span>
                          <Badge variant="outline" className="text-[10px] capitalize font-normal">
                            {user.role.replace("_", " ")}
                          </Badge>
                          {isDeactivated ? (
                            <Badge variant="destructive" className="text-[9px] py-0 px-1.5 gap-1">
                              <UserX className="w-2.5 h-2.5" />
                              <span>Deactivated</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
                              ● Active
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3 text-muted-foreground/70" />
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-foreground">
                        {count.toLocaleString()} <span className="text-[11px] font-normal text-muted-foreground">leads</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {percent}% of pool
                      </div>
                    </div>
                  </div>

                  {/* Audit Location Details */}
                  <div className="text-[11px] text-muted-foreground pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/40">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 opacity-70" />
                        <span>
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleString("en-IN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "Never"}
                        </span>
                      </span>

                      {user.last_login_location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary shrink-0" />
                          <span className="font-mono text-[10px] text-foreground font-medium truncate max-w-[200px]" title={user.last_login_location}>
                            {user.last_login_location}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Manage Button */}
                    {canManageTeam && !isCurrentUser && !isPrimaryAdmin && (
                      <div>
                        {isDeactivated ? (
                          <Button
                            size="sm"
                            onClick={() => handleToggleStatus(user.id, "active")}
                            disabled={isActionLoading}
                            className="h-6 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 cursor-pointer"
                          >
                            <UserCheck className="w-3 h-3" />
                            <span>{isActionLoading ? "Activating..." : "Reactivate"}</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setTargetUserToDeactivate(user)}
                            disabled={isActionLoading}
                            className="h-6 text-[11px] px-2.5 border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 cursor-pointer"
                          >
                            <UserX className="w-3 h-3" />
                            <span>Deactivate</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <Progress value={isDeactivated ? 0 : percent} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog
        open={!!targetUserToDeactivate}
        onOpenChange={(open) => !open && setTargetUserToDeactivate(null)}
      >
        <DialogContent className="max-w-md p-6 space-y-4">
          <DialogHeader className="space-y-2">
            <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <UserX className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Deactivate Counselor Account?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to deactivate{" "}
              <strong className="text-foreground">
                {targetUserToDeactivate?.name}
              </strong>
              ?
              <br /><br />
              <span className="text-destructive font-semibold">
                ⚡ Instant Session Revocation:
              </span>{" "}
              All active sessions for this user will be purged immediately. Any active session in their browser will be invalidated and blocked.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTargetUserToDeactivate(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() =>
                targetUserToDeactivate &&
                handleToggleStatus(targetUserToDeactivate.id, "inactive")
              }
              disabled={actionLoadingId === targetUserToDeactivate?.id}
              className="text-xs font-bold gap-1.5"
            >
              {actionLoadingId === targetUserToDeactivate?.id
                ? "Terminating..."
                : "Deactivate & Terminate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
