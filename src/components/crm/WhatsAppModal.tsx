"use client";

import React, { useState, useEffect } from "react";
import { Lead, WhatsAppTemplate, User } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Send, Copy, Check, Sparkles, Phone, UserCheck } from "lucide-react";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  currentUser?: User | null;
  onMessageSent?: (leadId: number, message: string) => void;
}

export function WhatsAppModal({
  isOpen,
  onClose,
  lead,
  currentUser,
  onMessageSent,
}: WhatsAppModalProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load templates on mount
  useEffect(() => {
    if (isOpen) {
      fetch("/api/whatsapp-templates")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTemplates(data);
            const defaultTpl = data.find((t) => t.is_default) || data[0];
            if (defaultTpl) {
              setSelectedTemplateId(defaultTpl.id);
              applyTemplate(defaultTpl.template_body);
            }
          }
        })
        .catch((err) => console.error("Failed to load WhatsApp templates:", err));
    }
  }, [isOpen]);

  // When lead changes, re-evaluate message
  useEffect(() => {
    if (lead && selectedTemplateId) {
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        applyTemplate(tpl.template_body);
      }
    }
  }, [lead]);

  const applyTemplate = (body: string) => {
    if (!lead) {
      setMessageText(body);
      return;
    }

    const attrs = lead.raw_attributes || {};
    const stream = attrs.stream || "Academic Programs";
    const school = attrs.school || "High School";
    const counselorName = currentUser?.name || lead.assigned_user_name || "Academic Counselor";
    const callbackAt = lead.callback_at
      ? new Date(lead.callback_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      : "Today";

    let text = body
      .replace(/\{name\}/g, lead.name || "Student")
      .replace(/\{stream\}/g, String(stream))
      .replace(/\{school\}/g, String(school))
      .replace(/\{lead_code\}/g, lead.lead_code || "")
      .replace(/\{callback_at\}/g, callbackAt)
      .replace(/\{counselor_name\}/g, counselorName);

    setMessageText(text);
  };

  const handleSelectTemplate = (tplId: string | null) => {
    if (!tplId) return;
    setSelectedTemplateId(tplId);
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) applyTemplate(tpl.template_body);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    if (!lead?.phone) return;
    const cleanPhone = lead.phone.replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(messageText);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;

    // Log global activity
    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_type: "WHATSAPP_SENT",
        description: `Sent WhatsApp message to ${lead.name || "Student"} (${lead.lead_code})`,
        affected_count: 1,
        performed_by: currentUser?.name || "Counselor",
        metadata: JSON.stringify({ lead_id: lead.id, phone: lead.phone, template_id: selectedTemplateId }),
      }),
    }).catch(console.error);

    // Log lead timeline audit trail
    fetch(`/api/leads/${lead.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activity_type: "whatsapp",
        title: "WhatsApp Message Sent",
        description: messageText.length > 200 ? `${messageText.slice(0, 200)}...` : messageText,
        metadata: { channel: "whatsapp", phone: lead.phone, template_id: selectedTemplateId },
        performed_by_name: currentUser?.name || "Counselor",
      }),
    }).catch(console.error);

    if (onMessageSent) {
      onMessageSent(lead.id, messageText);
    }

    window.open(url, "_blank");
    onClose();
  };

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-transparent border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-lg font-bold tracking-tight text-foreground truncate">
                  WhatsApp: {lead.name || "Student"}
                </DialogTitle>
                <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                  {lead.phone}
                </span>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Personalized templates with automatic student token substitution.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Template Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <label className="text-foreground font-semibold">Select Message Template</label>
              <span className="text-[11px] text-muted-foreground">
                {templates.length} available
              </span>
            </div>
            <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
              <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border/80">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                    <span className="font-semibold">{tpl.name}</span>
                    <span className="text-muted-foreground ml-2 text-[11px]">({tpl.category})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Message Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-foreground">Message Preview</label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {messageText.length} characters
              </span>
            </div>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={5}
              className="text-xs leading-relaxed resize-none bg-background border-border/80 rounded-xl p-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            />
          </div>

          {/* Quick Tokens Pills */}
          <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Dynamic Tokens Substituted:</span>
              <span className="text-[10px] lowercase font-normal text-muted-foreground">(click to insert)</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setMessageText((prev) => prev + " {name}")}
                className="px-2 py-1 rounded-lg bg-background border border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors font-mono text-[11px] cursor-pointer"
                title="Click to insert {name}"
              >
                name: <strong className="text-foreground">{lead.name || "Student"}</strong>
              </button>
              <button
                type="button"
                onClick={() => setMessageText((prev) => prev + " {stream}")}
                className="px-2 py-1 rounded-lg bg-background border border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors font-mono text-[11px] cursor-pointer"
                title="Click to insert {stream}"
              >
                stream: <strong className="text-foreground">{String(lead.raw_attributes?.stream || "Academic")}</strong>
              </button>
              <button
                type="button"
                onClick={() => setMessageText((prev) => prev + " {lead_code}")}
                className="px-2 py-1 rounded-lg bg-background border border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors font-mono text-[11px] cursor-pointer"
                title="Click to insert {lead_code}"
              >
                code: <strong className="text-foreground">{lead.lead_code}</strong>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-9 text-xs font-semibold gap-1.5 rounded-lg px-3.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Text"}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-9 text-xs font-medium rounded-lg px-3"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={!lead.phone || !messageText.trim()}
              className="h-9 text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 shadow-2xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch WhatsApp</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
