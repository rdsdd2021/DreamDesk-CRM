"use client";

import React, { useState } from "react";
import { User } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Mail,
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Clock,
  MapPin,
  UserX,
  UserCheck,
  Sparkles,
  Lock,
} from "lucide-react";

interface TeamWorkspaceProps {
  users: User[];
  totalCount: number;
  unassignedCount: number;
  assignedCount: number;
  onUserAdded: () => void;
  onFilterByCounselor: (counselorId: string, counselorName: string) => void;
  onAutoDistribute: () => void;
  isAutoDistributing?: boolean;
  currentUser?: User | null;
  canManageTeam?: boolean;
  onUserUpdated?: () => void;
}

export function TeamWorkspace({
  users,
  totalCount,
  unassignedCount,
  assignedCount,
  onUserAdded,
  onFilterByCounselor,
  onAutoDistribute,
  isAutoDistributing = false,
  currentUser,
  canManageTeam = true,
  onUserUpdated,
}: TeamWorkspaceProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("counselor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deactivation state
  const [targetUserToDeactivate, setTargetUserToDeactivate] = useState<User | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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
      setSuccessMsg(`Counselor ${data.name} added successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      onUserAdded();
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

      setSuccessMsg(data.message || `User status changed to ${newStatus}`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setTargetUserToDeactivate(null);
      if (onUserUpdated) onUserUpdated();
      else onUserAdded();
    } catch (err: any) {
      setError(err.message || "Failed to update user status");
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeUsersCount = users.filter((u) => u.status !== "inactive").length;
  const inactiveUsersCount = users.filter((u) => u.status === "inactive").length;
  const avgLeadsPerCounselor =
    activeUsersCount > 0 ? Math.round(assignedCount / activeUsersCount) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Users className="w-4 h-4" />
            <span>Counselors & Team Workload Command Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Counselor Directory & Workloads
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Monitor admissions counselor quotas, lead allocation balances, live session audit telemetry, and manage staff access.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {unassignedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAutoDistribute}
              disabled={isAutoDistributing}
              className="h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{isAutoDistributing ? "Distributing..." : "Auto-Distribute Leads"}</span>
            </Button>
          )}

          {canManageTeam && (
            <Button
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? "Close Form" : "Add Counselor"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
            <span>Active Counselors</span>
            {inactiveUsersCount > 0 && (
              <span className="text-[10px] text-destructive font-mono font-bold">
                {inactiveUsersCount} Deactivated
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">
            {activeUsersCount}
            <span className="text-xs font-normal text-muted-foreground ml-1">/ {users.length} total</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Staff with active terminal access</p>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-muted-foreground">Assigned Leads</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            {assignedCount.toLocaleString()}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">In active counseling queues</p>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-muted-foreground">Unassigned Pool</div>
          <div className="text-2xl font-bold font-mono text-amber-500 mt-2">
            {unassignedCount.toLocaleString()}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Awaiting allocation or claim</p>
        </div>

        <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs">
          <div className="text-xs font-semibold text-muted-foreground">Average Workload</div>
          <div className="text-2xl font-bold font-mono text-primary mt-2">
            {avgLeadsPerCounselor.toLocaleString()}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Leads per active counselor</p>
        </div>
      </div>

      {/* Add Counselor Form Drawer / Card */}
      {showAddForm && (
        <form
          onSubmit={handleCreateCounselor}
          className="bg-card border border-primary/30 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              <span>Register New Academic Counselor</span>
            </h3>
            <span className="text-xs text-muted-foreground">All fields required</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Khanna"
                className="h-8 text-xs bg-background"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rajesh.k@dreamdesk.edu"
                className="h-8 text-xs bg-background"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Assigned Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="counselor">Admissions Counselor</option>
                <option value="senior_counselor">Senior Academic Advisor</option>
                <option value="team_lead">Team Lead / Manager</option>
                <option value="admin">System Administrator</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="h-8 text-xs font-bold px-4"
            >
              {loading ? "Adding Counselor..." : "Save & Add to Roster"}
            </Button>
          </div>
        </form>
      )}

      {/* Counselor Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => {
          const leadCount = user.assigned_count || 0;
          const maxCapacity = 500;
          const percentage = Math.min(100, Math.round((leadCount / maxCapacity) * 100));
          const isDeactivated = user.status === "inactive";
          const isCurrentUser = currentUser?.id === user.id;
          const isPrimaryAdmin = user.id === "usr_admin";
          const isActionLoading = actionLoadingId === user.id;

          return (
            <div
              key={user.id}
              className={`bg-card border rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between gap-4 group ${
                isDeactivated
                  ? "border-destructive/30 bg-destructive/5 opacity-85"
                  : "border-border/80"
              }`}
            >
              <div className="space-y-3.5">
                {/* Counselor Info Header */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-xs shrink-0"
                    style={{ backgroundColor: isDeactivated ? "#64748b" : user.avatar_color || "#3b82f6" }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <div className="truncate flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-sm text-foreground truncate">
                        {user.name}
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize font-medium">
                        {user.role.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 truncate mt-0.5">
                      <Mail className="w-3 h-3 opacity-70 shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </div>
                  </div>
                </div>

                {/* Workload Progress */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Active Leads Capacity</span>
                    <span className="font-mono font-bold text-foreground">
                      {leadCount.toLocaleString()} / {maxCapacity} ({percentage}%)
                    </span>
                  </div>
                  <Progress value={isDeactivated ? 0 : percentage} className="h-1.5" />
                </div>

                {/* Audit & Location Telemetry Box */}
                <div className="pt-2.5 border-t border-border/50 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3 h-3 opacity-70" />
                      <span>Last Login:</span>
                    </span>
                    <span className="font-medium text-foreground">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "No login recorded"}
                    </span>
                  </div>

                  {user.last_login_location && (
                    <div className="flex items-center justify-between text-[11px] gap-2">
                      <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
                        <MapPin className="w-3 h-3 text-primary shrink-0" />
                        <span>Location:</span>
                      </span>
                      <span
                        className="font-mono text-[10px] text-foreground font-medium bg-muted/60 px-1.5 py-0.5 rounded max-w-[180px] truncate"
                        title={user.last_login_location}
                      >
                        {user.last_login_location}
                      </span>
                    </div>
                  )}

                  {isDeactivated && user.deactivated_at && (
                    <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-center gap-1.5">
                      <UserX className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        Deactivated by {user.deactivated_by || "Admin"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer: Status & Actions */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <div>
                  {isDeactivated ? (
                    <Badge variant="destructive" className="text-[10px] gap-1 font-semibold">
                      <UserX className="w-2.5 h-2.5" />
                      <span>Deactivated</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
                      ● Active
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onFilterByCounselor(user.id, user.name)}
                    className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                    title="View assigned leads"
                  >
                    <span>Leads</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>

                  {/* Deactivate / Reactivate Action */}
                  {canManageTeam && (
                    <>
                      {isCurrentUser ? (
                        <span className="text-[10px] text-muted-foreground italic px-1">
                          You
                        </span>
                      ) : isPrimaryAdmin ? (
                        <span className="text-[10px] text-muted-foreground italic px-1">
                          Protected
                        </span>
                      ) : isDeactivated ? (
                        <Button
                          size="sm"
                          onClick={() => handleToggleStatus(user.id, "active")}
                          disabled={isActionLoading}
                          className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-2xs cursor-pointer"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>{isActionLoading ? "Reactivating..." : "Reactivate"}</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setTargetUserToDeactivate(user)}
                          disabled={isActionLoading}
                          className="h-7 text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/60 cursor-pointer"
                        >
                          <UserX className="w-3 h-3" />
                          <span>Deactivate</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Immediate Session Revocation & Deactivation */}
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
              Deactivate Staff Account?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed space-y-2">
              <span>
                Are you sure you want to deactivate{" "}
                <strong className="text-foreground">
                  {targetUserToDeactivate?.name}
                </strong>{" "}
                ({targetUserToDeactivate?.email})?
              </span>
              <br /><br />
              <span className="block p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <strong>⚡ Instant Session Revocation:</strong> All active sessions for this counselor will be deleted immediately. Their browser will be instantly logged out and blocked with 401 Unauthorized on their next action.
              </span>
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
                ? "Terminating Sessions..."
                : "Confirm Deactivation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
