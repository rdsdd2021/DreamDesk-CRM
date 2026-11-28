"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Lead, User, WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate } from "@/types/crm";
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
import { WhatsAppTemplateBubblePreview } from "@/components/crm/WhatsAppTemplateBubblePreview";
import { Clock, Loader2, Lock, MessageSquare, Send, Sparkles } from "lucide-react";

function parseWaTimestamp(val?: string | number | null): Date {
  if (val === null || val === undefined || val === "") return new Date(NaN);
  if (typeof val === "number") {
    return new Date(val < 1e12 ? val * 1000 : val);
  }
  const s = String(val).trim();
  if (/^\d{9,11}$/.test(s)) return new Date(Number(s) * 1000);
  if (/^\d{12,14}$/.test(s)) return new Date(Number(s));
  return new Date(s);
}

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
  const [conversation, setConversation] = useState<WhatsAppConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [mediaOverrideUrl, setMediaOverrideUrl] = useState<string>("");
  const [focusedVarName, setFocusedVarName] = useState<string | null>(null);

  const windowStatus = useMemo(() => {
    const latestInboundFromMsgs = history
      .filter((m) => m.direction === "inbound")
      .sort((a, b) => parseWaTimestamp(b.created_at).getTime() - parseWaTimestamp(a.created_at).getTime())[0]?.created_at;
    const lastInbound = conversation?.last_inbound_at || latestInboundFromMsgs || null;
    if (!lastInbound) {
      return { isOpen: false, label: "No inbound reply yet · Template required" };
    }
    const elapsedMs = Date.now() - parseWaTimestamp(lastInbound).getTime();
    const limitMs = 24 * 60 * 60 * 1000;
    if (isNaN(elapsedMs) || elapsedMs >= limitMs) {
      return { isOpen: false, label: "24h window expired · Template required" };
    }
    const remMs = limitMs - elapsedMs;
    const hrs = Math.floor(remMs / (60 * 60 * 1000));
    const mins = Math.floor((remMs % (60 * 60 * 1000)) / (60 * 1000));
    return { isOpen: true, label: `24h Window Open · ${hrs}h ${mins}m left` };
  }, [conversation?.last_inbound_at, history]);

  useEffect(() => {
    if (!isOpen || !lead?.id) return;
    setSelectedPhone(lead.whatsapp_phone || lead.phone || "");
    setLoading(true);
    setFreeText("");
    setSelectedTemplateId("");
    setMediaOverrideUrl("");
    setFocusedVarName(null);
    Promise.all([
      fetch("/api/whatsapp/templates?approved=1", { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/whatsapp/conversations?lead_id=${lead.id}`, { cache: "no-store" }).then((r) =>
        r.json()
      ),
    ])
      .then(([tData, cData]) => {
        const tpls: WhatsAppTemplate[] = tData?.templates || [];
        const msgs: WhatsAppMessage[] = cData?.messages || [];
        const conv: WhatsAppConversation | null = cData?.conversation || null;
        setTemplates(tpls);
        setHistory(msgs);
        setConversation(conv);

        const lastIn =
          conv?.last_inbound_at ||
          msgs.filter((m) => m.direction === "inbound").slice(-1)[0]?.created_at;
        const open24h = Boolean(
          lastIn && Date.now() - parseWaTimestamp(lastIn).getTime() < 24 * 60 * 60 * 1000
        );
        if (!open24h) {
          setMode("template");
          if (tpls.length > 0) {
            handleSelectTemplate(tpls[0]);
          }
        } else {
          setMode("text");
        }
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
              to_phone: selectedPhone || undefined,
              message_type: "template",
              template_name: selectedTemplate.name,
              language_code: selectedTemplate.language || "en_US",
              parameter_format: selectedTemplate.parameter_format || "NAMED",
              template_variables: (selectedTemplate.variables || []).map((v) => ({
                name: v.name,
                value: varValues[v.name] || "",
              })),
              header_media_type:
                selectedTemplate.header_type &&
                ["IMAGE", "VIDEO", "DOCUMENT"].includes(selectedTemplate.header_type)
                  ? selectedTemplate.header_type
                  : undefined,
              media_url:
                selectedTemplate.header_type &&
                ["IMAGE", "VIDEO", "DOCUMENT"].includes(selectedTemplate.header_type) &&
                (mediaOverrideUrl.trim() || selectedTemplate.header_content)
                  ? mediaOverrideUrl.trim() || selectedTemplate.header_content
                  : undefined,
              body: renderedTemplatePreview(),
            }
          : {
              lead_id: lead.id,
              to_phone: selectedPhone || undefined,
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
      <DialogContent className="sm:max-w-[700px] w-[calc(100vw-24px)] p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="px-5 py-4 border-b border-border/60 bg-gradient-to-r from-emerald-500/10 via-card to-card shrink-0">
          <div className="flex items-center justify-between gap-3 pr-6 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/15 text-emerald-600 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-bold truncate">
                  Kapso WhatsApp · {lead?.name || lead?.phone || "Lead"}
                </DialogTitle>
                <DialogDescription className="text-[11px] truncate">
                  {lead?.lead_code} · Integrated Business Chat (No external links)
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold gap-1 shrink-0 ${
                windowStatus.isOpen
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
              }`}
            >
              {windowStatus.isOpen ? <Clock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              <span>{windowStatus.label}</span>
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
          {/* Recipient Number Picker (when multiple contacts exist) */}
          {lead?.alternate_contacts && lead.alternate_contacts.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Send To Contact Number
              </div>
              <select
                value={selectedPhone}
                onChange={(e) => setSelectedPhone(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-foreground"
              >
                {lead.phone && (
                  <option value={lead.phone}>
                    {lead.phone_label || "Primary"}: {lead.phone}
                    {!lead.whatsapp_phone || lead.whatsapp_phone === lead.phone ? " (WhatsApp Default)" : ""}
                  </option>
                )}
                {lead.alternate_contacts.map((c) => (
                  <option key={c.id} value={c.phone}>
                    {c.label}: {c.phone}
                    {c.is_whatsapp || lead.whatsapp_phone === c.phone ? " (WhatsApp Default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={!windowStatus.isOpen}
              onClick={() => windowStatus.isOpen && setMode("text")}
              title={
                windowStatus.isOpen
                  ? "Send a free-text reply"
                  : "Free-text replies are only allowed within 24 hours of the customer's last inbound message"
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                !windowStatus.isOpen
                  ? "bg-muted/50 text-muted-foreground/60 cursor-not-allowed border border-border/50"
                  : mode === "text"
                  ? "bg-emerald-600 text-white cursor-pointer"
                  : "bg-muted text-muted-foreground cursor-pointer"
              }`}
            >
              {!windowStatus.isOpen && <Lock className="w-3 h-3" />}
              <span>Free-text Reply</span>
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

          {!windowStatus.isOpen && (
            <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Meta requires an <strong>Approved Template</strong> when no inbound reply was received in the last 24 hours.
              </span>
            </div>
          )}

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
                      onClick={() => {
                        setMediaOverrideUrl("");
                        handleSelectTemplate(t);
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                        selectedTemplateId === t.id
                          ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                          : "bg-muted/40 border-border text-foreground hover:bg-muted"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))
                )}
              </div>

              {selectedTemplate && (
                <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  {/* Left: Compact Variables + Lead Detail Suggestions */}
                  <div className="md:col-span-6 space-y-2">
                    {(selectedTemplate.variables || []).length > 0 ? (
                      <>
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-foreground">
                            Fill Variables ({selectedTemplate.variables?.length || 0})
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Click or pick from Lead Details
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                          {(selectedTemplate.variables || []).map((v) => {
                            const leadSuggestions = [
                              { label: "Name", val: lead?.name || "" },
                              { label: "Code", val: lead?.lead_code || "" },
                              { label: "Phone", val: lead?.phone || "" },
                              { label: "Counselor", val: currentUser?.name || "" },
                              ...Object.entries(lead?.raw_attributes || {})
                                .filter(([k, val]) => val && typeof val !== "object" && !/contact|phone/i.test(k))
                                .slice(0, 6)
                                .map(([k, val]) => ({
                                  label: k.replace(/_/g, " "),
                                  val: String(val),
                                })),
                            ].filter((s) => s.val);

                            return (
                              <div key={v.name} className="flex items-center gap-1.5">
                                <span className="w-12 shrink-0 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                                  {`{{${v.name}}}`}
                                </span>
                                <Input
                                  value={varValues[v.name] || ""}
                                  onFocus={() => setFocusedVarName(v.name)}
                                  onChange={(e) =>
                                    setVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                                  }
                                  placeholder={`Value for {{${v.name}}}`}
                                  className="h-7 text-xs bg-background flex-1 min-w-0"
                                />
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      setVarValues((prev) => ({ ...prev, [v.name]: e.target.value }));
                                    }
                                  }}
                                  title="Suggest from Lead Details"
                                  className="h-7 max-w-[92px] rounded-md border border-border bg-background px-1 text-[10px] text-muted-foreground cursor-pointer"
                                >
                                  <option value="">Lead data…</option>
                                  {leadSuggestions.map((s, idx) => (
                                    <option key={`${s.label}_${idx}`} value={s.val}>
                                      {s.label}: {s.val.slice(0, 22)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-muted-foreground italic py-1">
                        No variables required for this template.
                      </div>
                    )}

                    {selectedTemplate.header_type &&
                      ["IMAGE", "VIDEO", "DOCUMENT"].includes(selectedTemplate.header_type) && (
                        <div className="space-y-1 pt-1">
                          <label className="text-[10px] font-semibold text-muted-foreground">
                            {selectedTemplate.header_type} Header URL / Media ID
                          </label>
                          <Input
                            value={mediaOverrideUrl}
                            onChange={(e) => setMediaOverrideUrl(e.target.value)}
                            placeholder={selectedTemplate.header_content || "https://... or Media ID"}
                            className="h-7 text-xs font-mono bg-background"
                          />
                        </div>
                      )}
                  </div>

                  {/* Right: Compact Live Preview */}
                  <div className="md:col-span-6">
                    <WhatsAppTemplateBubblePreview
                      headerType={selectedTemplate.header_type}
                      headerContent={mediaOverrideUrl.trim() || selectedTemplate.header_content}
                      bodyText={selectedTemplate.template_body}
                      footerText={selectedTemplate.footer_text}
                      buttons={selectedTemplate.buttons}
                      variableValues={varValues}
                      templateName={selectedTemplate.name}
                      category={selectedTemplate.category}
                      language={selectedTemplate.language}
                    />
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
