"use client";

import React, { useState, useEffect } from "react";
import { Lead, Disposition, User, SchemaMeta, LeadActivity } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone,
  MessageSquare,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Send,
  Calendar,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  School,
  MapPin,
  Tag,
  BookOpen,
  ArrowRight,
  PhoneCall,
  User as UserIcon,
} from "lucide-react";

interface SpeedDialerWorkspaceProps {
  leads: Lead[];
  activeLead: Lead | null;
  onSelectLead: (lead: Lead) => void;
  dispositions: Disposition[];
  users: User[];
  schemaMeta: SchemaMeta[];
  onQuickDispositionChange: (leadId: number, dispositionId: string) => void;
  onOpenWhatsApp: (lead: Lead) => void;
  onNextLead: () => void;
  onPrevLead: () => void;
  hasNextLead: boolean;
  hasPrevLead: boolean;
  onLeadUpdated?: (lead: Lead) => void;
}

const PRESET_NOTE_CHIPS = [
  "Parent will visit campus Saturday",
  "Fee structure & scholarship shared",
  "Interested in B.Tech Computer Science",
  "Requested evening callback at 6 PM",
  "Considering multiple colleges",
  "Documents pending for eligibility",
];

export function SpeedDialerWorkspace({
  leads,
  activeLead,
  onSelectLead,
  dispositions,
  users,
  schemaMeta,
  onQuickDispositionChange,
  onOpenWhatsApp,
  onNextLead,
  onPrevLead,
  hasNextLead,
  hasPrevLead,
  onLeadUpdated,
}: SpeedDialerWorkspaceProps) {
  const [remarkText, setRemarkText] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Fetch recent activities whenever active lead changes
  useEffect(() => {
    if (!activeLead) {
      setActivities([]);
      return;
    }
    setRemarkText("");
    setLoadingActivities(true);
    fetch(`/api/leads/${activeLead.id}/activities`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setActivities(data);
      })
      .catch(console.error)
      .finally(() => setLoadingActivities(false));
  }, [activeLead?.id]);

  const handleAddRemark = async (textToAdd?: string) => {
    const content = textToAdd || remarkText.trim();
    if (!content || !activeLead) return;

    setSavingRemark(true);
    try {
      const res = await fetch(`/api/leads/${activeLead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: "note",
          title: "Counselor Consultation Note",
          description: content,
          performed_by_name: activeLead.assigned_user_name || "Counselor",
        }),
      });
      if (!res.ok) throw new Error("Failed to post note");

      // Refetch activities
      const actRes = await fetch(`/api/leads/${activeLead.id}/activities`);
      const actData = await actRes.json();
      if (Array.isArray(actData)) setActivities(actData);
      setRemarkText("");
    } catch (err: any) {
      console.error(err);
    } finally {
      setSavingRemark(false);
    }
  };

  if (!leads || leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card rounded-2xl border border-border/80 text-center min-h-[400px]">
        <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
          <PhoneCall className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-foreground">No students in this dialer queue</h3>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          Select another queue or clear your search/filters to populate the dialer with candidates.
        </p>
      </div>
    );
  }

  const currentLead = activeLead || leads[0];
  const currentIndex = leads.findIndex((l) => l.id === currentLead.id);

  // Latest remark from activities
  const latestRemark = activities.find(
    (a) => a.activity_type === "note" || a.activity_type === "call"
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[600px] h-[calc(100vh-210px)] max-h-[850px]">
      {/* LEFT COLUMN (4 Cols / 35%): Interactive Dialing Queue */}
      <div className="lg:col-span-5 xl:col-span-4 flex flex-col bg-card rounded-2xl border border-border/80 shadow-2xs overflow-hidden">
        {/* Queue Header */}
        <div className="p-3 bg-muted/30 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Queue Roster
            </span>
          </div>
          <Badge variant="outline" className="text-[11px] font-mono font-bold bg-background">
            {currentIndex + 1} of {leads.length} leads
          </Badge>
        </div>

        {/* Scrollable Queue Lead Cards */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-border/20">
          {leads.map((l, idx) => {
            const isSelected = l.id === currentLead.id;
            return (
              <div
                key={l.id}
                onClick={() => onSelectLead(l)}
                className={`p-2.5 rounded-xl transition-all cursor-pointer text-xs relative ${
                  isSelected
                    ? "bg-primary/10 border-2 border-primary shadow-xs"
                    : "hover:bg-muted/50 border border-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground text-xs truncate">
                        {l.name || "Unnamed Student"}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {l.lead_code}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      <span className="font-mono text-foreground font-medium">{l.phone}</span>
                      {l.raw_attributes?.stream && (
                        <span>• {String(l.raw_attributes.stream)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: (l.disposition_color || "#3b82f6") + "20",
                        color: l.disposition_color || "#3b82f6",
                      }}
                    >
                      {l.disposition_name || l.status}
                    </span>

                    {/* Quick Dial Button */}
                    <div className="flex items-center gap-1 mt-0.5">
                      {l.phone && (
                        <a
                          href={`tel:${l.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="w-6 h-6 rounded-md bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-600 flex items-center justify-center transition-colors"
                          title="Dial softphone (C)"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                      {l.phone && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenWhatsApp(l);
                          }}
                          className="w-6 h-6 rounded-md bg-green-500/10 hover:bg-green-500/25 text-green-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="WhatsApp template (W)"
                        >
                          <MessageSquare className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Scheduled Callback indicator if present */}
                {l.callback_at && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md w-fit">
                    <Clock className="w-2.5 h-2.5" />
                    <span>Callback: {new Date(l.callback_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN (8 Cols / 65%): Active Consultation Desk */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-card rounded-2xl border border-border/80 shadow-2xs overflow-hidden">
        {/* Desk Top Navigation Bar */}
        <div className="p-3.5 bg-muted/20 border-b border-border/60 flex items-center justify-between gap-3">
          {/* Student Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20">
              {(currentLead.name || "S").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground truncate">
                  {currentLead.name || "Unnamed Student"}
                </h3>
                <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                  {currentLead.lead_code}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-foreground">{currentLead.phone}</span>
                {currentLead.email && <span>• {currentLead.email}</span>}
              </div>
            </div>
          </div>

          {/* Stepper & Dial Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Dial Primary CTA */}
            {currentLead.phone && (
              <a
                href={`tel:${currentLead.phone}`}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                title="Dial Phone (C)"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Call (C)</span>
              </a>
            )}

            {/* WhatsApp Template CTA */}
            {currentLead.phone && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenWhatsApp(currentLead)}
                className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-green-500/30 text-green-700 dark:text-green-400 bg-green-500/5 hover:bg-green-500/15 cursor-pointer"
                title="Open WhatsApp Template Composer (W)"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">WhatsApp (W)</span>
              </Button>
            )}

            {/* Next / Previous Lead Stepper */}
            <div className="flex items-center border border-border/80 rounded-lg overflow-hidden bg-background">
              <Button
                variant="ghost"
                size="icon"
                disabled={!hasPrevLead}
                onClick={onPrevLead}
                className="h-8 w-8 rounded-none cursor-pointer"
                title="Previous Candidate ([)"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={!hasNextLead}
                onClick={onNextLead}
                className="h-8 w-8 rounded-none cursor-pointer"
                title="Next Candidate (])"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Consultation Desk Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 4-Card Mini Briefing Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Stream & Program</span>
              <p className="font-semibold text-foreground truncate">
                {String(currentLead.raw_attributes?.stream || "Unspecified")}
              </p>
            </div>
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">City / Location</span>
              <p className="font-semibold text-foreground truncate">
                {String(currentLead.raw_attributes?.city || "Unknown")}
              </p>
            </div>
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Lead Score / Marks</span>
              <p className="font-bold text-primary tabular-nums">
                {currentLead.raw_attributes?.score || "N/A"}%
              </p>
            </div>
            <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Assigned Counselor</span>
              <p className="font-semibold text-foreground truncate flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: currentLead.assigned_user_color || "#3b82f6" }}
                />
                {currentLead.assigned_user_name || "Unassigned"}
              </p>
            </div>
          </div>

          {/* Pinned Latest Remark Banner */}
          {latestRemark ? (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Latest Remark ({latestRemark.performed_by_name || "Counselor"})
                </span>
                <span className="font-mono text-[10px]">
                  {new Date(latestRemark.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="text-foreground leading-relaxed font-medium">
                {latestRemark.description}
              </p>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground text-center">
              No previous notes logged. Be the first counselor to log consultation notes below.
            </div>
          )}

          {/* 1-Click Call Outcome / Disposition Logger */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                Log Call Outcome (1-Click Disposition)
              </label>
              <span className="text-[10px] text-muted-foreground">Select outcome to update lead stage</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {dispositions.slice(0, 6).map((d) => {
                const isSelected = currentLead.disposition_id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => onQuickDispositionChange(currentLead.id, d.id)}
                    className={`p-2 rounded-xl text-xs font-semibold text-left transition-all border cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-xs font-bold"
                        : "border-border/80 bg-background hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="truncate">{d.name}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Note Composer & Preset Chips */}
          <div className="space-y-2 pt-1 border-t border-border/60">
            <label className="text-xs font-bold text-foreground uppercase tracking-wider">
              Consultation Notes
            </label>

            {/* Preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_NOTE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleAddRemark(chip)}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border/60 transition-colors cursor-pointer text-muted-foreground font-medium"
                >
                  + {chip}
                </button>
              ))}
            </div>

            {/* Custom note textarea */}
            <div className="relative">
              <Textarea
                placeholder="Type specific discussion notes, scholarship questions, or objections..."
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                rows={2}
                className="text-xs rounded-xl bg-background border-border/80 resize-none pr-12"
              />
              <Button
                size="sm"
                disabled={!remarkText.trim() || savingRemark}
                onClick={() => handleAddRemark()}
                className="absolute right-2 bottom-2 h-7 px-2.5 text-xs rounded-lg bg-primary text-primary-foreground font-semibold cursor-pointer"
              >
                <Send className="w-3 h-3 mr-1" /> Save
              </Button>
            </div>
          </div>

          {/* Compact Activity History Stream */}
          <div className="space-y-2 pt-1 border-t border-border/60">
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">
              Previous Interactions ({activities.length})
            </span>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {activities.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No prior history.</p>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="p-2 rounded-xl bg-muted/20 border border-border/40 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{act.title}</span>
                      <span>{new Date(act.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    {act.description && (
                      <p className="text-muted-foreground text-[11px]">{act.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
