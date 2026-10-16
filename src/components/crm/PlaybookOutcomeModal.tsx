"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Disposition, Campaign } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Flame,
  CheckCircle2,
  Clock,
  PhoneCall,
  XCircle,
  HelpCircle,
  Plus,
  X,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";

export interface PlaybookOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  disposition: Disposition | null;
  campaigns: Campaign[];
  onSaved: () => void;
}

const COMMON_EMOJIS = [
  "🎓", "🏛️", "🔥", "👨‍👩‍👧", "💰", "📝", "📞", "📳", "📵", "⏳", 
  "🏫", "❌", "🚫", "⭐", "🤝", "🚌", "📋", "💼", "🎯", "💬"
];

const INTENT_LEVELS = [
  {
    id: "enrolled",
    label: "Enrolled / Confirmed",
    emoji: "🎓",
    badge: "Maximum Intent",
    score: 100,
    color: "#10b981",
    description: "Student completed admission form or paid registration fee.",
    targetStage: "Admitted",
  },
  {
    id: "hot",
    label: "High Intent",
    emoji: "🔥",
    badge: "Hot Candidate",
    score: 75,
    color: "#059669",
    description: "Ready to apply, wants campus tour, or booked counseling.",
    targetStage: "Interested",
  },
  {
    id: "warm",
    label: "Warm / Evaluating",
    emoji: "🌤️",
    badge: "Considering Options",
    score: 35,
    color: "#f59e0b",
    description: "Discussing with parents, checking fees, or awaiting marks.",
    targetStage: "Follow-up",
  },
  {
    id: "cold",
    label: "Low Intent / Retry",
    emoji: "❄️",
    badge: "Unreached / Cold",
    score: 5,
    color: "#64748b",
    description: "Unanswered call attempt or generic inquiry.",
    targetStage: "Contacted",
  },
  {
    id: "closed",
    label: "Closed / Dropped",
    emoji: "🛑",
    badge: "Disqualified",
    score: -30,
    color: "#ef4444",
    description: "Joined another college, ineligible, or requested DND.",
    targetStage: "Not Interested",
  },
];

const TRAYS = [
  {
    id: "positive",
    label: "Progressing Forward",
    icon: Flame,
    color: "emerald",
    subtitle: "High intent students moving toward admission",
  },
  {
    id: "neutral",
    label: "Needs Follow-up",
    icon: Clock,
    color: "amber",
    subtitle: "Active students needing another conversation",
  },
  {
    id: "unreachable",
    label: "Couldn't Connect",
    icon: PhoneCall,
    color: "blue",
    subtitle: "1-tap retry logging (Ringing, Switched Off, Busy)",
  },
  {
    id: "negative",
    label: "Closed / Dropped",
    icon: XCircle,
    color: "rose",
    subtitle: "Ineligible, joined elsewhere, or not interested",
  },
];

export function PlaybookOutcomeModal({
  isOpen,
  onClose,
  disposition,
  campaigns,
  onSaved,
}: PlaybookOutcomeModalProps) {
  // Form state
  const [name, setName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🔥");
  const [tray, setTray] = useState<"positive" | "neutral" | "unreachable" | "negative">("positive");
  const [intentId, setIntentId] = useState<string>("hot");
  const [requiresCallback, setRequiresCallback] = useState(true);
  const [cooldownHours, setCooldownHours] = useState<number>(0);
  const [linkedCampaignIds, setLinkedCampaignIds] = useState<string[]>([]);
  const [reasonChips, setReasonChips] = useState<string[]>([]);
  const [newChipInput, setNewChipInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when disposition changes or modal opens
  useEffect(() => {
    if (disposition) {
      // Extract emoji if present at beginning of name
      const emojiMatch = disposition.name.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u);
      if (emojiMatch) {
        setSelectedEmoji(emojiMatch[1]);
        setName(disposition.name.replace(emojiMatch[0], "").trim());
      } else {
        setName(disposition.name);
        // Default emoji based on category
        if (disposition.category === "positive") setSelectedEmoji(disposition.score >= 90 ? "🎓" : "🔥");
        else if (disposition.category === "unreachable") setSelectedEmoji("📳");
        else if (disposition.category === "negative") setSelectedEmoji("🛑");
        else setSelectedEmoji("⏳");
      }

      setTray((disposition.category as any) || "positive");

      // Match closest intent level
      const score = disposition.score ?? 50;
      if (score >= 90) setIntentId("enrolled");
      else if (score >= 60) setIntentId("hot");
      else if (score >= 20) setIntentId("warm");
      else if (score >= 0) setIntentId("cold");
      else setIntentId("closed");

      setRequiresCallback(Boolean(disposition.requires_callback));
      setLinkedCampaignIds(disposition.linked_campaign_ids || campaigns.map((c) => c.id));

      // Load sub-dispositions as chips
      if (disposition.sub_dispositions && disposition.sub_dispositions.length > 0) {
        setReasonChips(disposition.sub_dispositions.map((s) => s.name));
      } else {
        setReasonChips([]);
      }
    } else {
      // New outcome defaults
      setName("");
      setSelectedEmoji("🔥");
      setTray("positive");
      setIntentId("hot");
      setRequiresCallback(true);
      setCooldownHours(0);
      setLinkedCampaignIds(campaigns.map((c) => c.id));
      setReasonChips(["Fee Details Shared", "Campus Visit Requested"]);
      setError(null);
    }
  }, [disposition, campaigns, isOpen]);

  const activeIntent = useMemo(() => {
    return INTENT_LEVELS.find((i) => i.id === intentId) || INTENT_LEVELS[1];
  }, [intentId]);

  const handleAddChip = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newChipInput.trim();
    if (trimmed && !reasonChips.includes(trimmed)) {
      setReasonChips((prev) => [...prev, trimmed]);
      setNewChipInput("");
    }
  };

  const handleRemoveChip = (chipToRemove: string) => {
    setReasonChips((prev) => prev.filter((c) => c !== chipToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please give this outcome a clear title (e.g., 'Discussing with Parents').");
      return;
    }

    setLoading(true);
    setError(null);

    const fullName = `${selectedEmoji} ${name.trim()}`;
    const autoCode = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30);

    const payload = {
      name: fullName,
      code: autoCode,
      category: tray,
      color: activeIntent.color,
      score: activeIntent.score,
      requires_callback: requiresCallback ? 1 : 0,
      is_active: 1,
      linked_campaign_ids: linkedCampaignIds,
    };

    try {
      let savedDispId = disposition?.id;

      if (disposition) {
        // Update existing disposition
        const res = await fetch("/api/dispositions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: disposition.id,
            ...payload,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update outcome");
        }
      } else {
        // Create new disposition
        const res = await fetch("/api/dispositions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create outcome");
        }
        const created = await res.json();
        savedDispId = created.id;
      }

      // Sync sub-dispositions (chips) if created
      if (savedDispId && reasonChips.length > 0) {
        // Delete previous sub-dispositions if editing
        if (disposition?.sub_dispositions) {
          for (const oldSub of disposition.sub_dispositions) {
            await fetch(`/api/dispositions/sub?id=${encodeURIComponent(oldSub.id)}`, {
              method: "DELETE",
            }).catch(() => {});
          }
        }

        // Insert fresh chips
        for (const chip of reasonChips) {
          await fetch("/api/dispositions/sub", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              disposition_id: savedDispId,
              name: chip,
              score: activeIntent.score,
            }),
          }).catch(() => {});
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save outcome");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden sm:max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 bg-muted/30 border-b border-border/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Smart Outcome Recipe Builder</span>
            </div>
            <Badge variant="outline" className="text-[11px] font-mono">
              {disposition ? "Editing Existing Recipe" : "New Outcome Recipe"}
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground mt-1">
            {disposition ? `Edit "${name || disposition.name}"` : "Design a Call Outcome & Action Recipe"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Define what the student said, how it impacts their intent score, and what the caller or system should do next.
          </DialogDescription>
        </DialogHeader>

        {/* Content Body: Left Form + Right Live Preview */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-border/70">
          {/* LEFT: 4-Step Intuitive Configuration Form (7 Cols) */}
          <form onSubmit={handleSave} className="md:col-span-7 p-5 space-y-5">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: What did the student say? */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
                  1
                </span>
                <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  What happened on the call?
                </label>
              </div>

              {/* Title Input + Emoji Picker */}
              <div className="flex items-center gap-2">
                {/* Emoji Selector */}
                <div className="relative group shrink-0">
                  <button
                    type="button"
                    className="w-10 h-10 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-center text-lg hover:border-primary transition-colors cursor-pointer"
                    title="Choose an icon"
                  >
                    {selectedEmoji}
                  </button>
                  <div className="absolute top-11 left-0 z-50 hidden group-hover:grid grid-cols-5 gap-1.5 p-2 bg-popover border border-border rounded-xl shadow-xl w-48">
                    {COMMON_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setSelectedEmoji(em)}
                        className="w-8 h-8 rounded-lg hover:bg-muted text-base flex items-center justify-center cursor-pointer transition-colors"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Discussing with Parents, Campus Tour Booked..."
                    className="h-10 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Tray / Group Selection */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Which reaction tray should this belong to?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {TRAYS.map((t) => {
                    const isSelected = tray === t.id;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTray(t.id as any);
                          // Suggest appropriate intent default based on tray
                          if (t.id === "positive" && intentId === "closed") setIntentId("hot");
                          if (t.id === "negative") setIntentId("closed");
                          if (t.id === "unreachable") setIntentId("cold");
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          isSelected
                            ? "bg-primary/5 border-primary ring-1 ring-primary/40 font-semibold"
                            : "bg-card border-border/70 hover:bg-muted/40"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            t.color === "emerald"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : t.color === "amber"
                              ? "bg-amber-500/10 text-amber-600"
                              : t.color === "blue"
                              ? "bg-blue-500/10 text-blue-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-foreground truncate">{t.label}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{t.subtitle}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* STEP 2: Student Temperature (Intent Thermometer) */}
            <div className="space-y-2.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Student Temperature (Intent Level)
                  </label>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Score: <strong className="text-foreground">{activeIntent.score > 0 ? `+${activeIntent.score}` : activeIntent.score} pts</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {INTENT_LEVELS.map((lvl) => {
                  const isSelected = intentId === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setIntentId(lvl.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                        isSelected
                          ? "bg-accent/40 border-primary ring-2 ring-primary/30"
                          : "bg-card border-border/70 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base">{lvl.emoji}</span>
                        <span className="text-[10px] font-mono font-bold" style={{ color: lvl.color }}>
                          {lvl.score > 0 ? `+${lvl.score}` : lvl.score} pts
                        </span>
                      </div>
                      <div className="text-xs font-bold text-foreground leading-snug">{lvl.label}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{lvl.badge}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground leading-normal">
                💡 <span className="font-semibold text-foreground">Automatic Automation:</span> Selecting <strong>{activeIntent.label}</strong> will automatically award <strong className="text-foreground">{activeIntent.score} intent points</strong> and advance the student to the <strong className="text-foreground">"{activeIntent.targetStage}"</strong> pipeline stage.
              </p>
            </div>

            {/* STEP 3: Automated Next Actions */}
            <div className="space-y-2.5 pt-2 border-t border-border/60">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
                  3
                </span>
                <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  What should happen next?
                </label>
              </div>

              <div className="space-y-2">
                {/* Require Callback Date & Time */}
                <label className="flex items-start gap-3 p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requiresCallback}
                    onChange={(e) => setRequiresCallback(e.target.checked)}
                    className="mt-0.5 rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  />
                  <div className="space-y-0.5 text-xs">
                    <div className="font-bold text-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Require Follow-up Date & Time</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      When the counselor logs this outcome, automatically prompt them with quick presets (e.g. +2 Hours, Tomorrow 11 AM).
                    </p>
                  </div>
                </label>

                {/* Cooldown Hours */}
                {tray === "unreachable" && (
                  <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2 text-xs">
                    <div className="font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>Smart Cooldown Rest Period</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {[
                        { hours: 2, label: "2 Hours" },
                        { hours: 4, label: "4 Hours (Recommended)" },
                        { hours: 24, label: "Tomorrow (24h)" },
                      ].map((cd) => (
                        <button
                          key={cd.hours}
                          type="button"
                          onClick={() => setCooldownHours(cd.hours)}
                          className={`px-2.5 py-1 text-xs rounded-lg border font-medium cursor-pointer transition-colors ${
                            cooldownHours === cd.hours
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border/80 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {cd.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 4: Quick Reason Chips (Sub-dispositions) */}
            <div className="space-y-2.5 pt-2 border-t border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
                    4
                  </span>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Fast Sub-Reason Chips (Optional)
                  </label>
                </div>
                <span className="text-[10px] text-muted-foreground">{reasonChips.length} Chips</span>
              </div>

              <div className="flex gap-2">
                <Input
                  value={newChipInput}
                  onChange={(e) => setNewChipInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddChip();
                    }
                  }}
                  placeholder="Type a reason (e.g. 'Fee too high', 'Hostel needed') & press Enter"
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddChip()}
                  className="h-8 text-xs font-semibold gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Chip</span>
                </Button>
              </div>

              {reasonChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {reasonChips.map((chip) => (
                    <Badge
                      key={chip}
                      variant="secondary"
                      className="text-xs py-1 px-2.5 gap-1.5 font-normal bg-muted hover:bg-muted/80 text-foreground"
                    >
                      <span>{chip}</span>
                      <X
                        className="w-3 h-3 cursor-pointer text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveChip(chip)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </form>

          {/* RIGHT: Live Interactive Caller Preview (5 Cols) */}
          <div className="md:col-span-5 p-5 bg-muted/20 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <PhoneCall className="w-3.5 h-3.5 text-primary" />
                  <span>Live Caller Preview</span>
                </span>
                <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/5 border-emerald-500/20">
                  Instant Sync
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                This is how the button and workflow will appear inside the telecaller's drawer during a student call:
              </p>

              {/* MOCK CALLER BUTTON PREVIEW */}
              <div className="p-4 rounded-2xl border-2 border-primary/30 bg-card shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{selectedEmoji}</span>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {name.trim() || "Outcome Label"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {tray === "positive"
                          ? "High Intent Admission Step"
                          : tray === "neutral"
                          ? "Follow-up required"
                          : tray === "unreachable"
                          ? "1-Tap fast retry"
                          : "Closed lead"}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono font-bold shrink-0"
                    style={{ borderColor: activeIntent.color, color: activeIntent.color }}
                  >
                    {activeIntent.score > 0 ? `+${activeIntent.score}` : activeIntent.score} pts
                  </Badge>
                </div>

                {/* Sub-reasons Mock Chips */}
                {reasonChips.length > 0 && (
                  <div className="pt-2 border-t border-border/60 space-y-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      Available Sub-Reasons:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {reasonChips.slice(0, 4).map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/80 font-medium"
                        >
                          {c}
                        </span>
                      ))}
                      {reasonChips.length > 4 && (
                        <span className="text-[10px] text-muted-foreground self-center">
                          +{reasonChips.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Action summary pill */}
                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-[11px] space-y-1">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-primary" />
                    <span>Automated Reaction:</span>
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5 pl-1">
                    <li>Updates lead stage to <strong>{activeIntent.targetStage}</strong></li>
                    <li>Ranks lead with <strong>{activeIntent.label}</strong> status</li>
                    {requiresCallback && <li>Prompts telecaller for <strong>Callback Time</strong></li>}
                    {tray === "unreachable" && cooldownHours > 0 && (
                      <li>Puts lead in <strong>{cooldownHours}h cooldown</strong></li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Save / Cancel Action Bar */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={loading}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={loading || !name.trim()}
                className="h-9 px-4 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{loading ? "Saving Recipe..." : "Save Outcome Recipe"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
