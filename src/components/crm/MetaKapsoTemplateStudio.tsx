"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  WhatsAppTemplate,
  WhatsAppTemplateButton,
  WhatsAppTemplateHeaderType,
} from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { WhatsAppTemplateBubblePreview } from "@/components/crm/WhatsAppTemplateBubblePreview";
import { prepareMediaForKapso } from "@/lib/utils/imageCompress";
import {
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Video,
  XCircle,
} from "lucide-react";

interface MetaKapsoTemplateStudioProps {
  onShowToast?: (text: string, type: "success" | "error") => void;
  onTemplatesChanged?: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  REJECTED: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  PAUSED: "bg-slate-500/10 text-slate-600 border-slate-400/30",
};

export function MetaKapsoTemplateStudio({
  onShowToast,
  onTemplatesChanged,
}: MetaKapsoTemplateStudioProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Builder state
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [language, setLanguage] = useState("en_US");
  const [parameterFormat, setParameterFormat] = useState<"NAMED" | "POSITIONAL">("NAMED");
  const [headerType, setHeaderType] = useState<WhatsAppTemplateHeaderType>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerHandle, setHeaderHandle] = useState("");
  const [bodyText, setBodyText] = useState(
    "Hi {{student_name}}, thank you for inquiring about {{course_name}}. Our counselor {{counselor_name}} will reach out shortly."
  );
  const [footerText, setFooterText] = useState("DreamDesk Admissions");
  const [exampleValues, setExampleValues] = useState<Record<string, string>>({
    student_name: "Aarav Sharma",
    course_name: "B.Tech CSE",
    counselor_name: "Priya",
  });
  const [variableFieldMap, setVariableFieldMap] = useState<Record<string, string>>({
    student_name: "name",
    course_name: "stream",
    counselor_name: "assigned_user_name",
  });
  const [crmHeaders, setCrmHeaders] = useState<Array<{ key: string; label: string; sample: string }>>([
    { key: "name", label: "Student Name", sample: "Aarav Sharma" },
    { key: "lead_code", label: "Lead Code", sample: "LD-265369" },
    { key: "phone", label: "Primary Phone", sample: "+91 98765 43210" },
    { key: "email", label: "Email Address", sample: "aarav@example.com" },
    { key: "status", label: "Pipeline Stage", sample: "Interested" },
    { key: "assigned_user_name", label: "Assigned Counselor", sample: "Priya" },
    { key: "stream", label: "Course / Stream", sample: "B.Tech CSE" },
    { key: "city", label: "City", sample: "Kolkata" },
    { key: "school", label: "School / College", sample: "DPS" },
  ]);
  const [buttons, setButtons] = useState<WhatsAppTemplateButton[]>([]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/templates", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    fetch("/api/schema", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const cols: any[] = data?.schema || data?.columns || [];
        if (Array.isArray(cols) && cols.length > 0) {
          setCrmHeaders((prev) => {
            const seen = new Set(prev.map((p) => p.key));
            const merged = [...prev];
            for (const c of cols) {
              const k = String(c?.key_name || "").trim();
              if (!k || seen.has(k)) continue;
              seen.add(k);
              merged.push({
                key: k,
                label: String(c?.display_label || k),
                sample: `Sample ${c?.display_label || k}`,
              });
            }
            return merged;
          });
        }
      })
      .catch(() => {});
  }, [loadTemplates]);

  const detectedVariables = useMemo(() => {
    const matches = Array.from(bodyText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)).map((m) => m[1]);
    return Array.from(new Set(matches));
  }, [bodyText]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/whatsapp/templates/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      onShowToast?.(`Synced ${data.synced || 0} template(s) from Meta/Kapso`, "success");
      await loadTemplates();
      onTemplatesChanged?.();
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to sync templates", "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleUploadSampleMedia = async (rawFile: File) => {
    setUploadingMedia(true);
    try {
      const { file } = await prepareMediaForKapso(rawFile);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/whatsapp/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Media upload failed");
      setHeaderHandle(data.id);
      onShowToast?.(`Uploaded sample media (ID: ${data.id})`, "success");
    } catch (err: any) {
      onShowToast?.(err?.message || "Media upload failed", "error");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleInsertVariable = (crmHeader?: { key: string; label: string; sample: string }) => {
    const varKey =
      parameterFormat === "POSITIONAL"
        ? String(detectedVariables.length + 1)
        : crmHeader?.key || `variable_${detectedVariables.length + 1}`;
    const nextToken = `{{${varKey}}}`;
    setBodyText((prev) => `${prev}${prev.endsWith(" ") || !prev ? "" : " "}${nextToken}`);
    if (crmHeader) {
      setVariableFieldMap((prev) => ({ ...prev, [varKey]: crmHeader.key }));
      setExampleValues((prev) => ({ ...prev, [varKey]: prev[varKey] || crmHeader.sample }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          language,
          parameter_format: parameterFormat,
          header_type: headerType,
          header_text: headerText,
          header_handle: headerHandle,
          body_text: bodyText,
          footer_text: footerText,
          variables: detectedVariables.map((v) => ({
            name: v,
            example: exampleValues[v] || "Sample",
          })),
          buttons,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      onShowToast?.(
        `Submitted "${data.template?.name}" to Meta/Kapso (${data.template?.status || "PENDING"})`,
        "success"
      );
      setName("");
      await loadTemplates();
      onTemplatesChanged?.();
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to submit template", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tpl: WhatsAppTemplate) => {
    if (!confirm(`Delete template "${tpl.name}" from Meta/Kapso and CRM?`)) return;
    const res = await fetch(`/api/whatsapp/templates?id=${encodeURIComponent(tpl.id)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
      onShowToast?.(`Deleted template "${tpl.name}"`, "success");
      onTemplatesChanged?.();
    }
  };

  const previewBody = useMemo(() => {
    let text = bodyText;
    for (const v of detectedVariables) {
      text = text.split(`{{${v}}}`).join(exampleValues[v] || `[${v}]`);
    }
    return text;
  }, [bodyText, detectedVariables, exampleValues]);

  const filteredTemplates = templates.filter((t) =>
    statusFilter === "ALL" ? true : (t.status || "APPROVED") === statusFilter
  );

  return (
    <div className="space-y-6">
      {/* Builder + Live WhatsApp Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-foreground">
                Create & Submit Meta / Kapso Template
              </span>
            </div>
            <Badge variant="outline" className="text-[10px]">
              v24.0 WABA Submission
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-foreground">Template Name (snake_case) *</label>
              <Input
                value={name}
                onChange={(e) =>
                  setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                }
                placeholder="e.g. admission_follow_up_2026"
                className="h-9 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="UTILITY">UTILITY</option>
                <option value="MARKETING">MARKETING</option>
                <option value="AUTHENTICATION">AUTHENTICATION</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="en_US">English (en_US)</option>
                <option value="en">English (en)</option>
                <option value="hi">Hindi (hi)</option>
                <option value="bn">Bengali (bn)</option>
              </select>
            </div>
          </div>

          {/* Header & Variable Format */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Header Type</label>
              <select
                value={headerType}
                onChange={(e) => setHeaderType(e.target.value as WhatsAppTemplateHeaderType)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="NONE">None</option>
                <option value="TEXT">Text Header</option>
                <option value="IMAGE">Image Media Header</option>
                <option value="VIDEO">Video Media Header</option>
                <option value="DOCUMENT">Document (PDF) Header</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Variable Format</label>
              <select
                value={parameterFormat}
                onChange={(e) => setParameterFormat(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-border bg-background px-2.5 text-xs"
              >
                <option value="NAMED">Named (e.g. {"{{student_name}}"})</option>
                <option value="POSITIONAL">Positional (e.g. {"{{1}}"})</option>
              </select>
            </div>
          </div>

          {headerType === "TEXT" && (
            <div className="space-y-1 text-xs">
              <label className="font-semibold text-foreground">Header Text</label>
              <Input
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder="e.g. DreamDesk Admissions Update"
                maxLength={60}
                className="h-9 text-xs"
              />
            </div>
          )}

          {["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType) && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="font-semibold text-foreground">
                  Sample {headerType} Header Handle / Upload
                </label>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer hover:bg-emerald-700">
                  {uploadingMedia ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploadingMedia ? "Uploading..." : "Upload to Kapso Media"}</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadSampleMedia(f);
                    }}
                  />
                </label>
              </div>
              <Input
                value={headerHandle}
                onChange={(e) => setHeaderHandle(e.target.value)}
                placeholder="Media handle / ID returned by Kapso Media API..."
                className="h-8 text-xs font-mono"
              />
            </div>
          )}

          {/* Body + Insert Variable + CRM Header Suggestions */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground">Template Body *</label>
              <button
                type="button"
                onClick={() => handleInsertVariable()}
                className="text-[11px] font-semibold text-emerald-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Insert Variable</span>
              </button>
            </div>
            <textarea
              rows={4}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const raw = e.dataTransfer.getData("application/x-dreamdesk-crm-field");
                if (!raw) return;
                try {
                  const crmHeader = JSON.parse(raw) as { key: string; label: string; sample: string };
                  const el = e.currentTarget;
                  const start = el.selectionStart ?? bodyText.length;
                  const end = el.selectionEnd ?? bodyText.length;
                  const varKey =
                    parameterFormat === "POSITIONAL"
                      ? String(detectedVariables.length + 1)
                      : crmHeader.key;
                  const token = `{{${varKey}}}`;
                  setBodyText((prev) => prev.slice(0, start) + token + prev.slice(end));
                  setVariableFieldMap((prev) => ({ ...prev, [varKey]: crmHeader.key }));
                  setExampleValues((prev) => ({ ...prev, [varKey]: prev[varKey] || crmHeader.sample }));
                } catch {}
              }}
              className="w-full rounded-xl border border-border bg-background p-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              required
            />
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold text-muted-foreground">
                Drag or Click CRM Field:
              </span>
              {crmHeaders.slice(0, 8).map((h) => (
                <button
                  key={h.key}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-dreamdesk-crm-field", JSON.stringify(h));
                    e.dataTransfer.setData("text/plain", `{{${h.key}}}`);
                  }}
                  onClick={() => handleInsertVariable(h)}
                  className="px-2 py-0.5 rounded-md border border-border bg-muted/40 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-700 dark:hover:text-emerald-300 text-[10px] font-medium cursor-grab active:cursor-grabbing transition-colors"
                  title="Drag into Template Body or Variable row, or click to insert"
                >
                  ⋮⋮ + {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form-like Variable Mapping & Meta Sample Values (Outside Body) */}
          {detectedVariables.length > 0 && (
            <div className="p-3.5 rounded-xl bg-muted/25 border border-border/60 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">
                  Variable Fields &amp; CRM Header Mapping ({detectedVariables.length})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Auto-fills from CRM lead data when sending
                </span>
              </div>
              <div className="space-y-2">
                {detectedVariables.map((v) => (
                  <div
                    key={v}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const raw = e.dataTransfer.getData("application/x-dreamdesk-crm-field");
                      if (!raw) return;
                      try {
                        const crmHeader = JSON.parse(raw) as { key: string; label: string; sample: string };
                        setVariableFieldMap((prev) => ({ ...prev, [v]: crmHeader.key }));
                        setExampleValues((prev) => ({ ...prev, [v]: crmHeader.sample }));
                      } catch {}
                    }}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-background/80 p-2 rounded-lg border border-border/50 hover:border-emerald-500/40 transition-colors"
                  >
                    <div className="sm:col-span-3">
                      <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-semibold">
                        {`{{${v}}}`}
                      </span>
                    </div>
                    <div className="sm:col-span-5">
                      <select
                        value={variableFieldMap[v] || ""}
                        onChange={(e) => {
                          const key = e.target.value;
                          setVariableFieldMap((prev) => ({ ...prev, [v]: key }));
                          const match = crmHeaders.find((h) => h.key === key);
                          if (match && !exampleValues[v]) {
                            setExampleValues((prev) => ({ ...prev, [v]: match.sample }));
                          }
                        }}
                        className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                      >
                        <option value="">-- Suggest CRM Header --</option>
                        {crmHeaders.map((h) => (
                          <option key={h.key} value={h.key}>
                            {h.label} ({h.key})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <Input
                        value={exampleValues[v] || ""}
                        onChange={(e) =>
                          setExampleValues((prev) => ({ ...prev, [v]: e.target.value }))
                        }
                        placeholder={`Sample for {{${v}}}`}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1 text-xs">
            <label className="font-semibold text-foreground">Footer Text (Optional)</label>
            <Input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="e.g. Reply STOP to opt out"
              maxLength={60}
              className="h-9 text-xs"
            />
          </div>

          {/* Interactive Buttons */}
          <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/60 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                Interactive Buttons ({buttons.length}/3)
              </span>
              <div className="flex gap-1.5">
                {(["QUICK_REPLY", "URL", "PHONE_NUMBER"] as const).map((bType) => (
                  <button
                    key={bType}
                    type="button"
                    disabled={buttons.length >= 3}
                    onClick={() =>
                      setButtons((prev) => [
                        ...prev,
                        {
                          type: bType,
                          text:
                            bType === "QUICK_REPLY"
                              ? "Interested"
                              : bType === "URL"
                              ? "Visit Portal"
                              : "Call Counselor",
                          url: bType === "URL" ? "https://dreamdesk.in" : undefined,
                          phone_number: bType === "PHONE_NUMBER" ? "+919800000000" : undefined,
                        },
                      ])
                    }
                    className="px-2 py-1 rounded-md border border-border bg-background hover:bg-muted text-[10px] font-semibold cursor-pointer disabled:opacity-40"
                  >
                    + {bType.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {buttons.map((b, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 bg-background p-2 rounded-lg border border-border/60">
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {b.type}
                </Badge>
                <Input
                  value={b.text}
                  onChange={(e) =>
                    setButtons((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, text: e.target.value } : item))
                    )
                  }
                  placeholder="Button text"
                  className="h-7 text-xs flex-1 min-w-[120px]"
                />
                {b.type === "URL" && (
                  <Input
                    value={b.url || ""}
                    onChange={(e) =>
                      setButtons((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, url: e.target.value } : item))
                      )
                    }
                    placeholder="https://..."
                    className="h-7 text-xs flex-1 min-w-[160px]"
                  />
                )}
                {b.type === "PHONE_NUMBER" && (
                  <Input
                    value={b.phone_number || ""}
                    onChange={(e) =>
                      setButtons((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, phone_number: e.target.value } : item
                        )
                      )
                    }
                    placeholder="+91..."
                    className="h-7 text-xs w-36"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setButtons((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-destructive p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="h-9 px-5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{submitting ? "Submitting to Meta..." : "Submit Template to Meta / Kapso"}</span>
          </Button>
        </form>

        {/* Live WhatsApp Phone Preview */}
        <div className="lg:col-span-4 bg-card border border-border/80 rounded-2xl p-4 space-y-3 shadow-2xs">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Live WhatsApp Preview
          </div>
          <WhatsAppTemplateBubblePreview
            headerType={headerType}
            headerContent={headerType === "TEXT" ? headerText : headerHandle}
            bodyText={bodyText}
            footerText={footerText}
            buttons={buttons}
            variableValues={exampleValues}
            templateName={name}
            category={category}
            language={language}
          />
        </div>
      </div>

      {/* Synced & Submitted Templates List */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              Meta / Kapso Templates ({filteredTemplates.length})
            </span>
            <div className="flex items-center gap-1">
              {["ALL", "APPROVED", "PENDING", "REJECTED"].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                    statusFilter === st
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={syncing}
            onClick={handleSync}
            className="h-8 text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Syncing..." : "Sync Status from Kapso"}</span>
          </Button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No templates found. Submit a new template above or click Sync Status from Kapso.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTemplates.map((t) => {
              const st = t.status || "APPROVED";
              return (
                <div
                  key={t.id}
                  className="p-3.5 rounded-xl border border-border/70 bg-muted/15 flex flex-col justify-between gap-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-foreground break-all">
                        {t.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-bold shrink-0 ${STATUS_BADGE[st] || ""}`}
                      >
                        {st === "APPROVED" && <CheckCircle2 className="w-2.5 h-2.5 mr-1" />}
                        {st === "PENDING" && <Clock className="w-2.5 h-2.5 mr-1" />}
                        {st === "REJECTED" && <XCircle className="w-2.5 h-2.5 mr-1" />}
                        {st}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">
                        {t.category}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {t.language || "en_US"}
                      </Badge>
                      {t.header_type && t.header_type !== "NONE" && (
                        <Badge variant="outline" className="text-[9px] text-indigo-600">
                          {t.header_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 pt-1">
                      {t.template_body}
                    </p>
                    {t.rejected_reason && (
                      <p className="text-[10px] text-rose-600 font-medium">
                        Reason: {t.rejected_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-end pt-2 border-t border-border/50">
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      className="text-[11px] text-destructive hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
