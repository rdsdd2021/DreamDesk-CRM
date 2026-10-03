"use client";

import React, { useState, useEffect } from "react";
import { Campaign, Disposition } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Target,
  Layers,
  Sparkles,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  allDispositions: Disposition[];
  onSaved: () => void;
}

const COMMON_CHANNELS = [
  "Meta / Instagram Ads",
  "Google Ads",
  "Campus Education Fair",
  "Walk-in Inquiries",
  "School Referral",
  "LinkedIn Outreach",
  "Direct Website",
  "Organic Search",
];

export function CampaignModal({
  isOpen,
  onClose,
  campaign,
  allDispositions,
  onSaved,
}: CampaignModalProps) {
  const isEditing = Boolean(campaign);

  const [name, setName] = useState("");
  const [channel, setChannel] = useState("Meta / Instagram Ads");
  const [description, setDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | "completed">("active");
  const [linkedDispositions, setLinkedDispositions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaign) {
      setName(campaign.name || "");
      setChannel(campaign.channel || "Meta / Instagram Ads");
      setDescription(campaign.description || "");
      setTargetAudience(campaign.target_audience || "");
      setStatus(campaign.status || "active");
      setLinkedDispositions(campaign.linked_disposition_ids || allDispositions.map((d) => d.id));
    } else {
      setName("");
      setChannel("Meta / Instagram Ads");
      setDescription("");
      setTargetAudience("");
      setStatus("active");
      // Default new campaign to have all dispositions linked
      setLinkedDispositions(allDispositions.map((d) => d.id));
    }
    setConfirmDelete(false);
    setError(null);
  }, [campaign, allDispositions, isOpen]);

  const handleToggleDisposition = (id: string) => {
    setLinkedDispositions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDispositions = () => {
    setLinkedDispositions(allDispositions.map((d) => d.id));
  };

  const handleDeselectAllDispositions = () => {
    setLinkedDispositions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    if (!channel.trim()) {
      setError("Channel is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditing && campaign) {
        const res = await fetch("/api/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: campaign.id,
            name: name.trim(),
            channel: channel.trim(),
            description: description.trim(),
            target_audience: targetAudience.trim(),
            status,
            linked_disposition_ids: linkedDispositions,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update campaign");
        }
      } else {
        const res = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            channel: channel.trim(),
            description: description.trim(),
            target_audience: targetAudience.trim(),
            status,
            linked_disposition_ids: linkedDispositions,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create campaign");
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save campaign");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!campaign) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns?id=${encodeURIComponent(campaign.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete campaign");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete campaign");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 bg-muted/40 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <Target className="w-4 h-4" />
              <span>{isEditing ? "Configure Campaign" : "New Campaign"}</span>
            </div>
            {isEditing && (
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                ID: {campaign?.id}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {isEditing ? `Edit ${campaign?.name}` : "Create Lead Capture Campaign"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Assign inbound channels, specify student demographics, and bind allowed telecalling call outcomes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Campaign Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. JEE 2026 Crash Course Batch"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Acquisition Channel <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <Select value={channel} onValueChange={(val) => { if (val) setChannel(val); }}>
                  <SelectTrigger className="h-9 text-xs flex-1">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_CHANNELS.map((ch) => (
                      <SelectItem key={ch} value={ch} className="text-xs">
                        {ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Target Demographics / Audience
              </label>
              <Input
                placeholder="e.g. Class 12 Science Students, Kolkata & WB"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Campaign Status
              </label>
              <Select
                value={status}
                onValueChange={(val) => {
                  if (val) setStatus(val as "active" | "paused" | "completed");
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active" className="text-xs">Active (Receiving Leads)</SelectItem>
                  <SelectItem value="paused" className="text-xs">Paused</SelectItem>
                  <SelectItem value="completed" className="text-xs">Completed / Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Campaign Description / Objective
            </label>
            <Textarea
              placeholder="Internal notes regarding source, ad creative, promo coupon or campaign goals..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none h-18"
            />
          </div>

          {/* Disposition Linking Matrix */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Allowed Dispositions for this Campaign ({linkedDispositions.length}/{allDispositions.length})</span>
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Counselors working on leads from this campaign can only choose from linked dispositions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllDispositions}
                  className="h-6 text-[11px] px-2"
                >
                  Select All
                </Button>
                <span className="text-muted-foreground text-xs">•</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAllDispositions}
                  className="h-6 text-[11px] px-2 text-muted-foreground"
                >
                  Clear All
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-muted/20 border rounded-lg max-h-48 overflow-y-auto">
              {allDispositions.map((disp) => {
                const isChecked = linkedDispositions.includes(disp.id);
                return (
                  <label
                    key={disp.id}
                    className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-primary/5 border-primary/40 font-medium"
                        : "bg-background border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => handleToggleDisposition(disp.id)}
                    />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: disp.color }}
                      />
                      <span className="truncate text-[11px]">{disp.name}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t flex items-center justify-between">
            {isEditing ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-600 font-medium">Delete campaign?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="h-8 text-xs font-semibold"
                  >
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="h-8 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Campaign</span>
                </Button>
              )
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
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Campaign"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
