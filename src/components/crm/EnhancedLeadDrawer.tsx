"use client";

import React, { useState, useEffect } from "react";
import { Lead, User, SchemaMeta, Disposition, Campaign } from "@/types/crm";
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
  const [activeTab, setActiveTab] = useState<"overview" | "fields" | "calls" | "timeline">("overview");
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Call & Disposition Logging State
  const [campaignDispositions, setCampaignDispositions] = useState<Disposition[]>([]);
  const [selectedDispId, setSelectedDispId] = useState<string>("");
  const [selectedSubDispId, setSelectedSubDispId] = useState<string>("");
  const [callbackDate, setCallbackDate] = useState<string>("");
  const [callNotes, setCallNotes] = useState("");
  const [savingDisp, setSavingDisp] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

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
  };

  const handleSendWhatsAppTemplate = (templateText: string) => {
    const phoneDigits = (lead?.phone || "").replace(/[^0-9]/g, "");
    if (!phoneDigits) return;
    const encoded = encodeURIComponent(templateText);
    window.open(`https://wa.me/${phoneDigits}?text=${encoded}`, "_blank");
  };

  // Load allowed dispositions for this lead's campaign
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
  }, [lead?.id, lead?.campaign_id, lead?.disposition_id, lead?.sub_disposition_id]);

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
  const cleanPhone = (lead.phone || "").replace(/[^0-9]/g, "");
  const whatsappUrl = cleanPhone.length >= 10 ? `https://wa.me/${cleanPhone}` : null;

  const selectedDispObj = campaignDispositions.find((d) => d.id === selectedDispId);
  const requiresCallback = selectedDispObj ? Boolean(selectedDispObj.requires_callback) : false;

  // Preset callback helpers
  const setCallbackInHours = (hours: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    // Format YYYY-MM-DDTHH:mm
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

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 flex flex-col">
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 pb-4 bg-muted/40 border-b">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {lead.lead_code}
              </span>
              {onPrevLead && onNextLead && (
                <div className="flex items-center gap-0.5 rounded-lg border bg-background/80 px-1 py-0.5 shadow-2xs">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded cursor-pointer"
                    disabled={!hasPrevLead}
                    onClick={onPrevLead}
                    title="Previous Lead (Alt+Left or [)"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-[10px] font-mono text-muted-foreground px-1 tabular-nums font-semibold">
                    {(leadIndex ?? 0) + 1} / {totalLeadsCount ?? 0}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded cursor-pointer"
                    disabled={!hasNextLead}
                    onClick={onNextLead}
                    title="Next Lead (Alt+Right or ])"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {lead.disposition_name && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white shadow-2xs"
                  style={{ backgroundColor: lead.disposition_color || "#3b82f6" }}
                >
                  {lead.disposition_name}
                </span>
              )}
              {lead.sub_disposition_name && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-background border text-foreground shadow-2xs">
                  {lead.sub_disposition_name}
                </span>
              )}
              <Badge variant="outline" className="text-xs font-semibold">
                {lead.status}
              </Badge>
            </div>
          </div>

          <SheetTitle className="text-xl font-bold text-foreground">
            {lead.name || "Student Profile"}
          </SheetTitle>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>Registered on {new Date(lead.created_at).toLocaleDateString()}</span>
            {lead.campaign_name && (
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Target className="w-3 h-3 text-primary" />
                <span>{lead.campaign_name}</span>
              </span>
            )}
          </div>

          {/* Callback Scheduled Alert Banner */}
          {lead.callback_at && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>
                  Callback Scheduled:{" "}
                  <span className="font-bold">
                    {new Date(lead.callback_at).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Active Call Live Stopwatch Banner */}
          {isCalling && (
            <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span>Call Active:</span>
                <span className="font-mono text-sm font-bold">
                  {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}
                </span>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleEndCall}
                className="h-7 text-xs font-semibold gap-1.5"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>End Call & Log</span>
              </Button>
            </div>
          )}

          {/* Quick Communication Actions */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {lead.phone && !isCalling && (
              <Button
                size="sm"
                onClick={handleStartCall}
                className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Start Call</span>
              </Button>
            )}

            {lead.phone && (
              <div className="inline-flex rounded-lg shadow-2xs">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors h-8 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="px-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-r-lg border-l border-emerald-500/40 cursor-pointer h-8 flex items-center">
                    <ChevronDown className="w-3 h-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 text-xs">
                    <DropdownMenuItem
                      onClick={() => setIsWhatsAppModalOpen(true)}
                      className="cursor-pointer text-xs font-bold text-emerald-600 dark:text-emerald-400 gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Open Template Messenger...</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Quick Pitch Templates
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        handleSendWhatsAppTemplate(
                          `Hello ${lead.name || "Student"}! Thank you for inquiring about DreamDesk admissions. Here is the requested fee structure & course details for your branch. Let us know if you'd like to book an in-person counseling session!`
                        )
                      }
                      className="cursor-pointer text-xs"
                    >
                      📄 Fee Structure & Brochure
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        handleSendWhatsAppTemplate(
                          `Hi ${lead.name || "Student"}, our counseling team would like to invite you and your parents for an on-campus interaction and lab tour this week. What day works best for you?`
                        )
                      }
                      className="cursor-pointer text-xs"
                    >
                      🏛️ Campus Visit Invitation
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        handleSendWhatsAppTemplate(
                          `Dear ${lead.name || "Student"}, please keep your 10th & 12th mark sheets and ID proof ready for your upcoming admission counseling session!`
                        )
                      }
                      className="cursor-pointer text-xs"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-background hover:bg-accent transition-colors h-8"
              >
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Email</span>
              </a>
            )}
          </div>
        </div>

        {/* Multi-Tab Navigation */}
        <div className="p-3.5 sm:p-6 flex-1 space-y-4 pb-28 sm:pb-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-4 h-9">
              <TabsTrigger value="overview" className="text-xs">
                Overview
              </TabsTrigger>
              <TabsTrigger value="fields" className="text-xs">
                Fields ({dynamicAttributes.length})
              </TabsTrigger>
              <TabsTrigger value="calls" className="text-xs">
                Call Logger
              </TabsTrigger>
              <TabsTrigger value="timeline" className="text-xs">
                Timeline
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="space-y-4 pt-3 m-0">
              {/* Disposition & Counselor Logging Card */}
              <div className="bg-card border rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Counselor & Call Disposition</span>
                  {lead.campaign_name && (
                    <span className="text-[10px] text-primary lowercase tracking-normal">
                      campaign: {lead.campaign_name}
                    </span>
                  )}
                </div>

                {/* Counselor Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Assigned Counselor</span>
                  </label>
                  <Select
                    value={lead.assigned_to || "unassigned"}
                    onValueChange={(val) => {
                      if (val !== null) onAssignLead(lead.id, val === "unassigned" ? "" : val);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned" className="text-xs">
                        Unassigned
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
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <span>Admission Stage</span>
                  </label>
                  <Select
                    value={lead.status}
                    onValueChange={(val) => {
                      if (val) onUpdateLeadStatus(lead.id, val);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
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

                {/* Call Disposition Dropdown */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <PhoneCall className="w-3.5 h-3.5 text-primary" />
                      <span>Current Call Outcome (Disposition)</span>
                    </span>
                    {selectedDispObj && (
                      <span className="text-[10px] font-mono font-semibold" style={{ color: selectedDispObj.color }}>
                        Score: {selectedDispObj.score > 0 ? `+${selectedDispObj.score}` : selectedDispObj.score}
                      </span>
                    )}
                  </label>

                  <Select
                    value={selectedDispId || "none"}
                    onValueChange={(val) => {
                      if (val) setSelectedDispId(val === "none" ? "" : val);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Select call disposition..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none" className="text-xs text-muted-foreground">
                        None / Unassigned
                      </SelectItem>

                      {positiveDisps.length > 0 && (
                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-emerald-600 tracking-wider">
                          Positive Outcomes
                        </div>
                      )}
                      {positiveDisps.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: d.color }} />
                          <span>{d.name}</span>
                        </SelectItem>
                      ))}

                      {neutralDisps.length > 0 && (
                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-amber-600 tracking-wider mt-1">
                          Neutral / Callback
                        </div>
                      )}
                      {neutralDisps.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: d.color }} />
                          <span>{d.name}</span>
                        </SelectItem>
                      ))}

                      {unreachableDisps.length > 0 && (
                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-orange-600 tracking-wider mt-1">
                          Unreachable
                        </div>
                      )}
                      {unreachableDisps.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: d.color }} />
                          <span>{d.name}</span>
                        </SelectItem>
                      ))}

                      {negativeDisps.length > 0 && (
                        <div className="px-2 py-1 text-[10px] font-bold uppercase text-rose-600 tracking-wider mt-1">
                          Negative / Disqualified
                        </div>
                      )}
                      {negativeDisps.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: d.color }} />
                          <span>{d.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Two-Level Sub-Disposition Dropdown */}
                {selectedDispObj?.sub_dispositions && selectedDispObj.sub_dispositions.length > 0 && (
                  <div className="space-y-1.5 pt-0.5 animate-in fade-in-50 duration-200">
                    <label className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-primary">
                        <CornerDownRight className="w-3.5 h-3.5" />
                        <span>Specific Reason / Sub-Outcome</span>
                      </span>
                    </label>
                    <Select
                      value={selectedSubDispId || "none"}
                      onValueChange={(val) => {
                        if (val) setSelectedSubDispId(val === "none" ? "" : val);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-medium bg-muted/30 border-primary/30">
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
                  <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5 mt-2">
                    <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span>Counselor Pitch & Objection Rebuttal Guide</span>
                    </div>

                    {selectedSubDispId === "sub_ni_budget" ? (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        💡 <strong>Talking Point:</strong> Highlight our <strong>0% interest monthly installment plan</strong> and the <strong>Merit Scholarship Test (up to 40% fee waiver)</strong>. Offer to send the financial aid brochure via WhatsApp.
                      </p>
                    ) : selectedSubDispId === "sub_ni_distance" ? (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        🚌 <strong>Talking Point:</strong> Emphasize our <strong>18 AC bus routes</strong>, 24/7 guarded campus security, and separate on-campus hostels with meal plans.
                      </p>
                    ) : selectedSubDispId === "sub_fu_comparing" ? (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        🏆 <strong>Talking Point:</strong> Highlight our <strong>94.2% placement rate</strong>, 120+ recruitment partners, NAAC Grade-A+ accreditation, and small 1:15 mentor ratio.
                      </p>
                    ) : selectedSubDispId === "sub_fu_board_results" ? (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        📋 <strong>Talking Point:</strong> Recommend placing a <strong>Provisional Seat Block</strong> today to lock in current tuition rates and scholarship brackets while awaiting final board results.
                      </p>
                    ) : selectedDispId === "disp_couns_booked" ? (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        🎯 <strong>Talking Point:</strong> Confirm parent availability, explain that our Senior Dean will personally evaluate career roadmaps, and send a calendar invite immediately.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        ✨ <strong>Talking Point:</strong> Ask open-ended questions about their career aspirations in <strong>{String(lead.raw_attributes?.stream || "their chosen stream")}</strong> and offer to send our comprehensive curriculum overview.
                      </p>
                    )}
                  </div>
                )}

                {/* Conditional Callback Date Picker */}
                {requiresCallback && (
                  <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20 space-y-2 mt-2">
                    <label className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Follow-up Callback Date & Time (Required)</span>
                    </label>
                    <Input
                      type="datetime-local"
                      value={callbackDate}
                      onChange={(e) => setCallbackDate(e.target.value)}
                      className="h-8 text-xs font-mono bg-background"
                    />

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <button
                        type="button"
                        onClick={() => setCallbackInHours(2)}
                        className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 font-medium"
                      >
                        +2 Hours
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallbackTomorrow(11)}
                        className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 font-medium"
                      >
                        Tomorrow 11 AM
                      </button>
                      <button
                        type="button"
                        onClick={() => setCallbackTomorrow(16)}
                        className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 font-medium"
                      >
                        Tomorrow 4 PM
                      </button>
                      <button
                        type="button"
                        onClick={setCallbackNextMonday}
                        className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 font-medium"
                      >
                        Next Monday
                      </button>
                    </div>
                  </div>
                )}

                {/* Call Notes input */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-medium text-foreground">
                    Call Note / Discussion Summary
                  </label>
                  <Textarea
                    placeholder="Enter counselor notes regarding student discussion, parent feedback, or fee inquiries..."
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                </div>

                {/* Save Disposition Button */}
                <div className="flex items-center justify-between pt-1">
                  {successToast ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Disposition saved!</span>
                    </span>
                  ) : <span />}

                  <Button
                    size="sm"
                    onClick={handleSaveDisposition}
                    disabled={savingDisp}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingDisp ? "Saving..." : "Save Disposition"}</span>
                  </Button>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Contacts
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <div className="p-3 rounded-xl border bg-card text-xs flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Mobile Phone</div>
                      <div className="font-mono font-semibold">{lead.phone || "None"}</div>
                    </div>
                    {lead.phone && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigator.clipboard.writeText(lead.phone!)}
                        className="h-7 text-[11px]"
                      >
                        Copy
                      </Button>
                    )}
                  </div>

                  <div className="p-3 rounded-xl border bg-card text-xs flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Email</div>
                      <div className="font-semibold">{lead.email || "None"}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes History */}
              {lead.notes && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Logged Counselor Notes
                  </div>
                  <div className="p-3 rounded-xl border bg-muted/20 text-xs font-mono whitespace-pre-wrap text-foreground">
                    {lead.notes}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: DYNAMIC FIELDS */}
            <TabsContent value="fields" className="space-y-3 pt-3 m-0">
              <div className="border rounded-xl divide-y bg-card text-xs overflow-hidden">
                {dynamicAttributes.map(([key, val]) => {
                  const meta = schemaMeta.find((m) => m.key_name === key);
                  const label = meta ? meta.display_label : key.replace(/_/g, " ").toUpperCase();

                  return (
                    <div key={key} className="p-3 flex items-center justify-between">
                      <span className="text-muted-foreground font-medium text-[11px]">
                        {label}
                      </span>
                      <span className="font-semibold text-foreground text-right truncate max-w-[200px]">
                        {String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* TAB 3: CALL LOGGER */}
            <TabsContent value="calls" className="space-y-4 pt-3 m-0">
              <div className="bg-card border rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-primary" />
                  <span>Log Telecaller Activity</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Call Disposition</label>
                  <Select
                    value={selectedDispId || "none"}
                    onValueChange={(val) => {
                      if (val) setSelectedDispId(val === "none" ? "" : val);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue placeholder="Select outcome..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none" className="text-xs">None</SelectItem>
                      {campaignDispositions.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-xs">
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: d.color }} />
                          <span>{d.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub-Disposition in Call Logger */}
                {selectedDispObj?.sub_dispositions && selectedDispObj.sub_dispositions.length > 0 && (
                  <div className="space-y-1.5 pt-0.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5 text-primary">
                      <CornerDownRight className="w-3.5 h-3.5" />
                      <span>Specific Reason / Sub-Outcome</span>
                    </label>
                    <Select
                      value={selectedSubDispId || "none"}
                      onValueChange={(val) => {
                        if (val) setSelectedSubDispId(val === "none" ? "" : val);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-medium bg-muted/30 border-primary/30">
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

                {requiresCallback && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-amber-700">Scheduled Callback Time</label>
                    <Input
                      type="datetime-local"
                      value={callbackDate}
                      onChange={(e) => setCallbackDate(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Counselor Call Note</label>
                  <Textarea
                    placeholder="Enter discussion notes with student..."
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    className="text-xs min-h-[70px]"
                  />
                </div>

                <Button
                  size="sm"
                  onClick={handleSaveDisposition}
                  disabled={savingDisp}
                  className="w-full h-8 text-xs font-semibold gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingDisp ? "Saving..." : "Log Call & Save"}</span>
                </Button>
              </div>

              {lead.notes && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Call History
                  </div>
                  <div className="p-3 rounded-xl border bg-card text-xs font-mono whitespace-pre-wrap">
                    {lead.notes}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 4: AUDIT TIMELINE */}
            <TabsContent value="timeline" className="space-y-3 pt-3 m-0">
              <div className="space-y-3 pl-2 border-l-2 border-primary/20 text-xs">
                <div className="relative pl-4 space-y-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-primary absolute -left-[5px] top-1" />
                  <div className="font-semibold text-foreground">Lead Created</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(lead.created_at).toLocaleString()}
                  </div>
                </div>

                {lead.campaign_name && (
                  <div className="relative pl-4 space-y-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 absolute -left-[5px] top-1" />
                    <div className="font-semibold text-foreground">
                      Campaign: {lead.campaign_name}
                    </div>
                  </div>
                )}

                {lead.assigned_at && (
                  <div className="relative pl-4 space-y-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -left-[5px] top-1" />
                    <div className="font-semibold text-foreground">
                      Assigned to {lead.assigned_user_name || "Counselor"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(lead.assigned_at).toLocaleString()}
                    </div>
                  </div>
                )}

                {lead.disposition_name && (
                  <div className="relative pl-4 space-y-1">
                    <div
                      className="w-2.5 h-2.5 rounded-full absolute -left-[5px] top-1"
                      style={{ backgroundColor: lead.disposition_color || "#3b82f6" }}
                    />
                    <div className="font-semibold text-foreground">
                      Disposition: {lead.disposition_name}
                    </div>
                  </div>
                )}

                <div className="relative pl-4 space-y-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute -left-[5px] top-1" />
                  <div className="font-semibold text-foreground">
                    Current Stage: {lead.status}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Last modified on {new Date(lead.updated_at).toLocaleString()}
                  </div>
                </div>
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
              className="flex-1 h-10 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
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
              className="flex-1 h-10 text-xs font-bold gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp</span>
            </Button>
          ) : null}

          <Button
            size="sm"
            onClick={handleSaveDisposition}
            disabled={savingDisp || (!selectedDispId && !callNotes.trim())}
            className="flex-1 h-10 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savingDisp ? "Saving..." : "Save Log"}</span>
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
