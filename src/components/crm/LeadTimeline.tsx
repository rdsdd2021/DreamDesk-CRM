"use client";

import React, { useState, useMemo } from "react";
import { Lead, LeadActivity, User } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  History,
  PhoneCall,
  ArrowRight,
  UserCheck,
  CalendarClock,
  MessageSquare,
  Sparkles,
  FileText,
  Search,
  RotateCw,
  Send,
  ChevronDown,
  ChevronUp,
  Layers,
  Filter,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Tag,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Pin,
  Check,
  Phone,
} from "lucide-react";

interface LeadTimelineProps {
  lead: Lead;
  activities: LeadActivity[];
  loading: boolean;
  onRefresh: () => void;
  onAddNote: (noteText: string) => Promise<void>;
  currentUser?: User | null;
}

type SignalFilter = "all" | "high_signal" | "stages" | "system";
type DensityMode = "compact" | "detailed";

const NOTE_TEMPLATES = [
  "Parent requested follow-up call",
  "Fee structure shared with student",
  "Awaiting document submission",
  "Call unanswered / phone switched off",
  "Interested in physical campus visit",
  "Confirmed application admission intent",
];

export function LeadTimeline({
  lead,
  activities,
  loading,
  onRefresh,
  onAddNote,
  currentUser,
}: LeadTimelineProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");
  const [densityMode, setDensityMode] = useState<DensityMode>("compact");
  const [expandedItemIds, setExpandedItemIds] = useState<Set<number>>(new Set());

  // Note composer state
  const [noteInput, setNoteInput] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // Toggle single item expansion
  const toggleExpandItem = (id: number) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedItemIds(new Set(activities.map((a) => a.id)));
  };

  const collapseAll = () => {
    setExpandedItemIds(new Set());
  };

  const handleApplyTemplate = (text: string) => {
    setNoteInput((prev) => (prev ? `${prev}. ${text}` : text));
  };

  const handleSubmitNote = async () => {
    if (!noteInput.trim()) return;
    setIsSubmittingNote(true);
    try {
      await onAddNote(noteInput.trim());
      setNoteInput("");
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // 1. Executive Journey Highlights Computation
  const journeyStats = useMemo(() => {
    const calls = activities.filter(
      (a) => a.activity_type === "call" || a.activity_type === "disposition"
    );
    const notes = activities.filter((a) => a.activity_type === "note");

    // Most recent call
    const latestCall = calls[0];

    // Most recent note / remark
    const latestNote = notes[0] || (latestCall?.description ? latestCall : null);

    // Intake duration
    const intakeDate = lead.created_at ? new Date(lead.created_at) : new Date();
    const daysInPipeline = Math.max(
      0,
      Math.floor((Date.now() - intakeDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      intakeDate,
      daysInPipeline,
      totalCalls: calls.length,
      latestCall,
      latestNote,
    };
  }, [activities, lead.created_at]);

  // 2. Signal-filtered & searched activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Signal filter
      if (signalFilter === "high_signal") {
        const isHigh =
          act.activity_type === "call" ||
          act.activity_type === "disposition" ||
          act.activity_type === "note" ||
          act.activity_type === "whatsapp" ||
          act.activity_type === "communication";
        if (!isHigh) return false;
      } else if (signalFilter === "stages") {
        const isStageOrOwnership =
          act.activity_type === "stage_change" || act.activity_type === "assigned";
        if (!isStageOrOwnership) return false;
      } else if (signalFilter === "system") {
        const isSystem =
          act.activity_type === "field_update" ||
          act.activity_type === "created" ||
          act.activity_type === "callback_scheduled";
        if (!isSystem) return false;
      }

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (act.title || "").toLowerCase().includes(q);
        const matchesDesc = (act.description || "").toLowerCase().includes(q);
        const matchesActor = (act.performed_by_name || "").toLowerCase().includes(q);
        const matchesOld = (act.old_value || "").toLowerCase().includes(q);
        const matchesNew = (act.new_value || "").toLowerCase().includes(q);
        return matchesTitle || matchesDesc || matchesActor || matchesOld || matchesNew;
      }

      return true;
    });
  }, [activities, signalFilter, searchQuery]);

  // 3. Date Bucketing
  const dateBuckets = useMemo(() => {
    const buckets: { [label: string]: LeadActivity[] } = {};
    const now = new Date();
    const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStr = todayStr - 86400000;
    const sevenDaysAgoStr = todayStr - 7 * 86400000;

    for (const act of filteredActivities) {
      const actDate = new Date(act.created_at);
      const actDayTime = new Date(
        actDate.getFullYear(),
        actDate.getMonth(),
        actDate.getDate()
      ).getTime();

      let label = "Earlier History";
      if (actDayTime >= todayStr) {
        label = "Today";
      } else if (actDayTime >= yesterdayStr) {
        label = "Yesterday";
      } else if (actDayTime >= sevenDaysAgoStr) {
        label = actDate.toLocaleDateString("en-IN", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
      } else {
        label = actDate.toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      if (!buckets[label]) buckets[label] = [];
      buckets[label].push(act);
    }

    return Object.entries(buckets).map(([label, items]) => ({ label, items }));
  }, [filteredActivities]);

  // Relative Time Formatter
  const formatTimeAgo = (isoString?: string | null) => {
    if (!isoString) return "—";
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(isoString);
    }
  };

  // Exact Clock Time
  const formatClockTime = (isoString?: string | null) => {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Type-specific icon & theme config
  const getActivityMeta = (type: string) => {
    switch (type) {
      case "call":
      case "disposition":
        return {
          icon: <PhoneCall className="w-3.5 h-3.5 text-primary" />,
          dotBg: "bg-primary/10 border-primary/40 text-primary",
          tagLabel: "Call",
        };
      case "stage_change":
        return {
          icon: <ArrowRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
          dotBg: "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400",
          tagLabel: "Stage",
        };
      case "assigned":
        return {
          icon: <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          dotBg: "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
          tagLabel: "Ownership",
        };
      case "note":
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />,
          dotBg: "bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400",
          tagLabel: "Note",
        };
      case "whatsapp":
      case "communication":
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          dotBg: "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
          tagLabel: "WhatsApp",
        };
      case "callback_scheduled":
        return {
          icon: <CalendarClock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
          dotBg: "bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400",
          tagLabel: "Callback",
        };
      case "created":
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />,
          dotBg: "bg-violet-500/10 border-violet-500/40 text-violet-600 dark:text-violet-400",
          tagLabel: "Created",
        };
      case "field_update":
      default:
        return {
          icon: <FileText className="w-3.5 h-3.5 text-muted-foreground" />,
          dotBg: "bg-muted border-border/80 text-muted-foreground",
          tagLabel: "System",
        };
    }
  };

  const highSignalCount = useMemo(
    () =>
      activities.filter(
        (a) =>
          a.activity_type === "call" ||
          a.activity_type === "disposition" ||
          a.activity_type === "note" ||
          a.activity_type === "whatsapp"
      ).length,
    [activities]
  );

  const stageCount = useMemo(
    () =>
      activities.filter(
        (a) => a.activity_type === "stage_change" || a.activity_type === "assigned"
      ).length,
    [activities]
  );

  const systemCount = useMemo(
    () =>
      activities.filter(
        (a) =>
          a.activity_type === "field_update" ||
          a.activity_type === "created" ||
          a.activity_type === "callback_scheduled"
      ).length,
    [activities]
  );

  return (
    <div className="space-y-4">
      {/* 1. EXECUTIVE JOURNEY HIGHLIGHTS STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Intake & Pipeline Age */}
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Intake & Age</span>
            <Calendar className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-sm font-bold text-foreground">
            {journeyStats.daysInPipeline === 0
              ? "New Today"
              : `${journeyStats.daysInPipeline} Days Active`}
          </div>
          <div className="text-[10px] text-muted-foreground truncate" title={lead.campaign_name || "Direct intake"}>
            Source: <strong className="text-foreground/80">{lead.campaign_name || "Direct"}</strong>
          </div>
        </div>

        {/* Calls Engagement */}
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Calls Placed</span>
            <PhoneCall className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <span>{journeyStats.totalCalls} Calls</span>
            {journeyStats.totalCalls > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                Logged
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {journeyStats.latestCall
              ? `Last: ${formatTimeAgo(journeyStats.latestCall.created_at)}`
              : "No calls yet"}
          </div>
        </div>

        {/* Assigned Ownership */}
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Ownership</span>
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-sm font-bold text-foreground truncate">
            {lead.assigned_user_name || "Unassigned"}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span>Policy Protected</span>
          </div>
        </div>

        {/* Status Stage */}
        <div className="bg-card border border-border/80 rounded-xl p-3 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-wider">Current Stage</span>
            <Tag className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-sm font-bold text-foreground truncate">
            {lead.status}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            Dispo: {lead.disposition_name || "Pending"}
          </div>
        </div>
      </div>

      {/* Latest Counselor Remark Callout (If exists) */}
      {journeyStats.latestNote && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 flex items-start gap-2.5 shadow-2xs">
          <Pin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <span className="font-bold text-amber-800 dark:text-amber-300">
                Latest Counselor Note ({journeyStats.latestNote.performed_by_name || "Counselor"})
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {formatTimeAgo(journeyStats.latestNote.created_at)}
              </span>
            </div>
            <p className="text-xs text-foreground/90 mt-0.5 line-clamp-2">
              {journeyStats.latestNote.description || journeyStats.latestNote.title}
            </p>
          </div>
        </div>
      )}

      {/* 2. QUICK NOTE COMPOSER WITH TEMPLATES */}
      <div className="bg-card border border-border/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span>Add Timestamped Note to Audit Trail</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Recorded permanently</span>
        </div>

        <Textarea
          placeholder="Enter counselor observation, call outcome remarks, or student intent..."
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          className="min-h-[58px] text-xs resize-none rounded-xl bg-background border-border/80 focus-visible:ring-primary/20"
        />

        {/* Quick Suggestion Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-0.5">
            Presets:
          </span>
          {NOTE_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl}
              type="button"
              onClick={() => handleApplyTemplate(tmpl)}
              className="text-[10px] px-2 py-0.5 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              + {tmpl}
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            onClick={handleSubmitNote}
            disabled={isSubmittingNote || !noteInput.trim()}
            className="h-8 px-3.5 text-xs font-semibold gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
          >
            <Send className="w-3 h-3" />
            <span>{isSubmittingNote ? "Logging..." : "Log Note"}</span>
          </Button>
        </div>
      </div>

      {/* 3. TOOLBAR: SEARCH, SIGNAL FILTERS & DENSITY TOGGLE */}
      <div className="bg-card border border-border/80 rounded-2xl p-3 sm:p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Signal Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setSignalFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                signalFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All ({activities.length})
            </button>

            <button
              type="button"
              onClick={() => setSignalFilter("high_signal")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                signalFilter === "high_signal"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <PhoneCall className="w-3 h-3" />
              <span>Calls & Notes ({highSignalCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSignalFilter("stages")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                signalFilter === "stages"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <ArrowRight className="w-3 h-3" />
              <span>Stages ({stageCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setSignalFilter("system")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                signalFilter === "system"
                  ? "bg-zinc-700 text-white shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>System ({systemCount})</span>
            </button>
          </div>

          {/* Density Controls & Refresh */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            {densityMode === "compact" && (
              <div className="flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={expandAll}
                  className="text-[11px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                  title="Expand all descriptions"
                >
                  Expand all
                </button>
                <span className="text-muted-foreground/40 text-[10px]">•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="text-[11px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                  title="Collapse all"
                >
                  Collapse
                </button>
              </div>
            )}

            {/* Density switcher */}
            <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setDensityMode("compact")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                  densityMode === "compact"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Compact view - 75% less vertical scrolling"
              >
                Compact
              </button>
              <button
                type="button"
                onClick={() => setDensityMode("detailed")}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                  densityMode === "detailed"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Detailed full-card view"
              >
                Detailed
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-7 px-2 text-xs gap-1 rounded-lg border-border/80"
              title="Refresh timeline"
            >
              <RotateCw className={`w-3 h-3 ${loading ? "animate-spin text-primary" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search timeline notes, counselor, tags, or outcomes..."
            className="h-8 pl-8 text-xs bg-background rounded-lg border-border/80"
          />
        </div>
      </div>

      {/* 4. CHRONOLOGICAL DATE-BUCKETED TIMELINE */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-6">
        {loading && activities.length === 0 ? (
          <div className="space-y-3 py-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse items-center">
                <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-muted/60 mx-auto flex items-center justify-center text-muted-foreground">
              <History className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-foreground">No matching events in this view</p>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              {searchQuery
                ? `No activities match "${searchQuery}". Clear your search query to see all events.`
                : signalFilter !== "all"
                ? `No activities match the "${signalFilter.replace("_", " ")}" filter.`
                : "Interactions and counselor assignments will appear here automatically."}
            </p>
            {(searchQuery || signalFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSignalFilter("all");
                }}
                className="h-7 text-xs mt-2"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          dateBuckets.map((bucket) => (
            <div key={bucket.label} className="space-y-3">
              {/* Date Header Separator */}
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/60"
                >
                  {bucket.label}
                </Badge>
                <div className="h-px bg-border/60 flex-1" />
                <span className="text-[10px] text-muted-foreground font-mono">
                  {bucket.items.length} {bucket.items.length === 1 ? "event" : "events"}
                </span>
              </div>

              {/* Bucket Events */}
              <div className="space-y-2">
                {bucket.items.map((act) => {
                  const meta = getActivityMeta(act.activity_type);
                  const isExpanded = densityMode === "detailed" || expandedItemIds.has(act.id);
                  const hasDetails = Boolean(act.description || act.old_value || act.new_value || act.metadata);

                  return (
                    <div
                      key={act.id}
                      className={`rounded-xl border transition-all ${
                        isExpanded
                          ? "bg-background/90 border-border p-3 shadow-2xs space-y-2"
                          : "bg-muted/15 hover:bg-muted/30 border-border/60 px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer"
                      }`}
                      onClick={() => {
                        if (densityMode === "compact" && hasDetails) {
                          toggleExpandItem(act.id);
                        }
                      }}
                    >
                      {/* Compact Single-Line Row View */}
                      {!isExpanded ? (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Dot Icon */}
                            <div
                              className={`w-6 h-6 rounded-full border ${meta.dotBg} shrink-0 flex items-center justify-center shadow-2xs`}
                            >
                              {meta.icon}
                            </div>

                            {/* Title & Preview Teaser */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {act.title}
                                </span>
                                {act.performed_by_name && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    by <strong className="text-foreground/80">{act.performed_by_name}</strong>
                                  </span>
                                )}
                              </div>

                              {/* Description Preview (1 line clamp) */}
                              {act.description && (
                                <p className="text-[11px] text-muted-foreground truncate max-w-lg">
                                  {act.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right Side: Timestamp & Expand Icon */}
                          <div className="flex items-center gap-2 shrink-0 text-right">
                            <span className="text-[10px] text-muted-foreground font-mono" title={new Date(act.created_at).toLocaleString()}>
                              {formatClockTime(act.created_at)}
                            </span>

                            {hasDetails && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandItem(act.id);
                                }}
                                className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted transition-colors"
                                title="Expand details"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        /* Expanded View */
                        <div>
                          {/* Expanded Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-7 h-7 rounded-full border ${meta.dotBg} shrink-0 flex items-center justify-center shadow-2xs`}
                              >
                                {meta.icon}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                                  <span>{act.title}</span>
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 font-mono capitalize">
                                    {meta.tagLabel}
                                  </Badge>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                  <span>Logged by <strong>{act.performed_by_name || "System"}</strong></span>
                                  <span>•</span>
                                  <span title={new Date(act.created_at).toLocaleString()}>
                                    {formatTimeAgo(act.created_at)} ({formatClockTime(act.created_at)})
                                  </span>
                                </div>
                              </div>
                            </div>

                            {densityMode === "compact" && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandItem(act.id);
                                }}
                                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors shrink-0"
                                title="Collapse"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Old → New Transition Pill */}
                          {(act.old_value || act.new_value) && act.activity_type !== "note" && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40 font-mono w-fit">
                              {act.old_value && (
                                <>
                                  <span className="line-through text-muted-foreground/80">{act.old_value}</span>
                                  <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                                </>
                              )}
                              <span className="font-semibold text-foreground">{act.new_value}</span>
                            </div>
                          )}

                          {/* Full Remarks / Description */}
                          {act.description && (
                            <div className="mt-2 text-xs text-foreground/90 whitespace-pre-wrap bg-muted/20 p-2.5 rounded-lg border border-border/50 font-normal leading-relaxed">
                              {act.description}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
