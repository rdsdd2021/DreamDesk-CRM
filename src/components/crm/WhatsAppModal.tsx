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

    // Log activity
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

    if (onMessageSent) {
      onMessageSent(lead.id, messageText);
    }

    window.open(url, "_blank");
    onClose();
  };

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-transparent border-b">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs tracking-wider uppercase">
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp Quick Messenger</span>
          </div>
          <DialogTitle className="text-base font-bold flex items-center justify-between">
            <span>Send to {lead.name || "Student"}</span>
            <span className="font-mono text-xs font-normal text-muted-foreground">{lead.phone}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Personalized dynamic templates with 1-click token replacement.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3.5">
          {/* Template Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-muted-foreground">Select Preset Template</label>
              <Badge variant="outline" className="text-[10px] font-normal">
                {templates.length} templates
              </Badge>
            </div>
            <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Choose a template..." />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                    <span className="font-medium">{tpl.name}</span>
                    <span className="text-muted-foreground ml-2 text-[10px]">({tpl.category})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dynamic Message Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-muted-foreground">Message Preview</label>
              <span className="text-[10px] text-muted-foreground font-mono">
                {messageText.length} characters
              </span>
            </div>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={6}
              className="text-xs leading-relaxed resize-none bg-muted/20 focus:bg-background"
            />
          </div>

          {/* Quick Tokens Pills */}
          <div className="p-2.5 rounded-lg border bg-muted/30 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Dynamic Tags Substituted:
            </div>
            <div className="flex flex-wrap gap-1 text-[10px]">
              <span className="px-1.5 py-0.5 rounded bg-background border font-mono">
                name: <strong>{lead.name || "Student"}</strong>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-background border font-mono">
                stream: <strong>{String(lead.raw_attributes?.stream || "Academic")}</strong>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-background border font-mono">
                code: <strong>{lead.lead_code}</strong>
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 pt-3 border-t bg-muted/20 flex sm:flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="h-8 text-xs gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy Text"}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={!lead.phone || !messageText.trim()}
              className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send WhatsApp</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
