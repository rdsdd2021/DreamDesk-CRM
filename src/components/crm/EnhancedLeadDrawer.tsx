"use client";

import React, { useState, useEffect } from "react";
import { Lead, User, SchemaMeta, Disposition, Campaign, LeadActivity } from "@/types/crm";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { WhatsAppModal } from "@/components/crm/WhatsAppModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  Mail,
  Calendar,
  UserCheck,
  Tag,
  Clock,
  Sparkles,
  School,
  MessageSquare,
  PhoneCall,
  History,
  FileText,
  ExternalLink,
  Target,
  CheckCircle2,
  AlertCircle,
  Save,
  Square,
  Timer,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Copy,
  Check,
  User as UserIcon,
  Search,
  BookOpen,
  RotateCw,
  Send,
  CalendarClock,
  ArrowRight,
} from "lucide-react";

interface EnhancedLeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  schemaMeta: SchemaMeta[];
  onUpdateLeadStatus: (leadId: number, status: string) => void;
  onAssignLead: (leadId: number, userId: string) => void;
  onLeadUpdated?: (updatedLead: Lead) => void;
  onNextLead?: () => void;
  onPrevLead?: () => void;
  hasPrevLead?: boolean;
  hasNextLead?: boolean;
  leadIndex?: number;
  totalLeadsCount?: number;
}

export function EnhancedLeadDrawer({
  lead,
  isOpen,
  onClose,
  users,
  schemaMeta,
  onUpdateLeadStatus,
  onAssignLead,
  onLeadUpdated,
  onNextLead,
  onPrevLead,
  hasPrevLead = false,
  hasNextLead = false,
  leadIndex,
  totalLeadsCount,
}: EnhancedLeadDrawerProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "calls" | "fields" | "timeline">("overview");
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [fieldSearchQuery, setFieldSearchQuery] = useState("");

  // Call & Disposition Logging State
  const [campaignDispositions, setCampaignDispositions] = useState<Disposition[]>([]);
  const [selectedDispId, setSelectedDispId] = useState<string>("");
  const [selectedSubDispId, setSelectedSubDispId] = useState<string>("");
  const [callbackDate, setCallbackDate] = useState<string>("");
  const [callNotes, setCallNotes] = useState("");
  const [savingDisp, setSavingDisp] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  // Immutable Audit Trail Timeline State
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activityFilter, setActivityFilter] = useState<"all" | "call" | "stage_change" | "note" | "assigned">("all");
  const [newNoteText, setNewNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  const fetchActivities = async (leadId: number) => {
    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/activities`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.activities || [];
        setActivities(list);
      }
    } catch (err) {
      console.error("Failed to load lead activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleQuickAddNote = async () => {
    if (!lead || !newNoteText.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Counselor Interaction Note",
          description: newNoteText.trim(),
          activity_type: "note",
          performed_by_name: lead.assigned_user_name || "Counselor",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.activities && Array.isArray(data.activities)) {
          setActivities(data.activities);
        } else {
          fetchActivities(lead.id);
        }
        setNewNoteText("");
      }
    } catch (err) {
      console.error("Failed to add note to audit trail:", err);
    } finally {
      setSubmittingNote(false);
    }
  };

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
      return date.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return String(isoString);
    }
  };

  // Live Calling Timer State
  const [isCalling, setIsCalling] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isCalling) {
      interval = setInterval(() => {
        setCallDuration((c) => c + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCalling]);

  const handleStartCall = () => {
    setIsCalling(true);
    setCallDuration(0);
    if (lead?.phone) {
      window.location.href = `tel:${lead.phone}`;
    }
  };

  const handleEndCall = () => {
    const mins = Math.floor(callDuration / 60);
    const secs = callDuration % 60;
    const durStr = `${mins}m ${secs.toString().padStart(2, "0")}s`;
    setIsCalling(false);
    setCallNotes((prev) =>
      prev ? `[Call Duration: ${durStr}]\n${prev}` : `[Call Duration: ${durStr}] `
    );
    // Auto switch to calls tab so the telecaller can immediately log the disposition
    setActiveTab("calls");
  };

  const handleSendWhatsAppTemplate = (templateText: string) => {
    const phoneDigits = (lead?.phone || "").replace(/[^0-9]/g, "");
    if (!phoneDigits) return;
    const encoded = encodeURIComponent(templateText);
    window.open(`https://wa.me/${phoneDigits}?text=${encoded}`, "_blank");
  };

  const handleCopyText = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Load allowed dispositions and audit activities for this lead
  useEffect(() => {
    if (!lead) return;

    setSelectedDispId(lead.disposition_id || "");
    setSelectedSubDispId(lead.sub_disposition_id || "");
    setCallbackDate(lead.callback_at ? lead.callback_at.slice(0, 16) : "");
    setCallNotes("");

    const fetchDispositions = async () => {
      try {
        const url = lead.campaign_id
          ? `/api/dispositions?campaign_id=${encodeURIComponent(lead.campaign_id)}`
          : "/api/dispositions";
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data)) {
          setCampaignDispositions(data);
        }
      } catch (err) {
        console.error("Failed to load dispositions:", err);
      }
    };

    fetchDispositions();
    if (lead.id) {
      fetchActivities(lead.id);
    }
  }, [lead?.id, lead?.campaign_id, lead?.disposition_id, lead?.sub_disposition_id]);

  useEffect(() => {
    if (activeTab === "timeline" && lead?.id) {
      fetchActivities(lead.id);
    }
  }, [activeTab, lead?.id]);

  // Stepper Keyboard Hotkeys ([ and ])
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "[" || (e.key === "ArrowLeft" && e.altKey)) {
        e.preventDefault();
        if (hasPrevLead && onPrevLead) onPrevLead();
      } else if (e.key === "]" || (e.key === "ArrowRight" && e.altKey)) {
        e.preventDefault();
        if (hasNextLead && onNextLead) onNextLead();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasPrevLead, hasNextLead, onPrevLead, onNextLead]);

  if (!lead) return null;

  const dynamicAttributes = Object.entries(lead.raw_attributes || {});
  const filteredDynamicAttributes = dynamicAttributes.filter(([k, v]) => {
    if (!fieldSearchQuery.trim()) return true;
    const q = fieldSearchQuery.toLowerCase();
    const meta = schemaMeta.find((m) => m.key_name === k);
    const label = meta ? meta.display_label.toLowerCase() : k.toLowerCase();
    return label.includes(q) || String(v).toLowerCase().includes(q);
  });

  const selectedDispObj = campaignDispositions.find((d) => d.id === selectedDispId);
  const requiresCallback = selectedDispObj ? Boolean(selectedDispObj.requires_callback) : false;

  const callsCount = activities.filter((a) => a.activity_type === "disposition" || a.activity_type === "call" || a.activity_type === "callback_scheduled").length;
  const stagesCount = activities.filter((a) => a.activity_type === "stage_change").length;
  const notesCount = activities.filter((a) => a.activity_type === "note").length;
  const assignedCount = activities.filter((a) => a.activity_type === "assigned").length;

  const filteredActivities = activities.filter((act) => {
    if (activityFilter === "all") return true;
    if (activityFilter === "call") return act.activity_type === "disposition" || act.activity_type === "call" || act.activity_type === "callback_scheduled";
    if (activityFilter === "stage_change") return act.activity_type === "stage_change";
    if (activityFilter === "note") return act.activity_type === "note";
    if (activityFilter === "assigned") return act.activity_type === "assigned";
    return true;
  });

  // Preset callback helpers
  const setCallbackInHours = (hours: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setCallbackDate(iso);
  };

  const setCallbackTomorrow = (hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setCallbackDate(iso);
  };

  const setCallbackNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(11, 0, 0, 0);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setCallbackDate(iso);
  };

  const handleSaveDisposition = async () => {
    if (!lead) return;
    setSavingDisp(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/disposition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition_id: selectedDispId || null,
          sub_disposition_id: selectedSubDispId || null,
          notes: callNotes.trim() || undefined,
          callback_at: requiresCallback && callbackDate ? callbackDate : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to save call disposition");
      const updatedLead = await res.json();

      if (onLeadUpdated) {
        onLeadUpdated(updatedLead);
      }
      if (lead?.id) {
        fetchActivities(lead.id);
      }

      setCallNotes("");
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3000);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSavingDisp(false);
    }
  };

  // Group dispositions by category
  const positiveDisps = campaignDispositions.filter((d) => d.category === "positive");
  const neutralDisps = campaignDispositions.filter((d) => d.category === "neutral");
  const unreachableDisps = campaignDispositions.filter((d) => d.category === "unreachable");
  const negativeDisps = campaignDispositions.filter((d) => d.category === "negative");

  // Initials for avatar
  const initials = (lead.name || "S")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background shadow-2xl">
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 pb-4 bg-muted/40 border-b border-border/80">
          {/* Top metadata & Lead Stepper Row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-foreground bg-background border border-border/80 px-2.5 py-1 rounded-md shadow-2xs">
                {lead.lead_code}
              </span>

              {onPrevLead && onNextLead && (
                <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-background/90 px-1 py-0.5 shadow-2xs">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md cursor-pointer hover:bg-muted"
                    disabled={!hasPrevLead}
                    onClick={onPrevLead}
                    title="Previous Lead (Shortcut: [ or Alt+Left)"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs font-mono text-muted-foreground px-1 tabular-nums font-semibold">
                    {(leadIndex ?? 0) + 1} / {totalLeadsCount ?? 0}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md cursor-pointer hover:bg-muted"
                    disabled={!hasNextLead}
                    onClick={onNextLead}
                    title="Next Lead (Shortcut: ] or Alt+Right)"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {lead.disposition_name && (
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-2xs"
                  style={{ backgroundColor: lead.disposition_color || "#3b82f6" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {lead.disposition_name}
                </span>
              )}
              {lead.sub_disposition_name && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-background border border-border/80 text-foreground shadow-2xs">
                  {lead.sub_disposition_name}
                </span>
              )}
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 border-border/80 bg-background">
                {lead.status}
              </Badge>
            </div>
          </div>

          {/* Student Profile Identity Card */}
          <div className="flex items-start gap-3.5 pt-1">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-bold text-base flex items-center justify-center border border-primary/20 shrink-0 shadow-2xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {lead.name || "Student Profile"}
              </SheetTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                  <span>Enrolled {new Date(lead.created_at).toLocaleDateString()}</span>
                </span>
                {lead.campaign_name && (
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    <span>{lead.campaign_name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Callback Scheduled Alert Banner */}
          {lead.callback_at && (
            <div className="mt-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
                <span>
                  Callback Scheduled:{" "}
                  <span className="font-bold underline decoration-amber-500/50">
                    {new Date(lead.callback_at).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveTab("calls")}
                className="h-6 px-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
              >
                View
              </Button>
            </div>
          )}

          {/* Active Call Live Stopwatch Banner */}
          {isCalling && (
            <div className="mt-3.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between shadow-sm animate-pulse">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <span className="font-medium">Call Active:</span>
                <span className="font-mono text-base font-bold tabular-nums">
                  {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}
                </span>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleEndCall}
                className="h-8 text-xs font-semibold gap-1.5 px-3 rounded-lg shadow-2xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>End Call & Log Outcome</span>
              </Button>
            </div>
          )}

          {/* Quick Communication Actions Bar */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {lead.phone && !isCalling && (
              <Button
                size="sm"
                onClick={handleStartCall}
                className="h-9 px-3.5 text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Call Student</span>
              </Button>
            )}

            {lead.phone && (
              <div className="inline-flex rounded-xl shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-l-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors h-9 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="px-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-r-xl border-l border-emerald-500/40 cursor-pointer h-9 flex items-center">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72 text-xs">
                    <DropdownMenuItem
                      onClick={() => setIsWhatsAppModalOpen(true)}
                      className="cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400 gap-2 py-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Open Template Messenger Studio...</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Fast Pitch Templates
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() =>
                        handleSendWhatsAppTemplate(
                          `Hello ${lead.name || "Student"}! Thank you for inquiring about DreamDesk admissions. Here is the requested fee structure & course details for your branch. Let us know if you'd like to book an in-person counseling session!`
                        )
                      }
                      className="cursor-pointer text-xs py-2"
                    >
                      📄 Fee Structure & Brochure
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        handleSendWhatsAppTemplate(
                          `Hi ${lead.name || "Student"}, our counseling team would like to invite you and your parents for an on-campus interaction and lab tour this week. What day works best for you?`
                        )
                      }
                      className="cursor-pointer text-xs py-2"
                    >
                      🏛️ Campus Visit Invitation
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        handleSendWhatsAppTemplate(
                          `Dear ${lead.name || "Student"}, please keep your 10th & 12th mark sheets and ID proof ready for your upcoming admission counseling session!`
                        )
                      }
                      className="cursor-pointer text-xs py-2"
                    >
                      📑 Document Checklist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-border/80 bg-background hover:bg-accent transition-colors h-9 shadow-2xs"
              >
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Email</span>
              </a>
            )}
          </div>
        </div>

        {/* Multi-Tab Navigation Body */}
        <div className="p-4 sm:p-6 flex-1 space-y-4 pb-28 sm:pb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-4 h-10 p-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="overview" className="text-xs font-semibold rounded-lg">
                Overview
              </TabsTrigger>
              <TabsTrigger value="calls" className="text-xs font-semibold rounded-lg flex items-center gap-1">
                <span>Call & Log</span>
                {requiresCallback && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              </TabsTrigger>
              <TabsTrigger value="fields" className="text-xs font-semibold rounded-lg">
                Fields ({dynamicAttributes.length})
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5">
                <span>Timeline</span>
                {activities.length > 0 && (
                  <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.2 rounded-full">
                    {activities.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-4 pt-3 m-0">
              {/* Counselor & Stage Assignment Card */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Assigned Ownership & Lifecycle Stage</span>
                  {lead.campaign_name && (
                    <span className="text-[11px] text-primary normal-case font-semibold">
                      Campaign: {lead.campaign_name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Counselor Assignment */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-primary" />
                      <span>Assigned Counselor</span>
                    </label>
                    <Select
                      value={lead.assigned_to || "unassigned"}
                      onValueChange={(val) => {
                        if (val !== null) {
                          onAssignLead(lead.id, val === "unassigned" ? "" : val);
                          setTimeout(() => fetchActivities(lead.id), 350);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl border-border/80 bg-background font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-xs">
                          Unassigned Pool
                        </SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id} className="text-xs">
                            {u.name} ({u.role.replace("_", " ")})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stage Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      <span>Admission Stage</span>
                    </label>
                    <Select
                      value={lead.status}
                      onValueChange={(val) => {
                        if (val) {
                          onUpdateLeadStatus(lead.id, val);
                          setTimeout(() => fetchActivities(lead.id), 350);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl border-border/80 bg-background font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["New", "Contacted", "Interested", "Follow-up", "Admitted", "Not Interested", "Invalid"].map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Direct Contacts Card */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Contact Information
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Phone */}
                  <div className="p-3 rounded-xl border border-border/70 bg-muted/20 text-xs flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>Mobile Phone</span>
                      </div>
                      <div className="font-mono font-bold text-foreground text-sm">
                        {lead.phone || "Not Provided"}
                      </div>
                    </div>
                    {lead.phone && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyText(lead.phone!, "phone")}
                        className="h-7 px-2 text-xs font-medium cursor-pointer"
                        title="Copy Phone"
                      >
                        {copiedField === "phone" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Email */}
                  <div className="p-3 rounded-xl border border-border/70 bg-muted/20 text-xs flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3 text-blue-600" />
                        <span>Email Address</span>
                      </div>
                      <div className="font-medium text-foreground truncate max-w-[170px]">
                        {lead.email || "Not Provided"}
                      </div>
                    </div>
                    {lead.email && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyText(lead.email!, "email")}
                        className="h-7 px-2 text-xs font-medium cursor-pointer"
                        title="Copy Email"
                      >
                        {copiedField === "email" ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Academic Snapshot (if present in raw_attributes) */}
              {(lead.raw_attributes?.stream || lead.raw_attributes?.course || lead.raw_attributes?.school || lead.raw_attributes?.city) && (
                <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>Academic Highlights</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    {lead.raw_attributes?.stream && (
                      <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Stream</div>
                        <div className="font-semibold text-foreground mt-0.5">{String(lead.raw_attributes.stream)}</div>
                      </div>
                    )}
                    {lead.raw_attributes?.course && (
                      <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Preferred Course</div>
                        <div className="font-semibold text-foreground mt-0.5">{String(lead.raw_attributes.course)}</div>
                      </div>
                    )}
                    {lead.raw_attributes?.school && (
                      <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">School / College</div>
                        <div className="font-semibold text-foreground mt-0.5 truncate">{String(lead.raw_attributes.school)}</div>
                      </div>
                    )}
                    {lead.raw_attributes?.city && (
                      <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">City / Location</div>
                        <div className="font-semibold text-foreground mt-0.5">{String(lead.raw_attributes.city)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Logged Counselor Notes History */}
              {lead.notes && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Historical Counselor Notes</span>
                  </div>
                  <div className="p-4 rounded-2xl border border-border/80 bg-muted/20 text-xs font-mono whitespace-pre-wrap text-foreground leading-relaxed">
                    {lead.notes}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: CALL & OUTCOME LOGGING */}
            <TabsContent value="calls" className="space-y-4 pt-3 m-0">
              <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-primary" />
                    <span>Call Disposition & Telecaller Engine</span>
                  </div>
                  {selectedDispObj && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: selectedDispObj.color || "#3b82f6" }}
                    >
                      Score: {selectedDispObj.score > 0 ? `+${selectedDispObj.score}` : selectedDispObj.score}
                    </span>
                  )}
                </div>

                {/* Categorized Visual Disposition Selector */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-foreground">
                    Select Call Outcome
                  </label>

                  {/* Positive Outcomes */}
                  {positiveDisps.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Positive / High Intent
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {positiveDisps.map((d) => {
                          const isSelected = selectedDispId === d.id;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => setSelectedDispId(isSelected ? "" : d.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20"
                                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20"
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isSelected ? "#fff" : d.color }} />
                              <span>{d.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Neutral / Follow-up Outcomes */}
                  {neutralDisps.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Neutral / Scheduled Callbacks
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {neutralDisps.map((d) => {
                          const isSelected = selectedDispId === d.id;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => setSelectedDispId(isSelected ? "" : d.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/20"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 hover:bg-amber-500/20"
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isSelected ? "#fff" : d.color }} />
                              <span>{d.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Unreachable Outcomes */}
                  {unreachableDisps.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                        Unreachable / Not Connecting
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {unreachableDisps.map((d) => {
                          const isSelected = selectedDispId === d.id;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => setSelectedDispId(isSelected ? "" : d.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-orange-600 text-white border-orange-600 shadow-xs ring-2 ring-orange-500/20"
                                  : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25 hover:bg-orange-500/20"
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isSelected ? "#fff" : d.color }} />
                              <span>{d.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Negative Outcomes */}
                  {negativeDisps.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        Negative / Disqualified
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {negativeDisps.map((d) => {
                          const isSelected = selectedDispId === d.id;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => setSelectedDispId(isSelected ? "" : d.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                                isSelected
                                  ? "bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-500/20"
                                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 hover:bg-rose-500/20"
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isSelected ? "#fff" : d.color }} />
                              <span>{d.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sub-Disposition Dropdown (if available) */}
                {selectedDispObj?.sub_dispositions && selectedDispObj.sub_dispositions.length > 0 && (
                  <div className="space-y-1.5 pt-1 animate-in fade-in-50 duration-200">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 text-primary">
                      <CornerDownRight className="w-3.5 h-3.5" />
                      <span>Specific Reason / Sub-Outcome</span>
                    </label>
                    <Select
                      value={selectedSubDispId || "none"}
                      onValueChange={(val) => {
                        if (val) setSelectedSubDispId(val === "none" ? "" : val);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl font-medium bg-background border-primary/40">
                        <SelectValue placeholder="Select specific reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" className="text-xs text-muted-foreground">
                          General / Not Specified
                        </SelectItem>
                        {selectedDispObj.sub_dispositions.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id} className="text-xs">
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Counselor Pitch & Objection Rebuttal Guide */}
                {selectedDispId && (
                  <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 space-y-2 mt-2">
                    <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <span>Counselor Pitch & Objection Assistant</span>
                    </div>

                    {selectedSubDispId === "sub_ni_budget" ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        💡 <strong>Talking Point:</strong> Highlight our <strong>0% interest monthly installment plan</strong> and the <strong>Merit Scholarship Test (up to 40% fee waiver)</strong>. Offer to send the financial aid brochure via WhatsApp.
                      </p>
                    ) : selectedSubDispId === "sub_ni_distance" ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        🚌 <strong>Talking Point:</strong> Emphasize our <strong>18 AC bus routes</strong>, 24/7 guarded campus security, and separate on-campus hostels with meal plans.
                      </p>
                    ) : selectedSubDispId === "sub_fu_comparing" ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        🏆 <strong>Talking Point:</strong> Highlight our <strong>94.2% placement rate</strong>, 120+ recruitment partners, NAAC Grade-A+ accreditation, and small 1:15 mentor ratio.
                      </p>
                    ) : selectedSubDispId === "sub_fu_board_results" ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        📋 <strong>Talking Point:</strong> Recommend placing a <strong>Provisional Seat Block</strong> today to lock in current tuition rates and scholarship brackets while awaiting final board results.
                      </p>
                    ) : selectedDispId === "disp_couns_booked" ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        🎯 <strong>Talking Point:</strong> Confirm parent availability, explain that our Senior Dean will personally evaluate career roadmaps, and send a calendar invite immediately.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        ✨ <strong>Talking Point:</strong> Ask open-ended questions about their career aspirations in <strong>{String(lead.raw_attributes?.stream || "their chosen stream")}</strong> and offer to send our comprehensive curriculum overview.
                      </p>
                    )}
                  </div>
                )}

                {/* Conditional Callback Date Picker */}
                {requiresCallback && (
                  <div className="p-3.5 rounded-xl border bg-amber-500/5 border-amber-500/25 space-y-2.5">
                    <label className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Follow-up Callback Date & Time (Required)</span>
                    </label>
                    <Input
                      type="datetime-local"
                      value={callbackDate}
                      onChange={(e) => setCallbackDate(e.target.value)}
                      className="h-9 text-xs font-mono bg-background rounded-xl border-amber-500/30"
                    />

                    {/* Quick Callback Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={() => setCallbackInHours(2)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 font-semibold transition-colors cursor-pointer"
                      >
                        +2 Hours
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallbackTomorrow(11)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 font-semibold transition-colors cursor-pointer"
                      >
                        Tomorrow 11 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallbackTomorrow(16)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 font-semibold transition-colors cursor-pointer"
                      >
                        Tomorrow 4 PM
                      </button>
                      <button
                        type="button"
                        onClick={setCallbackNextMonday}
                        className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 font-semibold transition-colors cursor-pointer"
                      >
                        Next Monday
                      </button>
                    </div>
                  </div>
                )}

                {/* Call Notes input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Counselor Call Note & Discussion Summary
                  </label>
                  <Textarea
                    placeholder="Enter notes regarding student interest, parent concerns, financial discussions, or key takeaways..."
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    className="text-xs min-h-[85px] rounded-xl leading-relaxed"
                  />
                </div>

                {/* Save Disposition Button */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={handleSaveDisposition}
                    disabled={savingDisp}
                    className="w-full h-10 text-xs sm:text-sm font-bold gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingDisp ? "Saving Outcome..." : "Save Call Outcome & Disposition"}</span>
                  </Button>

                  {successToast && (
                    <div className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Call disposition and note saved successfully!</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: DYNAMIC FIELDS */}
            <TabsContent value="fields" className="space-y-3 pt-3 m-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Filter student attributes (e.g. stream, marks, city)..."
                  value={fieldSearchQuery}
                  onChange={(e) => setFieldSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl"
                />
              </div>

              <div className="border border-border/80 rounded-2xl divide-y divide-border/60 bg-card text-xs overflow-hidden shadow-2xs">
                {filteredDynamicAttributes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No matching student attributes found.
                  </div>
                ) : (
                  filteredDynamicAttributes.map(([key, val]) => {
                    const meta = schemaMeta.find((m) => m.key_name === key);
                    const label = meta ? meta.display_label : key.replace(/_/g, " ").toUpperCase();

                    return (
                      <div key={key} className="p-3 sm:p-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <span className="text-muted-foreground font-semibold text-xs">
                          {label}
                        </span>
                        <div className="flex items-center gap-2 max-w-[60%] justify-end">
                          <span className="font-semibold text-foreground text-right truncate">
                            {String(val)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(String(val), key)}
                            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted cursor-pointer shrink-0"
                            title="Copy value"
                          >
                            {copiedField === key ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* TAB 4: AUDIT TIMELINE */}
            <TabsContent value="timeline" className="space-y-4 pt-3 m-0">
              {/* Header & Filter Controls Card */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span>Lead Activity & Audit Trail</span>
                        <Badge variant="secondary" className="text-[11px] font-bold rounded-lg px-2">
                          {activities.length} {activities.length === 1 ? "Event" : "Events"}
                        </Badge>
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Permanent chronological history of calls, stages, notes, and counselor allocations
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => lead?.id && fetchActivities(lead.id)}
                    disabled={loadingActivities}
                    className="h-8 text-xs gap-1.5 rounded-lg border-border/80 hover:bg-muted font-medium"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${loadingActivities ? "animate-spin text-primary" : ""}`} />
                    <span>Refresh</span>
                  </Button>
                </div>

                {/* Quick Add Counselor Interaction Note */}
                <div className="bg-muted/30 border border-border/70 rounded-xl p-3 space-y-2.5">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    <span>Add Timestamped Note to Audit Trail</span>
                  </div>
                  <Textarea
                    placeholder="Enter counselor observation, student interaction remarks, or follow-up feedback..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="min-h-[64px] text-xs resize-none rounded-lg bg-background border-border/80 focus-visible:ring-primary/20"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleQuickAddNote}
                      disabled={submittingNote || !newNoteText.trim()}
                      className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Send className="w-3 h-3" />
                      <span>{submittingNote ? "Logging..." : "Log Note"}</span>
                    </Button>
                  </div>
                </div>

                {/* Activity Category Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    type="button"
                    onClick={() => setActivityFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                      activityFilter === "all"
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    All ({activities.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter("call")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                      activityFilter === "call"
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Calls & Outcomes ({callsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter("stage_change")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                      activityFilter === "stage_change"
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Stage Changes ({stagesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter("assigned")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                      activityFilter === "assigned"
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Counselors ({assignedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter("note")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap text-xs ${
                      activityFilter === "note"
                        ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    Notes ({notesCount})
                  </button>
                </div>
              </div>

              {/* Timeline Events List */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
                {loadingActivities && activities.length === 0 ? (
                  <div className="space-y-4 py-6">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-muted rounded w-1/3" />
                          <div className="h-3 bg-muted rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredActivities.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-muted/60 mx-auto flex items-center justify-center text-muted-foreground">
                      <History className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">No events recorded in this view</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      {activityFilter === "all"
                        ? "Interactions, call dispositions, and counselor assignments will appear here automatically."
                        : `No activities found matching the selected filter.`}
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/80">
                    {filteredActivities.map((act) => {
                      let metaObj: any = null;
                      if (act.metadata) {
                        try {
                          metaObj = typeof act.metadata === "string" ? JSON.parse(act.metadata) : act.metadata;
                        } catch {
                          metaObj = null;
                        }
                      }

                      // Type-specific icon and border color
                      let iconEl = <History className="w-3.5 h-3.5" />;
                      let dotBorderColor = "border-primary/40 text-primary bg-primary/10";

                      if (act.activity_type === "disposition" || act.activity_type === "call") {
                        iconEl = <PhoneCall className="w-3.5 h-3.5 text-primary" />;
                        dotBorderColor = "border-primary/40 text-primary bg-primary/10";
                      } else if (act.activity_type === "stage_change") {
                        iconEl = <ArrowRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />;
                        dotBorderColor = "border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10";
                      } else if (act.activity_type === "assigned") {
                        iconEl = <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
                        dotBorderColor = "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
                      } else if (act.activity_type === "callback_scheduled") {
                        iconEl = <CalendarClock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
                        dotBorderColor = "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10";
                      } else if (act.activity_type === "note") {
                        iconEl = <MessageSquare className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
                        dotBorderColor = "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10";
                      } else if (act.activity_type === "created") {
                        iconEl = <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />;
                        dotBorderColor = "border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/10";
                      } else if (act.activity_type === "field_update") {
                        iconEl = <FileText className="w-3.5 h-3.5 text-muted-foreground" />;
                        dotBorderColor = "border-border text-muted-foreground bg-muted";
                      }

                      return (
                        <div key={act.id} className="relative group">
                          {/* Anchor Icon Dot */}
                          <div
                            className={`absolute -left-6 top-1 w-7 h-7 rounded-full border ${dotBorderColor} ring-4 ring-card flex items-center justify-center transition-transform group-hover:scale-110 shadow-2xs`}
                          >
                            {iconEl}
                          </div>

                          {/* Event Body Card */}
                          <div className="bg-background/80 hover:bg-background border border-border/70 hover:border-border rounded-xl p-3.5 space-y-2 transition-all shadow-2xs">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-foreground">
                                  {act.title}
                                </span>
                                {metaObj?.score !== undefined && metaObj.score > 0 && (
                                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border-0 h-4.5 px-1.5">
                                    +{metaObj.score} pts
                                  </Badge>
                                )}
                                {metaObj?.color && (
                                  <div
                                    className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0"
                                    style={{ backgroundColor: metaObj.color }}
                                  />
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <Badge variant="outline" className="text-[10px] font-medium h-4.5 px-1.5 gap-1 border-border/60">
                                  <UserIcon className="w-2.5 h-2.5 text-muted-foreground" />
                                  <span>{act.performed_by_name || "System"}</span>
                                </Badge>
                                <span title={new Date(act.created_at).toLocaleString()}>
                                  {formatTimeAgo(act.created_at)}
                                </span>
                              </div>
                            </div>

                            {/* Old → New Transition Pill */}
                            {(act.old_value || act.new_value) && act.activity_type !== "note" && (
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40 font-mono w-fit">
                                {act.old_value && (
                                  <>
                                    <span className="line-through text-muted-foreground/80">{act.old_value}</span>
                                    <ArrowRight className="w-3 h-3 text-primary shrink-0" />
                                  </>
                                )}
                                <span className="font-semibold text-foreground">{act.new_value}</span>
                              </div>
                            )}

                            {/* Detailed Description / Remark */}
                            {act.description && (
                              <div className="text-xs text-foreground/90 whitespace-pre-wrap bg-muted/20 p-2.5 rounded-lg border border-border/50 font-normal leading-relaxed">
                                {act.description}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sticky Mobile Quick Actions Bar (Finger-friendly for telecallers & counselors) */}
        <div className="sticky bottom-0 left-0 right-0 p-3 bg-card/95 backdrop-blur-md border-t border-border/80 flex items-center gap-2 sm:hidden z-20 shadow-lg safe-area-bottom">
          {lead.phone ? (
            <Button
              size="sm"
              onClick={handleStartCall}
              className="flex-1 h-11 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Call</span>
            </Button>
          ) : null}

          {lead.phone ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsWhatsAppModalOpen(true)}
              className="flex-1 h-11 text-xs font-bold gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </Button>
          ) : null}

          <Button
            size="sm"
            onClick={handleSaveDisposition}
            disabled={savingDisp || (!selectedDispId && !callNotes.trim())}
            className="flex-1 h-11 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{savingDisp ? "Saving..." : "Log Outcome"}</span>
          </Button>
        </div>

        {/* WhatsApp Quick Template Messenger Modal */}
        <WhatsAppModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          lead={lead}
          onMessageSent={() => {
            if (onLeadUpdated && lead) {
              onLeadUpdated({ ...lead, updated_at: new Date().toISOString() });
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
