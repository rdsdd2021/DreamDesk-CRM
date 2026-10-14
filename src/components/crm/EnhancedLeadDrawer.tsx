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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  ShieldCheck,
  PhoneOff,
  UserX,
  XCircle,
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
  const [activeTab, setActiveTab] = useState<"overview" | "fields" | "timeline">("overview");
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
  const isTelecaller = currentUser?.role === "telecaller";

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

  // Dynamic Call Outcome & Gatekeeper Navigation Lock State
  const [callOutcomePending, setCallOutcomePending] = useState(false);
  const [autoAdvanceOnSave, setAutoAdvanceOnSave] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dreamdesk_auto_advance_leads") !== "0";
    }
    return true;
  });

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
    setCallOutcomePending(true);
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
    setCallOutcomePending(true);
    setCallNotes((prev) =>
      prev ? `[Call Duration: ${durStr}]\n${prev}` : `[Call Duration: ${durStr}] `
    );
    // Switch to overview tab so telecaller has the 4 outcome tiles immediately available
    setActiveTab("overview");
  };

  // Navigation Gatekeeper Lock:
  // Blocks stepper navigation if a call is active, call outcome is pending, a disposition is selected, or call notes have been typed.
  const isNavigationLocked = Boolean(
    isCalling || callOutcomePending || selectedDispId || (callNotes.trim().length > 0)
  );

  const handleAttemptClose = () => {
    if (isNavigationLocked) {
      const confirmDiscard = window.confirm(
        "You have an active call or unsaved call outcome. Discard changes and close without saving?"
      );
      if (!confirmDiscard) return;
      setCallOutcomePending(false);
      setSelectedDispId("");
      setSelectedSubDispId("");
      setCallNotes("");
    }
    onClose();
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
        if (isNavigationLocked) {
          setToastMessage("Please save the call outcome before navigating to another student.");
          setSuccessToast(true);
          setTimeout(() => setSuccessToast(false), 3000);
          return;
        }
        if (hasPrevLead && onPrevLead) onPrevLead();
      } else if (e.key === "]" || (e.key === "ArrowRight" && e.altKey)) {
        e.preventDefault();
        if (isNavigationLocked) {
          setToastMessage("Please save the call outcome before navigating to another student.");
          setSuccessToast(true);
          setTimeout(() => setSuccessToast(false), 3000);
          return;
        }
        if (hasNextLead && onNextLead) onNextLead();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, hasPrevLead, hasNextLead, onPrevLead, onNextLead, isNavigationLocked]);

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
      setSelectedDispId("");
      setSelectedSubDispId("");
      setCallOutcomePending(false);
      setToastMessage(`Logged "${opt.label}" (Attempt #${updatedLead.attempt_count || 1}). Lead remains active for retry.`);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3500);

      // Auto-advance if enabled and next lead exists
      if (autoAdvanceOnSave && hasNextLead && onNextLead) {
        setTimeout(() => {
          onNextLead();
        }, 400);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoggingUnreachableId(null);
    }
  };

  const handleSaveDynamicOutcome = async (specificDisp?: Disposition) => {
    if (!lead) return;
    const targetDisp = specificDisp || campaignDispositions.find((d) => d.id === selectedDispId);
    if (!targetDisp) {
      alert("Please select a call disposition outcome.");
      return;
    }

    if (targetDisp.requires_callback && !callbackDate) {
      alert("Please specify a callback date and time for follow-up.");
      return;
    }

    const isUnreach =
      targetDisp.category === "unreachable" ||
      ["RNR", "BUSY", "SWITCH_OFF", "INVALID_NUM"].includes(targetDisp.code);

    let targetStatus: string | undefined = undefined;
    if (targetDisp.code === "ADM_SUBMITTED") targetStatus = "Admitted";
    else if (targetDisp.category === "positive" || targetDisp.code === "INT_HIGH") targetStatus = "Interested";
    else if (targetDisp.requires_callback) targetStatus = "Follow-up";
    else if (targetDisp.category === "negative") targetStatus = "Not Interested";
    else if (isUnreach) targetStatus = undefined; // backend handles retry count / max attempts
    else targetStatus = "Contacted";

    let notesToSave = callNotes.trim();
    if (selectedSubDispId) {
      const sub = targetDisp.sub_dispositions?.find((s) => s.id === selectedSubDispId);
      if (sub) {
        notesToSave = notesToSave ? `[${sub.name}] ${notesToSave}` : `Reason: ${sub.name}`;
      }
    }

    setSavingDisp(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/disposition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition_id: targetDisp.id,
          sub_disposition_id: selectedSubDispId || undefined,
          call_outcome: isUnreach ? "unreachable" : "connected",
          notes: notesToSave || undefined,
          status: targetStatus,
          callback_at: targetDisp.requires_callback && callbackDate ? callbackDate : undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save call outcome");
      }

      const updatedLead = await res.json();
      if (onLeadUpdated) {
        onLeadUpdated(updatedLead);
      }
      if (lead.id) {
        fetchActivities(lead.id);
        fetchLockStatus(lead.id);
      }

      setSelectedDispId("");
      setSelectedSubDispId("");
      setCallbackDate("");
      setCallNotes("");
      setCallOutcomePending(false);

      setToastMessage(`Call outcome "${targetDisp.name}" and rank score saved successfully!`);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 3500);

      if (autoAdvanceOnSave && hasNextLead && onNextLead) {
        setTimeout(() => {
          onNextLead();
        }, 400);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSavingDisp(false);
    }
  };

  // Active dispositions for dynamic rendering
  const activeReachableDisps = campaignDispositions.filter(
    (d) => d.is_active !== 0 && d.category !== "unreachable"
  );
  const dynamicUnreachableDisps = campaignDispositions.filter(
    (d) => d.category === "unreachable" && d.is_active !== 0
  );

  const unreachableOptions =
    dynamicUnreachableDisps.length > 0
      ? dynamicUnreachableDisps.map((d) => {
          let icon = "📵";
          if (d.code === "RNR") icon = "📞";
          else if (d.code === "BUSY") icon = "📵";
          else if (d.code === "SWITCH_OFF") icon = "📴";
          else if (d.code === "INVALID_NUM") icon = "🚫";
          return {
            id: d.id,
            label: d.name,
            icon,
            code: d.code,
          };
        })
      : [
          { id: "disp_rnr", label: "Ringing - No Response", icon: "📞", code: "RNR" },
          { id: "disp_busy", label: "Line Busy / Cut", icon: "📵", code: "BUSY" },
          { id: "disp_switched_off", label: "Switched Off", icon: "📴", code: "SWITCH_OFF" },
          { id: "disp_invalid_num", label: "Invalid / Wrong Number", icon: "🚫", code: "INVALID_NUM" },
        ];

  // Initials for avatar
  const initials = (lead.name || "S")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const displayIndex = (leadIndex !== undefined ? leadIndex + 1 : 1).toLocaleString();
  const displayTotal = (totalLeadsCount ?? 0).toLocaleString();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleAttemptClose()}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background shadow-2xl">
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 pb-4 bg-muted/40 border-b border-border/80">
          {/* Top metadata & Lead Stepper Navigation Row (pr-10 sm:pr-12 gives clear breathing room from Sheet close button) */}
          <div className="flex items-center justify-between gap-2 mb-3 pr-10 sm:pr-12">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="font-mono text-xs font-bold text-foreground bg-background border border-border/80 px-2.5 py-1 rounded-md shadow-2xs shrink-0 select-all">
                {lead.lead_code}
              </span>

              {onPrevLead && onNextLead && (
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "flex items-center gap-0.5 rounded-lg border bg-background/90 px-1 py-0.5 shadow-2xs shrink-0 whitespace-nowrap transition-colors",
                    isNavigationLocked ? "border-amber-500/50 ring-1 ring-amber-500/20" : "border-border/80"
                  )}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!hasPrevLead || isNavigationLocked}
                      onClick={() => {
                        if (isNavigationLocked) {
                          alert("Please save or log the call outcome before navigating.");
                          return;
                        }
                        onPrevLead();
                      }}
                      title={isNavigationLocked ? "Save outcome to unlock navigation" : "Previous Lead (Shortcut: [ or Alt+Left)"}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs font-mono text-muted-foreground px-1.5 tabular-nums font-semibold select-none whitespace-nowrap">
                      {displayIndex} / {displayTotal}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 rounded-md hover:bg-muted shrink-0 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!hasNextLead || isNavigationLocked}
                      onClick={() => {
                        if (isNavigationLocked) {
                          alert("Please save or log the call outcome before navigating.");
                          return;
                        }
                        onNextLead();
                      }}
                      title={isNavigationLocked ? "Save outcome to unlock navigation" : "Next Lead (Shortcut: ] or Alt+Right)"}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {isNavigationLocked && (
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400 font-semibold px-2 py-0.5 animate-pulse gap-1 shrink-0"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      Outcome Required
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Status & Attempt Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              {(lead.attempt_count || 0) > 0 && (
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
                    (lead.attempt_count || 0) >= 3
                      ? "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400"
                  }`}
                  title={`${lead.attempt_count} dial attempt(s)`}
                >
                  Att {(lead.attempt_count || 0)}/3
                </Badge>
              )}
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 border-border/80 bg-background shrink-0 capitalize">
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

              {/* Disposition & Sub-disposition Badges (placed cleanly beneath student name) */}
              {(lead.disposition_name || lead.sub_disposition_name) && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {lead.disposition_name && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-2xs max-w-[260px] truncate shrink-0"
                      style={{ backgroundColor: lead.disposition_color || "#3b82f6" }}
                      title={`Disposition: ${lead.disposition_name}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                      <span className="truncate">{lead.disposition_name}</span>
                    </span>
                  )}
                  {lead.sub_disposition_name && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-background border border-border/80 text-foreground shadow-2xs max-w-[260px] truncate shrink-0"
                      title={`Sub-disposition: ${lead.sub_disposition_name}`}
                    >
                      <span className="truncate">{lead.sub_disposition_name}</span>
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
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
                onClick={() => setActiveTab("overview")}
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
            {!isTelecaller && (
              <TabsList className="grid grid-cols-3 h-10 p-1 bg-muted/60 rounded-xl">
                <TabsTrigger value="overview" className="text-xs font-semibold rounded-lg">
                  Overview
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
            )}

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-4 pt-3 m-0">
              {/* STREAMLINED 2-STEP CALL OUTCOME & RAPID LOGGER */}
              <div
                className={cn(
                  "bg-card border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm transition-all",
                  isNavigationLocked
                    ? "border-amber-500/50 bg-amber-500/[0.02] ring-1 ring-amber-500/20"
                    : "border-border/80"
                )}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>Call Outcome & Rapid Logger</span>
                    </span>
                    {isNavigationLocked && (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400 font-semibold px-2 py-0.5 animate-pulse gap-1"
                      >
                        <Lock className="w-2.5 h-2.5" />
                        Outcome Required
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {(selectedDispId || callNotes.trim().length > 0) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDispId("");
                          setSelectedSubDispId("");
                          setCallbackDate("");
                          setCallNotes("");
                        }}
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Reset
                      </Button>
                    )}
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer select-none">
                      <Checkbox
                        checked={autoAdvanceOnSave}
                        onCheckedChange={(checked) => {
                          const val = Boolean(checked);
                          setAutoAdvanceOnSave(val);
                          if (typeof window !== "undefined") {
                            localStorage.setItem("dreamdesk_auto_advance_leads", val ? "1" : "0");
                          }
                        }}
                        className="h-3.5 w-3.5 rounded"
                      />
                      <span className="text-[11px] font-medium">Auto-advance to next student</span>
                    </label>
                  </div>
                </div>

                {/* Dynamic Disposition Outcome Cards */}
                {activeReachableDisps.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                    No active call dispositions configured for this campaign.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {activeReachableDisps.map((disp) => {
                      const isSelected = selectedDispId === disp.id;
                      const isPositive = disp.category === "positive";
                      const isNeutral = disp.category === "neutral" || Boolean(disp.requires_callback);
                      const isNegative = disp.category === "negative";

                      return (
                        <button
                          key={disp.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDispId("");
                              setSelectedSubDispId("");
                            } else {
                              setSelectedDispId(disp.id);
                              setSelectedSubDispId("");
                              if (disp.requires_callback && !callbackDate) {
                                setCallbackInHours(2);
                              }
                            }
                          }}
                          className={cn(
                            "p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative overflow-hidden",
                            isSelected
                              ? isPositive
                                ? "bg-emerald-500/15 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/30 shadow-xs"
                                : isNeutral
                                ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/30 shadow-xs"
                                : isNegative
                                ? "bg-rose-500/15 border-rose-500 text-rose-800 dark:text-rose-300 ring-2 ring-rose-500/30 shadow-xs"
                                : "bg-primary/15 border-primary text-primary ring-2 ring-primary/30 shadow-xs"
                              : "bg-background border-border/80 hover:bg-muted/50 text-foreground"
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div
                              className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                                isPositive
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : isNeutral
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                  : isNegative
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {isPositive ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : isNeutral ? (
                                <Clock className="w-4 h-4" />
                              ) : isNegative ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <PhoneCall className="w-4 h-4" />
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 font-mono font-semibold border-0",
                                  disp.score > 0
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                    : disp.score < 0
                                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {disp.score > 0 ? `+${disp.score}` : disp.score}
                              </Badge>
                              {isSelected && (
                                <span
                                  className={cn(
                                    "w-2 h-2 rounded-full",
                                    isPositive
                                      ? "bg-emerald-500"
                                      : isNeutral
                                      ? "bg-amber-500"
                                      : isNegative
                                      ? "bg-rose-500"
                                      : "bg-primary"
                                  )}
                                />
                              )}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-bold leading-tight line-clamp-1" title={disp.name}>
                              {disp.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">
                              {disp.requires_callback
                                ? "Schedule callback"
                                : disp.sub_dispositions && disp.sub_dispositions.length > 0
                                ? `${disp.sub_dispositions.length} sub-options`
                                : disp.category.charAt(0).toUpperCase() + disp.category.slice(1)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Contextual Input Panel for Selected Disposition */}
                {selectedDispObj && (
                  <div
                    className={cn(
                      "p-3.5 rounded-xl border space-y-3.5 animate-in fade-in-50 duration-200",
                      selectedDispObj.category === "positive"
                        ? "bg-emerald-500/5 border-emerald-500/30"
                        : selectedDispObj.category === "neutral" || selectedDispObj.requires_callback
                        ? "bg-amber-500/5 border-amber-500/30"
                        : selectedDispObj.category === "negative"
                        ? "bg-rose-500/5 border-rose-500/30"
                        : "bg-primary/5 border-primary/30"
                    )}
                  >
                    {/* Header showing outcome and score effect */}
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {selectedDispObj.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 font-medium",
                            selectedDispObj.score > 0
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : selectedDispObj.score < 0
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              : "bg-muted text-muted-foreground border-border/80"
                          )}
                        >
                          {selectedDispObj.score > 0 ? `+${selectedDispObj.score} pts` : `${selectedDispObj.score} pts`} Lead Score
                        </Badge>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDispId("");
                          setSelectedSubDispId("");
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer underline"
                      >
                        Cancel selection
                      </button>
                    </div>

                    {/* Dynamic Sub-dispositions / Reasons */}
                    {selectedDispObj.sub_dispositions && selectedDispObj.sub_dispositions.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span>Specific Reason / Sub-Outcome</span>
                          </label>
                          <span className="text-[10px] text-muted-foreground">Optional</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedDispObj.sub_dispositions.map((sub) => {
                            const isSubActive = selectedSubDispId === sub.id;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => setSelectedSubDispId(isSubActive ? "" : sub.id)}
                                className={cn(
                                  "px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer flex items-center gap-1.5",
                                  isSubActive
                                    ? "bg-primary text-primary-foreground border-primary shadow-xs ring-1 ring-primary/40 font-semibold"
                                    : "bg-background border-border/80 hover:bg-muted text-foreground"
                                )}
                              >
                                <span>{sub.name}</span>
                                {sub.score !== undefined && sub.score !== 0 && (
                                  <span
                                    className={cn(
                                      "text-[10px] px-1 py-0.2 rounded font-mono",
                                      isSubActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                    )}
                                  >
                                    {sub.score > 0 ? `+${sub.score}` : sub.score}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Conditional Callback Date & Time (if requires_callback) */}
                    {selectedDispObj.requires_callback === 1 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Callback Date & Time <span className="text-rose-500">*</span></span>
                          </label>
                          <span className="text-[10px] text-muted-foreground">Required</span>
                        </div>
                        <Input
                          type="datetime-local"
                          value={callbackDate}
                          onChange={(e) => setCallbackDate(e.target.value)}
                          className="h-9 text-xs bg-background border-border/80 font-mono font-medium focus-visible:ring-amber-500"
                        />
                        {/* Fast Callback Time Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setCallbackInHours(2)}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-background border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            +2 Hours
                          </button>
                          <button
                            type="button"
                            onClick={() => setCallbackInHours(4)}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-background border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            +4 Hours
                          </button>
                          <button
                            type="button"
                            onClick={() => setCallbackTomorrow(11)}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-background border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            Tomorrow 11 AM
                          </button>
                          <button
                            type="button"
                            onClick={() => setCallbackTomorrow(16)}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-background border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            Tomorrow 4 PM
                          </button>
                          <button
                            type="button"
                            onClick={setCallbackNextMonday}
                            className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-background border border-border/80 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            Next Monday 11 AM
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notes / Remarks Field */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                        <span>Call Notes / Inquiries / Objections</span>
                        <span className="text-[10px] font-normal text-muted-foreground">Optional</span>
                      </label>
                      <Textarea
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        placeholder="e.g. Student inquiring about fees, entrance test scores, campus visit, or parent discussion..."
                        className="text-xs min-h-[58px] bg-background border-border/80 resize-none focus-visible:ring-primary"
                      />
                    </div>

                    {/* Save Action Row */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-muted-foreground truncate">
                        Stage will update to{" "}
                        <strong className="text-foreground">
                          {selectedDispObj.code === "ADM_SUBMITTED"
                            ? "Admitted"
                            : selectedDispObj.category === "positive" || selectedDispObj.code === "INT_HIGH"
                            ? "Interested"
                            : selectedDispObj.requires_callback
                            ? "Follow-up"
                            : selectedDispObj.category === "negative"
                            ? "Not Interested"
                            : "Contacted"}
                        </strong>
                      </span>
                      <Button
                        size="sm"
                        disabled={savingDisp || Boolean(selectedDispObj.requires_callback && !callbackDate)}
                        onClick={() => handleSaveDynamicOutcome()}
                        className="h-8 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-xs cursor-pointer gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        {savingDisp ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>{autoAdvanceOnSave && hasNextLead ? "Save & Next Student" : "Save Outcome"}</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Instant 1-Click Unreachable Attempts Section */}
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <PhoneOff className="w-3 h-3 text-orange-600" />
                      <span>Instant 1-Click Unreachable Loggers</span>
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Attempt {lead.attempt_count || 0}/3 • 3h Cooldown
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {unreachableOptions.map((opt) => (
                      <Button
                        key={opt.code}
                        variant="outline"
                        size="sm"
                        disabled={loggingUnreachableId !== null || savingDisp}
                        onClick={() => handleInstantUnreachable(opt)}
                        className={cn(
                          "h-9 px-2 text-xs font-semibold justify-start border-border/80 hover:bg-orange-500/10 hover:border-orange-500/40 hover:text-orange-700 dark:hover:text-orange-400 rounded-xl transition-all gap-1.5 cursor-pointer truncate",
                          loggingUnreachableId === opt.id && "bg-orange-500/15 border-orange-500"
                        )}
                        title={`Log ${opt.label} and apply 3h retry cooldown`}
                      >
                        {loggingUnreachableId === opt.id ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-orange-600 shrink-0" />
                        ) : (
                          <span className="shrink-0">{opt.icon}</span>
                        )}
                        <span className="truncate">{opt.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Counselor, Stage, Campaign & Tags Management (Supervisors / Admins Only) */}
              {!isTelecaller && (
                <>
                  {/* Counselor, Stage & Campaign Assignment Card */}
                  <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Assigned Ownership & Lifecycle Stage</span>
                  </span>
                </div>

                {/* Counselor Assignment & 7-Day Fair Allocation Policy */}
                <div className="space-y-2 pb-3.5 border-b border-border/60">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-primary" />
                      <span>Assigned Counselor</span>
                    </label>
                    {leadLockInfo?.isLocked && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        {leadLockInfo.daysRemaining}d Protection Lock
                      </Badge>
                    )}
                  </div>

                  {leadLockInfo?.isLocked && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="leading-snug">
                        Contacted {leadLockInfo.daysSinceCall}d ago by <strong>{leadLockInfo.counselorName}</strong>.
                        {isExemptRole
                          ? " Reassignment unlocked via Admin / Supervisor permission."
                          : " Reassignment locked under 7-day fair allocation policy."}
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
                      leadLockInfo?.isLocked && !isExemptRole ? "opacity-60 cursor-not-allowed bg-muted/30" : ""
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

                  {leadLockInfo?.isLocked && !isExemptRole ? (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                      Ownership locked for {leadLockInfo.daysRemaining} more days. Contact Team Leader to reassign.
                    </p>
                  ) : leadLockInfo?.isLocked && isExemptRole ? (
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <ShieldAlert className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                      Supervisor override active: Any reassignment will be recorded in audit log.
                    </p>
                  ) : null}
                </div>

                {/* Lifecycle Stage & Marketing Campaign Attribution */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Admission Stage */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0">
                        <Tag className="w-3.5 h-3.5 text-primary" />
                        <span>Admission Stage</span>
                      </label>
                      {!isExemptRole ? (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-muted/60 text-muted-foreground border-border/80 font-medium gap-1 shrink-0">
                          <Lock className="w-2.5 h-2.5" />
                          Auto-Calculated
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold gap-1 shrink-0">
                          <ShieldAlert className="w-2.5 h-2.5" />
                          Supervisor Override
                        </Badge>
                      )}
                    </div>
                    <Select
                      value={lead.status || "New"}
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
                        Calculated by CRM from call outcomes.
                      </p>
                    ) : (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 leading-snug">
                        <ShieldAlert className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                        Manual changes recorded in audit log.
                      </p>
                    )}
                  </div>

                  {/* Campaign Attribution */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-primary" />
                        <span>Attributed Campaign</span>
                      </label>
                    </div>
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
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Marketing acquisition channel attribution.
                    </p>
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
            </>
          )}

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

            {/* SUPERVISOR SECONDARY TABS (FIELDS & TIMELINE) */}
            {!isTelecaller && (
              <>
                {/* TAB 2: DYNAMIC FIELDS */}
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
          </>
        )}
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

          {selectedDispId ? (
            <Button
              size="sm"
              onClick={() => handleSaveDynamicOutcome()}
              disabled={savingDisp || Boolean(selectedDispObj?.requires_callback && !callbackDate)}
              className="flex-1 h-11 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-xs cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{savingDisp ? "Saving..." : autoAdvanceOnSave && hasNextLead ? "Save & Next" : "Save Outcome"}</span>
            </Button>
          ) : null}
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
