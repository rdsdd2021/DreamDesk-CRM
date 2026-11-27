"use client";

import React, { useEffect, useState } from "react";
import { Lead, User, WhatsAppMessage, WhatsAppTemplate } from "@/types/crm";
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
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";

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
}: WhatsAppModalProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [mode, setMode] = useState<"text" | "template">("text");
  const [history, setHistory] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen || !lead?.id) return;
    setLoading(true);
    setMode("text");
    setFreeText("");
    setSelectedTemplateId("");
    Promise.all([
      fetch("/api/whatsapp/templates?approved=1", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/whatsapp/conversations?lead_id=${lead.id}`, { cache: "no-store" }).then((r) =>
        r.json()
      ),
    ])
      .then(([tData, cData]) => {
        setTemplates(tData?.templates || []);
        setHistory(cData?.messages || []);
      })
      .finally(() => setLoading(false));
  }, [isOpen, lead?.id]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const handleSelectTemplate = (tpl: WhatsAppTemplate) => {
    setMode("template");
    setSelectedTemplateId(tpl.id);
    const defaults: Record<string, string> = {};
    for (const v of tpl.variables || []) {
      const k = v.name.toLowerCase();
      if (k.includes("name") && !k.includes("counselor")) {
        defaults[v.name] = lead?.name || "Student";
      } else if (k.includes("counselor")) {
        defaults[v.name] = currentUser?.name || "Counselor";
      } else if (k.includes("code") || k.includes("id")) {
        defaults[v.name] = lead?.lead_code || "";
      } else if (k.includes("course") || k.includes("stream")) {
        defaults[v.name] = String(lead?.raw_attributes?.stream || "");
      } else {
        defaults[v.name] = v.example || "";
      }
    }
    setVarValues(defaults);
  };

  const renderedTemplatePreview = () => {
    if (!selectedTemplate) return "";
    let body = selectedTemplate.template_body;
    for (const v of selectedTemplate.variables || []) {
      body = body.split(`{{${v.name}}}`).join(varValues[v.name] || `[${v.name}]`);
    }
    return body;
  };

  const handleSend = async () => {
    if (!lead?.id) return;
    setSending(true);
    try {
      const payload =
        mode === "template" && selectedTemplate
          ? {
              lead_id: lead.id,
              message_type: "template",
              template_name: selectedTemplate.name,
              language_code: selectedTemplate.language || "en_US",
              parameter_format: selectedTemplate.parameter_format || "NAMED",
              template_variables: (selectedTemplate.variables || []).map((v) => ({
                name: v.name,
                value: varValues[v.name] || "",
              })),
              body: renderedTemplatePreview(),
            }
          : {
              lead_id: lead.id,
              message_type: "text",
              body: freeText.trim(),
            };

      if (mode === "text" && !freeText.trim()) return;

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send WhatsApp message");

      onMessageSent?.(lead.id, payload.body);
      onClose();
    } catch (err: any) {
      alert(err?.message || "Failed to send WhatsApp message via Kapso");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg w-[calc(100vw-24px)] p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 py-4 border-b border-border/60 bg-gradient-to-r from-emerald-500/10 via-card to-card">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/15 text-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">
                Kapso WhatsApp · {lead?.name || "Lead"}
              </DialogTitle>
              <DialogDescription className="text-[11px]">
                {lead?.lead_code} · Integrated Business Chat (No external links)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
          {/* Recent Chat History */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Recent Chat History
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 max-h-40 overflow-y-auto space-y-2">
              {loading ? (
                <div className="py-4 text-center text-muted-foreground flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading chat history...</span>
                </div>
              ) : history.length === 0 ? (
                <div className="py-3 text-center text-muted-foreground italic">
                  No WhatsApp messages recorded for this lead yet.
                </div>
              ) : (
                history.slice(-6).map((m) => (
                  <div
                    key={m.id}
                    className={`p-2 rounded-lg text-xs max-w-[85%] ${
                      m.direction === "outbound"
                        ? "ml-auto bg-emerald-600 text-white"
                        : "bg-card border border-border text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                mode === "text" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              Free-text Reply
            </button>
            <button
              type="button"
              onClick={() => setMode("template")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                mode === "template" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Approved Meta Template ({templates.length})</span>
            </button>
          </div>

          {mode === "text" ? (
            <Textarea
              rows={4}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Write a WhatsApp message to send directly via Kapso..."
              className="text-xs rounded-xl"
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {templates.length === 0 ? (
                  <span className="text-muted-foreground italic">
                    No approved Meta/Kapso templates synced yet.
                  </span>
                ) : (
                  templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTemplate(t)}
                      className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                        selectedTemplateId === t.id
                          ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                          : "bg-muted/40 border-border text-foreground"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>

              {selectedTemplate && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {selectedTemplate.category} · {selectedTemplate.language}
                    </Badge>
                  </div>
                  {(selectedTemplate.variables || []).map((v) => (
                    <div key={v.name} className="space-y-1">
                      <label className="text-[10px] font-mono text-muted-foreground">
                        {`{{${v.name}}}`}
                      </label>
                      <Input
                        value={varValues[v.name] || ""}
                        onChange={(e) =>
                          setVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                  <div className="p-2.5 rounded-lg bg-card border border-border/70 text-xs whitespace-pre-wrap">
                    {renderedTemplatePreview()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 bg-muted/30 border-t border-border/60 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={
              sending ||
              (mode === "text" ? !freeText.trim() : !selectedTemplate)
            }
            onClick={handleSend}
            className="h-8 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{sending ? "Sending..." : "Send via Kapso"}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
