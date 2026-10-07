"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CrmPolicy } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Lock,
  Unlock,
  History,
  Save,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Search,
  Check,
} from "lucide-react";

interface PolicyStats {
  totalLockedLeads: number;
  totalProtectedCounselors: number;
  lockDays: number;
  isPolicyEnabled: boolean;
  exemptRoles: string[];
  overridesInLast30Days: number;
}

interface LeadCheckResult {
  isLocked: boolean;
  leadId: number;
  leadCode: string;
  counselorId?: string;
  counselorName?: string;
  lastCallAt?: string;
  daysSinceCall?: number;
  daysRemaining?: number;
  lockDays?: number;
}

export function PoliciesWorkspace() {
  const [policies, setPolicies] = useState<CrmPolicy[]>([]);
  const [stats, setStats] = useState<PolicyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Counselor Lock Policy Form State
  const [lockDays, setLockDays] = useState<number>(7);
  const [isCounselorLockEnabled, setIsCounselorLockEnabled] = useState<boolean>(true);

  // Policy Sandbox / Inspector State
  const [inspectorLeadId, setInspectorLeadId] = useState("");
  const [inspecting, setInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<LeadCheckResult | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);

  const loadPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/policies");
      if (!res.ok) throw new Error("Failed to load policy configurations");
      const data = await res.json();

      if (data.policies) {
        setPolicies(data.policies);
        const lockPolicy = data.policies.find((p: CrmPolicy) => p.id === "counselor_lock");
        if (lockPolicy) {
          setIsCounselorLockEnabled(lockPolicy.is_enabled);
          if (lockPolicy.config?.lock_days) {
            setLockDays(lockPolicy.config.lock_days);
          }
        }
      }

      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error("Error loading policies:", err);
      setNotification({ type: "error", message: err.message || "Could not load policies" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  // Handle Save Counselor Lock Policy
  const handleSavePolicy = async () => {
    try {
      setSaving(true);
      setNotification(null);

      const res = await fetch("/api/policies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "counselor_lock",
          is_enabled: isCounselorLockEnabled,
          config: {
            lock_days: lockDays,
            exempt_roles: ["admin", "team_lead"],
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update policy");
      }

      if (data.stats) setStats(data.stats);
      setNotification({
        type: "success",
        message: `Counselor Ownership Lock updated: ${isCounselorLockEnabled ? "Enabled" : "Disabled"}, ${lockDays}-day protection active.`,
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to save policy configuration" });
    } finally {
      setSaving(false);
    }
  };

  // Handle Policy Sandbox / Lead Lock Check
  const handleInspectLead = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inspectorLeadId.trim()) return;

    setInspecting(true);
    setInspectionResult(null);
    setInspectionError(null);

    try {
      const cleanId = inspectorLeadId.trim().replace(/^LD-/i, "");
      const res = await fetch(`/api/policies/check?lead_id=${cleanId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not inspect lead");
      }

      setInspectionResult(data.lock);
    } catch (err: any) {
      setInspectionError(err.message || "Failed to check lead lock");
    } finally {
      setInspecting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-2xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-2xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Governance & Policy System
              </h1>
              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                Institutional Guardrails
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl">
              Configure strict assignment boundaries, ownership protection windows, and counselor poaching prevention. All policy violations and manual administrative overrides are immutably logged in the audit trail.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadPolicies}
              disabled={loading}
              className="h-8 text-xs rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Toast / Notification */}
        {notification && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center gap-2 border animate-in slide-in-from-top-2 ${
              notification.type === "success"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : "bg-destructive/10 text-destructive border-destructive/30"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
            )}
            <span>{notification.message}</span>
          </div>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1 */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {stats?.totalLockedLeads ?? "—"}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                Active Call-Locked Leads
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {stats?.totalProtectedCounselors ?? "—"}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                Protected Counselors
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {stats?.lockDays ?? lockDays} Days
              </div>
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                Post-Call Ownership Window
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4 */}
        <Card className="border-border/80 shadow-2xs">
          <CardContent className="p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {stats?.overridesInLast30Days ?? 0}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                Admin Overrides (30 Days)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Policy Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Primary Policy Configuration Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/80 shadow-2xs">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      Counselor Ownership Lock Policy
                      {isCounselorLockEnabled ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] font-semibold">
                          Active & Enforced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">
                          Suspended
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Prevents leads from being reassigned to another counselor within a cooldown window of their last call.
                    </CardDescription>
                  </div>
                </div>

                {/* Enable/Disable Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Policy Status:</span>
                  <button
                    type="button"
                    onClick={() => setIsCounselorLockEnabled(!isCounselorLockEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isCounselorLockEnabled ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isCounselorLockEnabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-6">
              {/* How it works explanation */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs space-y-2 leading-relaxed">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Rule Mechanics & Institutional Logic:</span>
                </div>
                <p className="text-muted-foreground">
                  When a counselor contacts an applicant and logs a call or outcome disposition (e.g. <em>Interested</em>, <em>Callback Requested</em>, or <em>Merit Candidate</em>), this lead becomes <strong className="text-foreground">ownership-locked for {lockDays} days</strong>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-background/80 border border-border/40">
                    <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-foreground">Standard Counselors:</span>
                      <p className="text-muted-foreground text-[11px]">Cannot reassign or transfer the lead. Attempts will result in an automated policy block.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-background/80 border border-border/40">
                    <Check className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-foreground">Admin & Team Leaders:</span>
                      <p className="text-muted-foreground text-[11px]">Possess manual override privileges. Reassignment will trigger an explicit audit trail entry.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Cooldown Lock Window (Days)</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                      {lockDays} Days
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={30}
                      step={1}
                      value={lockDays}
                      onChange={(e) => setLockDays(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={lockDays}
                      onChange={(e) => setLockDays(Math.max(1, Number(e.target.value)))}
                      className="w-20 h-9 text-xs font-mono font-bold text-center rounded-xl"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Recommended setting: <strong>7 days</strong>. Shorter windows allow earlier lead recycling; longer windows give counselors dedicated relationship runway.
                  </p>
                </div>

                {/* Exempt Roles Display */}
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Authorized Override Roles (Emergency Reassignment)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs font-medium px-2.5 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                      👑 System Administrator (admin)
                    </Badge>
                    <Badge variant="secondary" className="text-xs font-medium px-2.5 py-1 bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                      🛡️ Admissions Team Leader (team_lead)
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Regular Counselors (<code>counselor</code>, <code>senior_counselor</code>, <code>telecaller</code>) are strictly blocked from reassigning protected leads.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-border/60">
                <Button
                  onClick={handleSavePolicy}
                  disabled={saving}
                  className="rounded-xl h-9 text-xs font-semibold shadow-xs"
                >
                  <Save className={`w-3.5 h-3.5 mr-1.5 ${saving ? "animate-spin" : ""}`} />
                  {saving ? "Saving Policy..." : "Save Policy Configuration"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Secondary Policy Modules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border-border/80 shadow-2xs">
              <CardContent className="p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                    Active
                  </Badge>
                </div>
                <h3 className="text-xs font-bold text-foreground">Counselor Scope Isolation</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Counselor accounts are strictly quarantined to view and manage only leads assigned to their user ID, preventing cross-pipeline leakage.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-2xs">
              <CardContent className="p-4 sm:p-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]">
                    Active
                  </Badge>
                </div>
                <h3 className="text-xs font-bold text-foreground">Anti-Duplicate Ingestion Guard</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Prevents duplicate student lead creation across multi-campaign CSV imports and manual lead intake by matching normalized phone numbers and emails.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column (1 span): Live Diagnostic & Lead Policy Inspector Sandbox */}
        <div className="space-y-6">
          <Card className="border-border/80 shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Search className="w-4 h-4 text-primary" />
                Policy Lock Inspector Sandbox
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Instantly evaluate whether a specific student lead is currently locked under ownership protection.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              <form onSubmit={handleInspectLead} className="space-y-2.5">
                <label className="text-xs font-semibold text-foreground">
                  Lead ID or Code (e.g. 101 or LD-000101)
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Lead ID..."
                    value={inspectorLeadId}
                    onChange={(e) => setInspectorLeadId(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                  <Button
                    type="submit"
                    disabled={inspecting || !inspectorLeadId.trim()}
                    size="sm"
                    className="h-9 px-3 rounded-xl shrink-0"
                  >
                    {inspecting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Inspect"}
                  </Button>
                </div>
              </form>

              {inspectionError && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{inspectionError}</span>
                </div>
              )}

              {inspectionResult && (
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-foreground">
                      {inspectionResult.leadCode}
                    </span>
                    {inspectionResult.isLocked ? (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] flex items-center gap-1 font-semibold">
                        <Lock className="w-3 h-3" /> Call Locked
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] flex items-center gap-1 font-semibold">
                        <Unlock className="w-3 h-3" /> Reassignment Open
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Assigned Counselor:</span>
                      <span className="font-semibold text-foreground">
                        {inspectionResult.counselorName || "Unassigned"}
                      </span>
                    </div>

                    {inspectionResult.lastCallAt && (
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Last Call Logged:</span>
                        <span className="font-medium text-foreground">
                          {new Date(inspectionResult.lastCallAt).toLocaleDateString()} (
                          {inspectionResult.daysSinceCall}d ago)
                        </span>
                      </div>
                    )}

                    {inspectionResult.isLocked && (
                      <div className="flex justify-between py-1 border-b border-border/40">
                        <span className="text-muted-foreground">Lock Remaining:</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {inspectionResult.daysRemaining} Day(s) Left
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    className={`p-2.5 rounded-lg text-[11px] leading-relaxed ${
                      inspectionResult.isLocked
                        ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                    }`}
                  >
                    {inspectionResult.isLocked ? (
                      <>
                        🔒 <strong>Reassignment Restricted:</strong> Only Admins or Admissions Team Leaders can reassign this lead. Regular counselors will receive an automatic 403 policy violation.
                      </>
                    ) : (
                      <>
                        ✅ <strong>Eligible for Reassignment:</strong> This lead has either not been contacted or has passed the {inspectionResult.lockDays || 7}-day lock cooldown window.
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Governance Best Practices Card */}
          <Card className="border-border/80 shadow-2xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-primary" />
                CRM Policy Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5 text-xs text-muted-foreground leading-relaxed">
              <p>
                • <strong>Protect High-Touch Effort:</strong> When a counselor conducts extensive evaluation calls, resetting the 7-day clock ensures other counselors cannot claim commission on those efforts.
              </p>
              <p>
                • <strong>Team Leader Overrides:</strong> When a student explicitly requests a different counselor or a team member takes leave, Team Leaders can reassign with full audit traceability.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
