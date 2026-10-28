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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  Copy,
  Check,
  Sparkles,
  Phone,
  UserCheck,
  Pencil,
  Plus,
  Trash2,
  ArrowLeft,
  Settings2,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  currentUser?: User | null;
  onMessageSent?: (leadId: number, message: string) => void;
  initialManaging?: boolean;
}

export function WhatsAppModal({
  isOpen,
  onClose,
  lead,
  currentUser,
  onMessageSent,
  initialManaging = false,
}: WhatsAppModalProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [messageText, setMessageText] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Template Management Mode State
  const [isManaging, setIsManaging] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string>("new");
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Information");
  const [editBody, setEditBody] = useState("");
  const [isEditDefault, setIsEditDefault] = useState(false);
  const [templateActionLoading, setTemplateActionLoading] = useState(false);
  const [templateFeedback, setTemplateFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadTemplates = async () => {
    try {
      const res = await fetch("/api/whatsapp-templates");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTemplates(data);
        return data;
      }
    } catch (err) {
      console.error("Failed to load WhatsApp templates:", err);
    }
    return [];
  };

  // Load templates on mount or when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsManaging(Boolean(initialManaging || !lead));
      setTemplateFeedback(null);
      loadTemplates().then((data) => {
        if (data.length > 0) {
          const defaultTpl = data.find((t: WhatsAppTemplate) => t.is_default) || data[0];
          setSelectedTemplateId(defaultTpl.id);
          applyTemplate(defaultTpl.template_body);
        }
      });
    }
  }, [isOpen, initialManaging, lead]);

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

  const handleSendWhatsApp = async () => {
    if (!lead?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/leads/${lead.id}/whatsapp-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateText: messageText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to launch WhatsApp");

      if (onMessageSent) {
        onMessageSent(lead.id, messageText);
      }

      if (data.launchUrl) {
        window.open(data.launchUrl, "_blank");
      }
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to trigger WhatsApp");
    } finally {
      setLoading(false);
    }
  };

  // Switch to Template Management View
  const handleOpenManage = () => {
    setIsManaging(true);
    setTemplateFeedback(null);
    const curr = templates.find((t) => t.id === selectedTemplateId) || templates[0];
    if (curr) {
      setEditingTemplateId(curr.id);
      setEditName(curr.name);
      setEditCategory(curr.category || "General");
      setEditBody(curr.template_body);
      setIsEditDefault(Boolean(curr.is_default));
    } else {
      handleStartNewTemplate();
    }
  };

  const handleStartNewTemplate = () => {
    setEditingTemplateId("new");
    setEditName("");
    setEditCategory("Admissions");
    setEditBody("Hello {name}, thank you for your inquiry about DreamDesk. We are pleased to share our official curriculum details for {stream}. Please let us know if you have any questions!");
    setIsEditDefault(false);
    setTemplateFeedback(null);
  };

  const handleSelectTemplateToEdit = (tplId: string | null) => {
    if (!tplId) return;
    if (tplId === "new") {
      handleStartNewTemplate();
      return;
    }
    const tpl = templates.find((t) => t.id === tplId);
    if (tpl) {
      setEditingTemplateId(tpl.id);
      setEditName(tpl.name);
      setEditCategory(tpl.category || "General");
      setEditBody(tpl.template_body);
      setIsEditDefault(Boolean(tpl.is_default));
      setTemplateFeedback(null);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim() || !editBody.trim()) {
      setTemplateFeedback({ type: "error", message: "Template name and body are required." });
      return;
    }

    setTemplateActionLoading(true);
    setTemplateFeedback(null);

    try {
      const isNew = editingTemplateId === "new";
      const method = isNew ? "POST" : "PUT";
      const payload: any = {
        name: editName.trim(),
        category: editCategory.trim(),
        template_body: editBody.trim(),
        is_default: isEditDefault ? 1 : 0,
      };
      if (!isNew) {
        payload.id = editingTemplateId;
      }

      const res = await fetch("/api/whatsapp-templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save template");

      await loadTemplates();
      setTemplateFeedback({
        type: "success",
        message: isNew ? "Template created successfully!" : "Template updated successfully!",
      });
      setTimeout(() => setTemplateFeedback(null), 3000);

      const savedId = data.id || editingTemplateId;
      setEditingTemplateId(savedId);
      setSelectedTemplateId(savedId);
      applyTemplate(data.template_body || editBody.trim());
    } catch (err: any) {
      setTemplateFeedback({ type: "error", message: err.message || "Failed to save template" });
    } finally {
      setTemplateActionLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this WhatsApp template?")) return;
    setTemplateActionLoading(true);
    setTemplateFeedback(null);
    try {
      const res = await fetch(`/api/whatsapp-templates?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete template");

      const refreshed = await loadTemplates();
      if (refreshed.length > 0) {
        const next = refreshed[0];
        setEditingTemplateId(next.id);
        setEditName(next.name);
        setEditCategory(next.category || "General");
        setEditBody(next.template_body);
        setIsEditDefault(Boolean(next.is_default));
        setSelectedTemplateId(next.id);
        applyTemplate(next.template_body);
      } else {
        handleStartNewTemplate();
      }
      setTemplateFeedback({ type: "success", message: "Template deleted successfully." });
      setTimeout(() => setTemplateFeedback(null), 3000);
    } catch (err: any) {
      setTemplateFeedback({ type: "error", message: err.message || "Failed to delete template" });
    } finally {
      setTemplateActionLoading(false);
    }
  };

  if (!lead && !isManaging) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl">
        {/* ===================== VIEW 1: TEMPLATE MANAGER ===================== */}
        {isManaging ? (
          <div>
            <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-transparent border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {lead && (
                    <button
                      type="button"
                      onClick={() => setIsManaging(false)}
                      className="p-1.5 rounded-lg border border-border/80 bg-background text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Back to Message Composer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">
                      Edit WhatsApp Templates
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Customize message bodies, categories, and dynamic placeholder tokens.
                    </DialogDescription>
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleStartNewTemplate}
                  className="h-7 text-xs gap-1 font-semibold border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Template</span>
                </Button>
              </div>
            </DialogHeader>

            <form onSubmit={handleSaveTemplate} className="p-5 space-y-4">
              {templateFeedback && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    templateFeedback.type === "success"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-destructive/10 border-destructive/20 text-destructive"
                  }`}
                >
                  {templateFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{templateFeedback.message}</span>
                </div>
              )}

              {/* Template Selector for Editing */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Select Template to Edit</label>
                <div className="flex items-center gap-2">
                  <Select value={editingTemplateId} onValueChange={handleSelectTemplateToEdit}>
                    <SelectTrigger className="h-8 text-xs bg-background border-border/80 flex-1">
                      <SelectValue placeholder="Choose template..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new" className="text-xs font-semibold text-primary">
                        + Create New Template
                      </SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name} ({t.category}) {t.is_default ? "★ Default" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {editingTemplateId !== "new" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(editingTemplateId)}
                      disabled={templateActionLoading}
                      className="h-8 px-2.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Delete this template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Template Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Template Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Admission Prospectus Brochure"
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <Input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="e.g. Information, Follow-up, Appointment"
                    className="h-8 text-xs bg-background"
                    required
                  />
                </div>
              </div>

              {/* Template Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-semibold text-foreground">Template Body Text</label>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {editBody.length} characters
                  </span>
                </div>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={5}
                  placeholder="Enter message template text. Use {name}, {stream}, etc. for dynamic tokens..."
                  className="text-xs leading-relaxed resize-none bg-background border-border/80 rounded-xl p-3 focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  required
                />
              </div>

              {/* Clickable Variable Token Inserters */}
              <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Click to insert placeholder token:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {[
                    { token: "{name}", desc: "Student Name" },
                    { token: "{stream}", desc: "Academic Course" },
                    { token: "{school}", desc: "School/College" },
                    { token: "{counselor_name}", desc: "Counselor" },
                    { token: "{callback_at}", desc: "Scheduled Date" },
                    { token: "{lead_code}", desc: "Lead ID" },
                  ].map((item) => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => setEditBody((prev) => prev + ` ${item.token}`)}
                      className="px-2 py-1 rounded-lg bg-background border border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors font-mono text-[11px] cursor-pointer flex items-center gap-1"
                      title={`Append ${item.token}`}
                    >
                      <strong className="text-primary">{item.token}</strong>
                      <span className="text-muted-foreground text-[10px]">({item.desc})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!lead) {
                      onClose();
                    } else {
                      setIsManaging(false);
                    }
                  }}
                  className="h-8 text-xs cursor-pointer"
                >
                  {lead ? "Back to Message" : "Close"}
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={templateActionLoading}
                  className="h-8 text-xs font-bold px-4 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  {templateActionLoading ? "Saving..." : editingTemplateId === "new" ? "Create Template" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* ===================== VIEW 2: SEND MESSAGE TO STUDENT ===================== */
          <div>
            <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-transparent border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <DialogTitle className="text-lg font-bold tracking-tight text-foreground truncate">
                      WhatsApp: {lead?.name || "Student"}
                    </DialogTitle>
                    {lead?.phone && (
                      <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                        {lead.phone}
                      </span>
                    )}
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Personalized templates with automatic student token substitution.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="p-5 space-y-4">
              {/* Template Selector & Edit Link */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <label className="text-foreground font-semibold">Select Message Template</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenManage}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                      title="Edit or create templates"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit Templates</span>
                    </button>
                    <span className="text-[11px] text-muted-foreground">
                      ({templates.length} available)
                    </span>
                  </div>
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
              {lead && (
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
              )}
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
                  disabled={!lead?.phone || !messageText.trim()}
                  className="h-9 text-xs font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 shadow-2xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Launch WhatsApp</span>
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
