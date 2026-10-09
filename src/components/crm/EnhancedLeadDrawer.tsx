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
import { WhatsAppModal } from "@/components/crm/WhatsAppModal";
import { LeadTimeline } from "@/components/crm/LeadTimeline";
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
  Bookmark,
  Plus,
  X,
  Lock,
  ShieldAlert,
} from "lucide-react";

interface EnhancedLeadDrawerProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  schemaMeta: SchemaMeta[];
  campaigns?: Campaign[];
  currentUser?: User | null;
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

const PRESET_TAGS = [
  "High Priority",
  "Hostel Required",
  "Fee Sensitive",
  "Scholarship",
  "VIP Referral",
  "Outstation",
  "Parent Follow-up",
  "Document Pending",
  "Exam Cleared",
  "Merit Candidate",
];

export function EnhancedLeadDrawer({
  lead,
  isOpen,
  onClose,
  users,
  schemaMeta,
  campaigns = [],
  currentUser,
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

  // Counselor Ownership Lock Policy State
  const [leadLockInfo, setLeadLockInfo] = useState<{
    isLocked: boolean;
    leadId: number;
    leadCode: string;
    counselorId?: string;
    counselorName?: string;
    lastCallAt?: string;
    daysSinceCall?: number;
    daysRemaining?: number;
    lockDays?: number;
  } | null>(null);

  const isExemptRole =
    currentUser?.role === "admin" || currentUser?.role === "team_lead";

  // Lead Tags & Campaign Attribution State
  const [leadTags, setLeadTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  const [updatingCampaign, setUpdatingCampaign] = useState(false);

  // Call & Disposition Logging State
  const [campaignDispositions, setCampaignDispositions] = useState<Disposition[]>([]);
  const [selectedDispId, setSelectedDispId] = useState<string>("");
  const [selectedSubDispId, setSelectedSubDispId] = useState<string>("");
  const [callbackDate, setCallbackDate] = useState<string>("");
  const [callNotes, setCallNotes] = useState("");
  const [savingDisp, setSavingDisp] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [loggingUnreachableId, setLoggingUnreachableId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState("Call disposition and note saved successfully!");

  // Immutable Audit Trail Timeline State
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

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

  const fetchLockStatus = async (leadId?: number) => {
    const id = leadId ?? lead?.id;
    if (!id) return;
    try {
      const res = await fetch(`/api/policies/check?lead_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setLeadLockInfo(data.lock || null);
      }
    } catch (err) {
      console.error("Failed to check policy lock:", err);
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

    if (lead?.id) {
      fetch(`/api/leads/${lead.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_type: "whatsapp",
          title: "WhatsApp Fast Pitch Sent",
          description: templateText,
          metadata: { channel: "whatsapp", phone: lead.phone },
          performed_by_name: lead.assigned_user_name || "Counselor",
        }),
      })
        .then(() => fetchActivities(lead.id))
        .catch(console.error);
    }
  };

  const handleCopyText = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Load allowed dispositions, tags and audit activities for this lead
  useEffect(() => {
    if (!lead) return;

    setSelectedDispId(lead.disposition_id || "");
    setSelectedSubDispId(lead.sub_disposition_id || "");
    setCallbackDate(lead.callback_at ? lead.callback_at.slice(0, 16) : "");
    setCallNotes("");
    setLeadTags(lead.tags || []);

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
      fetchLockStatus(lead.id);
    }
  }, [lead?.id, lead?.campaign_id, lead?.disposition_id, lead?.sub_disposition_id, lead?.tags]);

  // Campaign Attribution Handler
  const handleCampaignChange = async (newCampId: string) => {
    if (!lead) return;
    const targetVal = newCampId === "unassigned" ? null : newCampId;
    setUpdatingCampaign(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "campaign_id", value: targetVal }),
      });
      if (!res.ok) throw new Error("Failed to update campaign");
      const updatedLead = await res.json();
      if (onLeadUpdated) onLeadUpdated(updatedLead);
      fetchActivities(lead.id);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setUpdatingCampaign(false);
    }
  };

  // Lead Tags Management Handlers
  const handleSaveTags = async (nextTags: string[]) => {
    if (!lead) return;
    setSavingTags(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags }),
      });
      if (!res.ok) throw new Error("Failed to update tags");
      const updatedLead = await res.json();
      setLeadTags(updatedLead.tags || nextTags);
      if (onLeadUpdated) onLeadUpdated(updatedLead);
      fetchActivities(lead.id);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSavingTags(false);
    }
  };

  const handleAddCustomTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customTagInput.trim();
    if (!clean) return;
    if (!leadTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      const next = [...leadTags, clean];
      setLeadTags(next);
      handleSaveTags(next);
    }
    setCustomTagInput("");
  };

  const handleTogglePresetTag = (tag: string) => {
    const exists = leadTags.some((t) => t.toLowerCase() === tag.toLowerCase());
    const next = exists
      ? leadTags.filter((t) => t.toLowerCase() !== tag.toLowerCase())
      : [...leadTags, tag];
    setLeadTags(next);
    handleSaveTags(next);
  };

  const handleRemoveTag = (tag: string) => {
    const next = leadTags.filter((t) => t !== tag);
    setLeadTags(next);
    handleSaveTags(next);
  };

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

  const handleInstantUnreachable = async (opt: { id: string; label: string; code: string }) => {
    if (!lead) return;
    setLoggingUnreachableId(opt.id);
    try {
      const res = await fetch(`/api/leads/${lead.id}/disposition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition_id: opt.id,
          call_outcome: "unreachable",
          notes: callNotes.trim() ? `[${opt.label}] ${callNotes.trim()}` : `Call Attempt: ${opt.label}`,
        }),
      });

      if (!res.ok) throw new Error("Failed to log unreachable call attempt");
      const updatedLead = await res.json();

      if (onLeadUpdated) {
        onLeadUpdated(updatedLead);
      }
      if (lead?.id) {
        fetchActivities(lead.id);
      }

      setCallNotes("");
      setToastMessage(`Logged "${opt.label}" (Attempt #${updatedLead.attempt_count || 1}). Lead remains active for retry.`);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3500);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoggingUnreachableId(null);
    }
  };

  const handleSaveConnectedDisposition = async () => {
    if (!lead) return;
    if (!selectedDispId) {
      alert("Please select a call outcome before saving.");
      return;
    }
    if (requiresCallback && !callbackDate) {
      alert("Please specify a follow-up callback date and time.");
      return;
    }
    setSavingDisp(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/disposition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition_id: selectedDispId,
          sub_disposition_id: selectedSubDispId || null,
          call_outcome: "connected",
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
      setToastMessage("Connected call outcome and conversation saved successfully!");
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3500);
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
  const negativeDisps = campaignDispositions.filter((d) => d.category === "negative" && d.code !== "INVALID_NUM");

  const unreachableOptions = [
    {
      id: campaignDispositions.find((d) => d.code === "RNR")?.id || "disp_rnr",
      label: "Ringing - No Response",
      icon: "📞",
      code: "RNR",
    },
    {
      id: campaignDispositions.find((d) => d.code === "BUSY")?.id || "disp_busy",
      label: "Line Busy / Cut",
      icon: "📵",
      code: "BUSY",
    },
    {
      id: campaignDispositions.find((d) => d.code === "SWITCH_OFF")?.id || "disp_switched_off",
      label: "Switched Off",
      icon: "📴",
      code: "SWITCH_OFF",
    },
    {
      id: campaignDispositions.find((d) => d.code === "INVALID_NUM")?.id || "disp_invalid_num",
      label: "Invalid / Wrong Number",
      icon: "🚫",
      code: "INVALID_NUM",
    },
  ];

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
                {leadTags && leadTags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {leadTags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
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
              {/* Counselor, Stage & Campaign Assignment Card */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Assigned Ownership & Lifecycle Stage</span>
                  {lead.campaign_name && (
                    <span className="text-[11px] text-primary normal-case font-semibold">
                      Campaign: {lead.campaign_name}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {/* Counselor Assignment */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-primary" />
                      <span>Assigned Counselor</span>
                      {leadLockInfo?.isLocked && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold gap-1 ml-auto">
                          <Lock className="w-2.5 h-2.5" />
                          {leadLockInfo.daysRemaining}d Lock
                        </Badge>
                      )}
                    </label>

                    {leadLockInfo?.isLocked && (
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5 leading-snug">
                        <Lock className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                          Contacted {leadLockInfo.daysSinceCall}d ago by <strong>{leadLockInfo.counselorName}</strong>.
                          {isExemptRole
                            ? " Admin/Team Lead override enabled."
                            : " Locked under 7-day policy."}
                        </span>
                      </div>
                    )}

                    <Select
                      value={lead.assigned_to || "unassigned"}
                      disabled={Boolean(leadLockInfo?.isLocked && !isExemptRole)}
                      onValueChange={(val) => {
                        if (val !== null) {
                          onAssignLead(lead.id, val === "unassigned" ? "" : val);
                          setTimeout(() => {
                            fetchActivities(lead.id);
                            fetchLockStatus();
                          }, 400);
                        }
                      }}
                    >
                      <SelectTrigger className={`h-9 text-xs rounded-xl border-border/80 bg-background font-medium ${
                        leadLockInfo?.isLocked && !isExemptRole ? "opacity-60 cursor-not-allowed" : ""
                      }`}>
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

                    {leadLockInfo?.isLocked && !isExemptRole && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-amber-600" />
                        Reassignment locked under 7-day rule. Contact Admin or Team Leader.
                      </p>
                    )}
                    {leadLockInfo?.isLocked && isExemptRole && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <ShieldAlert className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                        Override active: Reassignment will be logged in audit trail.
                      </p>
                    )}
                  </div>

                  {/* Stage Selection (Automatic calculation with supervisory override) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-primary" />
                        <span>Admission Stage</span>
                      </label>
                      {!isExemptRole ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-muted/60 text-muted-foreground border-border/80 font-medium gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          Auto-Calculated
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold gap-1">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          Supervisor Override
                        </Badge>
                      )}
                    </div>
                    <Select
                      value={lead.status}
                      disabled={!isExemptRole}
                      onValueChange={(val) => {
                        if (val) {
                          onUpdateLeadStatus(lead.id, val);
                          setTimeout(() => fetchActivities(lead.id), 350);
                        }
                      }}
                    >
                      <SelectTrigger className={`h-9 text-xs rounded-xl border-border/80 bg-background font-medium ${
                        !isExemptRole ? "opacity-75 cursor-not-allowed bg-muted/30" : ""
                      }`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["New", "Contacted", "Interested", "Follow-up", "Admitted", "Not Interested", "Unreachable", "Invalid"].map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isExemptRole ? (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 leading-snug">
                        <Lock className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        Stage is calculated automatically by CRM from validated call outcomes. Manual stage overrides require Supervisor (Admin / Team Lead) permission.
                      </p>
                    ) : (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 leading-snug">
                        <ShieldAlert className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                        Supervisor override active: Any manual stage change will be logged in audit trail.
                      </p>
                    )}
                  </div>

                  {/* Campaign Attribution */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-primary" />
                      <span>Attributed Campaign</span>
                    </label>
                    <Select
                      value={lead.campaign_id || "unassigned"}
                      onValueChange={(val) => {
                        if (val !== null) {
                          handleCampaignChange(val);
                        }
                      }}
                      disabled={updatingCampaign}
                    >
                      <SelectTrigger className="h-9 text-xs rounded-xl border-border/80 bg-background font-medium">
                        <SelectValue placeholder="Select campaign..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-xs text-muted-foreground">
                          None (Unattributed)
                        </SelectItem>
                        {campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Student Tags & Priority Labels Card */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-primary" />
                    <span>Student Tags & Priority Labels</span>
                  </div>
                  {savingTags && (
                    <span className="text-[11px] text-muted-foreground animate-pulse font-medium">
                      Saving tags...
                    </span>
                  )}
                </div>

                {/* Active Tags */}
                <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] p-2 rounded-xl bg-muted/20 border border-border/60">
                  {leadTags.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic px-1">
                      No tags assigned yet. Click preset chips below or type a custom tag.
                    </span>
                  ) : (
                    leadTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs group"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:bg-primary/20 rounded-full p-0.5 text-primary/70 hover:text-primary transition-colors cursor-pointer"
                          title={`Remove #${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Custom Tag Input */}
                <form onSubmit={handleAddCustomTag} className="flex items-center gap-2">
                  <Input
                    placeholder="Type custom tag (e.g. VIP Referral, JEE Prep)..."
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    className="h-8.5 text-xs rounded-xl"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={!customTagInput.trim() || savingTags}
                    className="h-8.5 px-3 text-xs font-semibold gap-1 rounded-xl shrink-0 border-border/80 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </Button>
                </form>

                {/* Quick Preset Suggestion Chips */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Fast Preset Suggestions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TAGS.map((tag) => {
                      const isActive = leadTags.some((t) => t.toLowerCase() === tag.toLowerCase());
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTogglePresetTag(tag)}
                          disabled={savingTags}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer font-medium border ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary font-semibold shadow-2xs"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted border-border/60 hover:text-foreground"
                          }`}
                        >
                          <span>#{tag}</span>
                          {isActive && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
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
              {/* Telecalling Retry Cadence & Policy Tracker */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-muted/30 shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5 text-primary" />
                    <span>Dialing Cadence:</span>
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                      (lead.attempt_count || 0) >= 3
                        ? "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400"
                        : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"
                    }`}
                  >
                    Attempt {(lead.attempt_count || 0)} / 3
                  </Badge>
                  {lead.cooldown_until && new Date(lead.cooldown_until) > new Date() && (
                    <Badge
                      variant="outline"
                      className="text-xs font-medium px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400 animate-pulse flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3" />
                      Cooldown until {new Date(lead.cooldown_until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Badge>
                  )}
                </div>
                {lead.last_attempt_at && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Last: {formatTimeAgo(lead.last_attempt_at)}
                  </span>
                )}
              </div>

              {/* ZONE 1: UNREACHABLE (1-CLICK INSTANT RETRY) */}
              <div className="p-4 rounded-2xl border border-orange-500/25 bg-orange-500/5 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-orange-700 dark:text-orange-400 flex items-center gap-1.5 uppercase tracking-wide">
                      <PhoneCall className="w-3.5 h-3.5 text-orange-600" />
                      <span>Zone 1: Unreachable / Did Not Connect</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      1-Click registers attempt & 3h cooldown. Lead remains active in retry queue (not falsely marked as Contacted).
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-700 border-orange-500/30 shrink-0 font-semibold">
                    1-Click Instant
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {unreachableOptions.map((opt) => {
                    const isLogging = loggingUnreachableId === opt.id;
                    return (
                      <Button
                        key={opt.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loggingUnreachableId !== null || savingDisp}
                        onClick={() => handleInstantUnreachable(opt)}
                        className="h-10 text-xs font-semibold rounded-xl border-orange-500/30 bg-background hover:bg-orange-500/15 text-orange-700 dark:text-orange-300 hover:text-orange-800 dark:hover:text-orange-200 justify-start gap-1.5 px-2.5 transition-all shadow-2xs hover:shadow-xs cursor-pointer"
                      >
                        {isLogging ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin shrink-0 text-orange-600" />
                        ) : (
                          <span className="text-sm shrink-0">{opt.icon}</span>
                        )}
                        <span className="truncate">{opt.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* ZONE 2: CALL CONNECTED (STUDENT CONVERSATION) */}
              <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                      <span>Zone 2: Call Connected (Student Conversation)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Student or parent answered the call. Select conversation outcome, sub-reasons, and follow-up plan.
                    </p>
                  </div>
                  {selectedDispObj && (
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full text-white shadow-2xs shrink-0"
                      style={{ backgroundColor: selectedDispObj.color || "#3b82f6" }}
                    >
                      Score: {selectedDispObj.score > 0 ? `+${selectedDispObj.score}` : selectedDispObj.score}
                    </span>
                  )}
                </div>

                {/* Categorized Visual Disposition Selector */}
                <div className="space-y-3 pt-1">
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

                {/* Sub-Disposition Dropdown (Conditional) */}
                {selectedDispObj?.sub_dispositions && selectedDispObj.sub_dispositions.length > 0 && (
                  <div className="space-y-1.5 pt-1 animate-in fade-in-50 duration-200">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 text-primary">
                      <CornerDownRight className="w-3.5 h-3.5" />
                      <span>Specific Reason / Sub-Outcome (Conditional)</span>
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

                {/* Counseling Booking (Conditional Prompt) */}
                {selectedDispObj?.code === "COUNS_BOOKED" && (
                  <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 space-y-1 text-xs">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Counseling Session Confirmed</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Remind candidate to keep 10th & 12th marksheets ready and note campus or online counseling slot in the remarks below.
                    </p>
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

                {/* Save Connected Disposition Button */}
                <div className="pt-2">
                  <Button
                    size="sm"
                    onClick={handleSaveConnectedDisposition}
                    disabled={savingDisp || !selectedDispId || (requiresCallback && !callbackDate)}
                    className="w-full h-10 text-xs sm:text-sm font-bold gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingDisp ? "Saving Conversation..." : "Save Connected Call Outcome"}</span>
                  </Button>

                  {successToast && (
                    <div className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{toastMessage}</span>
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

            {/* TAB 4: AUDIT TIMELINE & EXECUTIVE JOURNEY */}
            <TabsContent value="timeline" className="pt-3 m-0">
              <LeadTimeline
                lead={lead}
                activities={activities}
                loading={loadingActivities}
                onRefresh={() => lead?.id && fetchActivities(lead.id)}
                onAddNote={async (noteText) => {
                  if (!lead) return;
                  await fetch(`/api/leads/${lead.id}/activities`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: "Counselor Interaction Note",
                      description: noteText.trim(),
                      activity_type: "note",
                      performed_by_name: currentUser?.name || lead.assigned_user_name || "Counselor",
                    }),
                  });
                  fetchActivities(lead.id);
                }}
                currentUser={currentUser}
              />
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
            onClick={() => {
              if (selectedDispId) {
                handleSaveConnectedDisposition();
              } else {
                setActiveTab("calls");
              }
            }}
            disabled={savingDisp}
            className="flex-1 h-11 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{savingDisp ? "Saving..." : selectedDispId ? "Log Outcome" : "Log Call"}</span>
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
