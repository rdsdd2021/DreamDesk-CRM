"use client";

import React, { useEffect, useState } from "react";
import { LeadAiBriefResult, LeadAiParseNotesResult } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Loader2, Sparkles, Wand2, X } from "lucide-react";

interface LeadAiCopilotBarProps {
  leadId: number;
  notesText: string;
  onApplyParsedNotes: (parsed: LeadAiParseNotesResult) => void;
  onFieldApplied?: (field: string, label: string, value: string) => void;
}

export function LeadAiCopilotBar({
  leadId,
  notesText,
  onApplyParsedNotes,
  onFieldApplied,
}: LeadAiCopilotBarProps) {
  const [brief, setBrief] = useState<LeadAiBriefResult | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [parsingNotes, setParsingNotes] = useState(false);
  const [parsedResult, setParsedResult] = useState<LeadAiParseNotesResult | null>(null);
  const [appliedFields, setAppliedFields] = useState<Record<string, boolean>>({});
  const [applyingField, setApplyingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBrief(null);
    setParsedResult(null);
    setAppliedFields({});
    setError(null);
  }, [leadId]);

  const handleLoadBrief = async () => {
    setLoadingBrief(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/lead-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, mode: "brief" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate pre-call brief");
      setBrief(data.result);
    } catch (err: any) {
      setError(err?.message || "Pre-call brief failed");
    } finally {
      setLoadingBrief(false);
    }
  };

  const handleParseNotes = async () => {
    if (!notesText.trim()) {
      setError("Type rough call notes first, then click AI Parse Notes.");
      return;
    }
    setParsingNotes(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/lead-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          mode: "parse_notes",
          notes: notesText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse notes");
      setParsedResult(data.result);
      onApplyParsedNotes(data.result);
    } catch (err: any) {
      setError(err?.message || "Notes parsing failed");
    } finally {
      setParsingNotes(false);
    }
  };

  const handleApplyField = async (field: string, label: string, value: string) => {
    setApplyingField(field);
    try {
      const res = await fetch(`/api/leads/${leadId}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to update field");
      }
      setAppliedFields((prev) => ({ ...prev, [field]: true }));
      onFieldApplied?.(field, label, value);
    } catch (err: any) {
      setError(err?.message || "Failed to apply field");
    } finally {
      setApplyingField(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loadingBrief}
          onClick={handleLoadBrief}
          className="h-7 px-2.5 text-[11px] font-semibold gap-1 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 cursor-pointer"
        >
          {loadingBrief ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          <span>Pre-Call AI Brief</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={parsingNotes}
          onClick={handleParseNotes}
          title="Auto-select disposition, callback & clean notes from your rough notes"
          className="h-7 px-2.5 text-[11px] font-semibold gap-1 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 cursor-pointer"
        >
          {parsingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          <span>AI Parse Notes → Outcome</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {brief && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-2.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Pre-Call AI Brief
            </span>
            <button type="button" onClick={() => setBrief(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-foreground/90 leading-snug">{brief.summary}</p>
          {brief.talkingPoints.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
              {brief.talkingPoints.map((tp, idx) => (
                <li key={idx}>{tp}</li>
              ))}
            </ul>
          )}
          <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
            Goal: {brief.recommendedAction}
          </div>
          {brief.riskOrObjection && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>{brief.riskOrObjection}</span>
            </div>
          )}
        </div>
      )}

      {parsedResult && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              AI Matched: {parsedResult.disposition_name || "No exact disposition"}
              {parsedResult.sub_disposition_name ? ` → ${parsedResult.sub_disposition_name}` : ""}
              {parsedResult.callback_at ? ` · Callback ${parsedResult.callback_at.replace("T", " ")}` : ""}
            </span>
            <button type="button" onClick={() => setParsedResult(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
          {parsedResult.extracted_fields.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {parsedResult.extracted_fields.map((ef) => {
                const done = appliedFields[ef.field];
                const busy = applyingField === ef.field;
                return (
                  <button
                    key={ef.field}
                    type="button"
                    disabled={done || busy}
                    onClick={() => handleApplyField(ef.field, ef.label, ef.value)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium cursor-pointer ${
                      done
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-card border-border hover:border-emerald-500/50 text-foreground"
                    }`}
                  >
                    {busy ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : done ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <span className="text-emerald-600 font-bold">+</span>}
                    <span>{ef.label}: <strong>{ef.value}</strong></span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
