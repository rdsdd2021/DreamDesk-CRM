"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  Clock,
  PhoneCall,
  XCircle,
  Plus,
  X,
  Check,
  ShieldCheck,
  ChevronDown,
  Info,
} from "lucide-react";

export interface PlaybookOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  disposition: Disposition | null;
  campaigns: Campaign[];
  onSaved: () => void;
}

const COMMON_EMOJIS = [
  "🔥", "🎓", "⏳", "📵", "🛑", "👨‍👩‍👧", "💰", "📝", "📞", "🏛️",
  "🏫", "❌", "🚫", "⭐", "🤝", "🚌", "📋", "💼", "🎯", "💬",
  "⚡", "❓", "📌", "🥇"
];

const QUICK_PRESETS = [
  {
    name: "Interested in Admission",
    emoji: "🔥",
    tray: "positive" as const,
    intent: "hot",
    callback: true,
    chips: ["Campus Visit", "Fee Structure", "Online Portal Help"],
  },
  {
    name: "Discussing with Parents",
    emoji: "👨‍👩‍👧",
    tray: "neutral" as const,
    intent: "warm",
    callback: true,
    chips: ["Evening Callback", "Father Reviewing", "Fee Discussion"],
  },
  {
    name: "Confirmed / Token Paid",
    emoji: "🎓",
    tray: "positive" as const,
    intent: "enrolled",
    callback: false,
    chips: ["Seat Locked", "Documents Verified", "Token Fee Paid"],
  },
  {
    name: "Ringing - No Response",
    emoji: "📳",
    tray: "unreachable" as const,
    intent: "cold",
    callback: true,
    chips: ["Attempt 1", "Attempt 2", "Evening Retry"],
  },
  {
    name: "Not Interested / Opt-Out",
    emoji: "🚫",
    tray: "negative" as const,
    intent: "closed",
    callback: false,
    chips: ["Location Too Far", "Joined Other College", "High Fees"],
  },
];

const SUGGESTED_CHIPS = [
  "Fee Details",
  "Campus Visit",
  "Parent Consultation",
  "Hostel Query",
  "Loan / EMI",
  "Awaiting Results",
  "Location Far",
];

const TRAYS = [
  {
    id: "positive" as const,
    label: "Progressing",
    subtitle: "High intent & applied",
    icon: Flame,
    color: "emerald",
    activeClass: "bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/40",
  },
  {
    id: "neutral" as const,
    label: "Follow-up",
    subtitle: "Needs another call",
    icon: Clock,
    color: "amber",
    activeClass: "bg-amber-500/10 border-amber-500 text-amber-800 dark:text-amber-300 ring-1 ring-amber-500/40",
  },
  {
    id: "unreachable" as const,
    label: "Unreachable",
    subtitle: "No answer / busy",
    icon: PhoneCall,
    color: "blue",
    activeClass: "bg-blue-500/10 border-blue-500 text-blue-800 dark:text-blue-300 ring-1 ring-blue-500/40",
  },
  {
    id: "negative" as const,
    label: "Closed",
    subtitle: "Not interested / lost",
    icon: XCircle,
    color: "rose",
    activeClass: "bg-rose-500/10 border-rose-500 text-rose-800 dark:text-rose-300 ring-1 ring-rose-500/40",
  },
];

const INTENT_LEVELS = [
  {
    id: "enrolled",
    label: "Admitted",
    emoji: "🎓",
    score: 100,
    color: "#10b981",
    targetStage: "Admitted",
  },
  {
    id: "hot",
    label: "High Intent",
    emoji: "🔥",
    score: 75,
    color: "#059669",
    targetStage: "Interested",
  },
  {
    id: "warm",
    label: "Warm",
    emoji: "🌤️",
    score: 35,
    color: "#f59e0b",
    targetStage: "Follow-up",
  },
  {
    id: "cold",
    label: "Cold / Retry",
    emoji: "❄️",
    score: 5,
    color: "#64748b",
    targetStage: "Contacted",
  },
  {
    id: "closed",
    label: "Dropped",
    emoji: "🛑",
    score: -30,
    color: "#ef4444",
    targetStage: "Not Interested",
  },
];

export function PlaybookOutcomeModal({
  isOpen,
  onClose,
  disposition,
  campaigns,
  onSaved,
}: PlaybookOutcomeModalProps) {
  // Form State
  const [name, setName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🔥");
  const [tray, setTray] = useState<"positive" | "neutral" | "unreachable" | "negative">("positive");
  const [intentId, setIntentId] = useState<string>("hot");
  const [requiresCallback, setRequiresCallback] = useState(true);
  const [cooldownHours, setCooldownHours] = useState<number>(0);
  const [reasonChips, setReasonChips] = useState<string[]>([]);
  const [newChipInput, setNewChipInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Initialize or reset form state
  useEffect(() => {
    if (disposition) {
      // Extract emoji if present at beginning of name
      const emojiMatch = disposition.name.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u);
      if (emojiMatch) {
        setSelectedEmoji(emojiMatch[1]);
        setName(disposition.name.replace(emojiMatch[0], "").trim());
      } else {
        setName(disposition.name);
        if (disposition.category === "positive") setSelectedEmoji(disposition.score >= 90 ? "🎓" : "🔥");
        else if (disposition.category === "unreachable") setSelectedEmoji("📳");
        else if (disposition.category === "negative") setSelectedEmoji("🛑");
        else setSelectedEmoji("⏳");
      }

      setTray((disposition.category as any) || "positive");

      const score = disposition.score ?? 50;
      if (score >= 90) setIntentId("enrolled");
      else if (score >= 60) setIntentId("hot");
      else if (score >= 20) setIntentId("warm");
      else if (score >= 0) setIntentId("cold");
      else setIntentId("closed");

      setRequiresCallback(Boolean(disposition.requires_callback));

      if (disposition.sub_dispositions && disposition.sub_dispositions.length > 0) {
        setReasonChips(disposition.sub_dispositions.map((s) => s.name));
      } else {
        setReasonChips([]);
      }
      setError(null);
    } else {
      setName("");
      setSelectedEmoji("🔥");
      setTray("positive");
      setIntentId("hot");
      setRequiresCallback(true);
      setCooldownHours(0);
      setReasonChips(["Campus Visit", "Fee Details"]);
      setError(null);
    }
    setShowEmojiPicker(false);
  }, [disposition, isOpen]);

  const activeIntent = useMemo(() => {
    return INTENT_LEVELS.find((i) => i.id === intentId) || INTENT_LEVELS[1];
  }, [intentId]);

  const handleSelectTray = (newTray: "positive" | "neutral" | "unreachable" | "negative") => {
    setTray(newTray);
    // Smart defaults so user rarely has to touch secondary controls
    if (newTray === "positive") {
      setIntentId(intentId === "enrolled" ? "enrolled" : "hot");
      setRequiresCallback(true);
    } else if (newTray === "neutral") {
      setIntentId("warm");
      setRequiresCallback(true);
    } else if (newTray === "unreachable") {
      setIntentId("cold");
      setRequiresCallback(true);
      if (cooldownHours === 0) setCooldownHours(4);
    } else if (newTray === "negative") {
      setIntentId("closed");
      setRequiresCallback(false);
    }
  };

  const handleApplyPreset = (p: typeof QUICK_PRESETS[0]) => {
    setName(p.name);
    setSelectedEmoji(p.emoji);
    setTray(p.tray);
    setIntentId(p.intent);
    setRequiresCallback(p.callback);
    setReasonChips(p.chips);
  };

  const handleAddChip = (chipText?: string) => {
    const text = (chipText || newChipInput).trim();
    if (text && !reasonChips.includes(text)) {
      setReasonChips((prev) => [...prev, text]);
      if (!chipText) setNewChipInput("");
    }
  };

  const handleRemoveChip = (chipToRemove: string) => {
    setReasonChips((prev) => prev.filter((c) => c !== chipToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide an outcome name.");
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
      linked_campaign_ids: campaigns.map((c) => c.id),
    };

    try {
      let savedDispId = disposition?.id;

      if (disposition) {
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

      // Sync sub-disposition tags
      if (savedDispId) {
        if (disposition?.sub_dispositions && disposition.sub_dispositions.length > 0) {
          for (const oldSub of disposition.sub_dispositions) {
            await fetch(`/api/dispositions/sub?id=${encodeURIComponent(oldSub.id)}`, {
              method: "DELETE",
            }).catch(() => {});
          }
        }

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
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border border-border/80">
        {/* Header */}
        <DialogHeader className="px-6 py-4 bg-muted/40 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <Sparkles className="w-4 h-4" />
              <span>Admissions Playbook</span>
            </div>
            <Badge variant="outline" className="text-[11px] font-medium bg-background">
              {disposition ? "Editing Outcome" : "New Outcome"}
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground mt-0.5">
            {disposition ? `Edit "${name || disposition.name}"` : "Create Call Outcome"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure what counselors see and record after speaking with a student.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Starter Templates (Only when creating new outcome) */}
          {!disposition && !name && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <span className="text-[11px] font-semibold text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Fill from Popular Presets:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-background border border-border/80 hover:border-primary hover:bg-muted font-medium cursor-pointer transition-all flex items-center gap-1.5 text-foreground shadow-2xs"
                  >
                    <span>{p.emoji}</span>
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1. Outcome Name & Icon */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Outcome Name</label>
            <div className="flex items-center gap-2 relative">
              {/* Emoji Picker Button */}
              <div className="relative shrink-0" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className="w-10 h-10 rounded-xl bg-muted/60 border border-border/80 flex items-center justify-center text-xl hover:border-primary hover:bg-muted cursor-pointer transition-colors"
                  title="Choose icon"
                >
                  {selectedEmoji}
                </button>

                {/* Clickable Popover Grid */}
                {showEmojiPicker && (
                  <div className="absolute top-12 left-0 z-50 p-2.5 bg-popover border border-border rounded-xl shadow-xl w-60 grid grid-cols-6 gap-1.5 animate-in fade-in-50 zoom-in-95">
                    {COMMON_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => {
                          setSelectedEmoji(em);
                          setShowEmojiPicker(false);
                        }}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center hover:bg-muted cursor-pointer transition-colors ${
                          selectedEmoji === em ? "bg-primary/10 ring-1 ring-primary" : ""
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title Input */}
              <div className="flex-1">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Discussing with Parents, Campus Tour Booked..."
                  className="h-10 text-xs font-medium"
                  autoFocus={!disposition}
                />
              </div>
            </div>
          </div>

          {/* 2. Reaction Tray / Category */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Category (Where counselors see this)
              </label>
              <span className="text-[11px] text-muted-foreground">Select one</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TRAYS.map((t) => {
                const isSelected = tray === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTray(t.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[74px] ${
                      isSelected
                        ? t.activeClass
                        : "bg-card border-border/70 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Icon className="w-4 h-4 shrink-0" />
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground leading-tight">{t.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{t.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Student Lead Score Impact */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Lead Score Impact (Student Temperature)
              </label>
              <Badge
                variant="outline"
                className="text-[10px] font-mono font-bold"
                style={{ borderColor: activeIntent.color, color: activeIntent.color }}
              >
                {activeIntent.score > 0 ? `+${activeIntent.score}` : activeIntent.score} pts
              </Badge>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {INTENT_LEVELS.map((lvl) => {
                const isSelected = intentId === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setIntentId(lvl.id)}
                    className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      isSelected
                        ? "bg-accent/60 border-primary ring-2 ring-primary/30"
                        : "bg-card border-border/70 hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-base">{lvl.emoji}</span>
                    <span className="text-[11px] font-semibold text-foreground truncate w-full">
                      {lvl.label}
                    </span>
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: lvl.color }}
                    >
                      {lvl.score > 0 ? `+${lvl.score}` : lvl.score} pts
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/30 p-2 rounded-lg border border-border/40">
              <Info className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                Awards <strong>{activeIntent.score > 0 ? `+${activeIntent.score}` : activeIntent.score} points</strong> and moves lead to <strong>"{activeIntent.targetStage}"</strong> stage.
              </span>
            </p>
          </div>

          {/* 4. Automated Follow-up & Cooldown */}
          <div className="space-y-2.5 pt-1 border-t border-border/50">
            <label className="text-xs font-semibold text-foreground">Next Action Rules</label>
            <div className="space-y-2">
              {/* Require Callback */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresCallback}
                  onChange={(e) => setRequiresCallback(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <div className="space-y-0.5 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Prompt Counselor for Callback Date & Time</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Shows instant time presets (+2h, Tomorrow 11 AM) before saving.
                  </p>
                </div>
              </label>

              {/* Cooldown for Unreachable */}
              {tray === "unreachable" && (
                <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2 text-xs">
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>Cooldown Rest Before Next Call Attempt</span>
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

          {/* 5. Sub-Reason Chips / Tags (Optional) */}
          <div className="space-y-2 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground">
                Specific Sub-Reasons (Optional)
              </label>
              <span className="text-[10px] text-muted-foreground">
                {reasonChips.length} tag{reasonChips.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Input + Add */}
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
                placeholder="Type a reason (e.g. Fee too high) & hit Enter"
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
                <span>Add</span>
              </Button>
            </div>

            {/* Existing Chips */}
            {reasonChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {reasonChips.map((chip) => (
                  <Badge
                    key={chip}
                    variant="secondary"
                    className="text-xs py-0.5 px-2.5 gap-1.5 font-normal bg-muted hover:bg-muted/80 text-foreground"
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

            {/* Quick Suggestions to add with 1 click */}
            <div className="flex flex-wrap gap-1 items-center pt-1">
              <span className="text-[10px] text-muted-foreground">Suggestions:</span>
              {SUGGESTED_CHIPS.filter((s) => !reasonChips.includes(s)).slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleAddChip(s)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Unified Bottom Footer */}
        <div className="px-6 py-3.5 bg-muted/30 border-t border-border/60 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="px-5 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 cursor-pointer"
          >
            {loading ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{disposition ? "Save Changes" : "Create Outcome"}</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
