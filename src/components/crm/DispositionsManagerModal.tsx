"use client";

import React, { useState, useEffect } from "react";
import { Disposition, Campaign } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SlidersHorizontal,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  Search,
  Hash,
  ChevronRight,
} from "lucide-react";

export interface DispositionsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  dispositions: Disposition[];
  campaigns: Campaign[];
  onDispositionsChange: () => void;
}

const PRESET_COLORS = [
  { name: "Emerald", hex: "#10b981" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Purple", hex: "#8b5cf6" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Orange", hex: "#f97316" },
  { name: "Rose", hex: "#ef4444" },
  { name: "Slate", hex: "#64748b" },
];

export function DispositionsManagerModal({
  isOpen,
  onClose,
  dispositions,
  campaigns,
  onDispositionsChange,
}: DispositionsManagerModalProps) {
  const [search, setSearch] = useState("");
  const [selectedDisposition, setSelectedDisposition] = useState<Disposition | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState<"positive" | "neutral" | "negative" | "unreachable">("positive");
  const [color, setColor] = useState("#10b981");
  const [score, setScore] = useState<number>(50);
  const [requiresCallback, setRequiresCallback] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [linkedCampaignIds, setLinkedCampaignIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const resetForm = () => {
    setSelectedDisposition(null);
    setName("");
    setCode("");
    setCategory("positive");
    setColor("#10b981");
    setScore(50);
    setRequiresCallback(false);
    setIsActive(true);
    setLinkedCampaignIds(campaigns.map((c) => c.id));
    setIsEditing(false);
    setError(null);
  };

  const handleOpenEdit = (disp: Disposition) => {
    setSelectedDisposition(disp);
    setName(disp.name);
    setCode(disp.code);
    setCategory(disp.category || "positive");
    setColor(disp.color || "#3b82f6");
    setScore(disp.score || 0);
    setRequiresCallback(Boolean(disp.requires_callback));
    setIsActive(Boolean(disp.is_active));
    setLinkedCampaignIds(disp.linked_campaign_ids || campaigns.map((c) => c.id));
    setIsEditing(true);
    setError(null);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!selectedDisposition) {
      // Auto-generate uppercase snake_case code
      const genCode = val
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 30);
      setCode(genCode);
    }
  };

  const handleToggleCampaign = (id: string) => {
    setLinkedCampaignIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Outcome label is required.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      code: (code || name).trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      category,
      color,
      score: Number(score) || 0,
      requires_callback: requiresCallback ? 1 : 0,
      is_active: isActive ? 1 : 0,
      linked_campaign_ids: linkedCampaignIds,
    };

    try {
      if (isEditing && selectedDisposition) {
        const res = await fetch("/api/dispositions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedDisposition.id,
            ...payload,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update disposition");
        }
      } else {
        const res = await fetch("/api/dispositions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create disposition");
        }
      }

      onDispositionsChange();
      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to save disposition");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this disposition?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/dispositions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete disposition");
      }
      onDispositionsChange();
      if (selectedDisposition?.id === id) {
        resetForm();
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredDispositions = dispositions.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.code.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 bg-muted/40 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <SlidersHorizontal className="w-4 h-4" />
              <span>Call Dispositions & Pipeline Stages</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {dispositions.length} Configured
            </Badge>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Customize Telecalling Outcomes
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure call result stages, set conversion scoring weights, enable automated callback triggers, and link to campaigns.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 max-h-[75vh] divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Left Column: Disposition List */}
          <div className="md:col-span-5 p-4 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Filter dispositions..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={resetForm}
                className="h-8 text-xs gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </Button>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[55vh] pr-1">
              {filteredDispositions.map((disp) => {
                const isSelected = selectedDisposition?.id === disp.id;
                return (
                  <div
                    key={disp.id}
                    onClick={() => handleOpenEdit(disp)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-primary/10 border-primary shadow-xs"
                        : "bg-card border-border/70 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: disp.color }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-foreground flex items-center gap-1.5">
                          <span>{disp.name}</span>
                          {disp.requires_callback === 1 && (
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span className="font-mono">{disp.code}</span>
                          <span>•</span>
                          <span className="capitalize">{disp.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          disp.score > 40
                            ? "bg-emerald-500/10 text-emerald-600"
                            : disp.score > 0
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-rose-500/10 text-rose-600"
                        }`}
                      >
                        {disp.score > 0 ? `+${disp.score}` : disp.score}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
                    </div>
                  </div>
                );
              })}

              {filteredDispositions.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No dispositions match your search.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="md:col-span-7 p-5 overflow-y-auto">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{isEditing ? `Edit: ${selectedDisposition?.name}` : "Create New Call Outcome"}</span>
                </h3>
                {isEditing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    className="h-6 text-[11px] text-muted-foreground"
                  >
                    Switch to New
                  </Button>
                )}
              </div>

              {error && (
                <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Outcome Label <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Interested - Campus Visit Scheduled"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    System Code
                  </label>
                  <Input
                    placeholder="e.g. CAMPUS_VISIT"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Funnel Category
                  </label>
                  <Select
                    value={category}
                    onValueChange={(val) => {
                      if (val) setCategory(val as any);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positive" className="text-xs">Positive / Converted</SelectItem>
                      <SelectItem value="neutral" className="text-xs">Neutral / In Discussion</SelectItem>
                      <SelectItem value="negative" className="text-xs">Negative / Lost</SelectItem>
                      <SelectItem value="unreachable" className="text-xs">Unreachable / Invalid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Lead Score Delta (-100 to +100)
                  </label>
                  <Input
                    type="number"
                    min="-100"
                    max="100"
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Color Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Badge Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((p) => (
                    <button
                      type="button"
                      key={p.hex}
                      onClick={() => setColor(p.hex)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        color.toLowerCase() === p.hex.toLowerCase()
                          ? "scale-115 border-foreground shadow-xs"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: p.hex }}
                      title={p.name}
                    />
                  ))}
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-7 h-7 p-0.5 border rounded cursor-pointer"
                  />
                  <span className="text-[11px] font-mono text-muted-foreground ml-1">
                    {color}
                  </span>
                </div>
              </div>

              {/* Triggers & Flags */}
              <div className="p-3 bg-muted/20 border rounded-lg space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <Checkbox
                    checked={requiresCallback}
                    onCheckedChange={(checked) => setRequiresCallback(Boolean(checked))}
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Triggers Mandatory Callback Scheduling</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Counselors choosing this disposition will be required to set a scheduled callback date & time.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer pt-2 border-t border-border/50">
                  <Checkbox
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(Boolean(checked))}
                  />
                  <div>
                    <div className="text-xs font-semibold text-foreground">
                      Active Disposition
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Active dispositions appear in the telecalling dropdown when counselors update a lead.
                    </p>
                  </div>
                </label>
              </div>

              {/* Associated Campaigns */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Available in Campaigns ({linkedCampaignIds.length}/{campaigns.length})
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 border rounded-lg bg-muted/20">
                  {campaigns.map((camp) => (
                    <label
                      key={camp.id}
                      className="flex items-center gap-2 p-1 text-[11px] cursor-pointer hover:text-foreground"
                    >
                      <Checkbox
                        checked={linkedCampaignIds.includes(camp.id)}
                        onCheckedChange={() => handleToggleCampaign(camp.id)}
                      />
                      <span className="truncate">{camp.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t flex items-center justify-between">
                {isEditing && selectedDisposition ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(selectedDisposition.id)}
                    disabled={deletingId === selectedDisposition.id}
                    className="h-8 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    className="h-8 text-xs"
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loading}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    {loading ? "Saving..." : isEditing ? "Update Outcome" : "Create Outcome"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
