"use client";

import React, { useState, useEffect, useMemo } from "react";
import { WhatsAppTemplate } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Plus,
  Search,
  Pencil,
  Trash2,
  CheckCircle2,
  Sparkles,
  Star,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Eye,
  Layers,
  Send,
} from "lucide-react";

const PLACEHOLDER_TOKENS = [
  { token: "{name}", label: "Student Name", sample: "Aarav Sharma" },
  { token: "{stream}", label: "Academic Stream", sample: "B.Tech Computer Science" },
  { token: "{school}", label: "Previous School", sample: "Delhi Public School" },
  { token: "{counselor_name}", label: "Counselor Name", sample: "Priya Sharma" },
  { token: "{callback_at}", label: "Follow-up Time", sample: "Tomorrow at 4:00 PM" },
  { token: "{lead_code}", label: "Lead ID Code", sample: "DDM-0001" },
];

export function WhatsAppTemplatesWorkspace() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Editor Dialog state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Information");
  const [formBody, setFormBody] = useState("");
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Copy feedback state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/whatsapp-templates");
      const data = await res.json();
      if (Array.isArray(data)) {
        setTemplates(data);
      }
    } catch (err) {
      console.error("Failed to load WhatsApp templates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return ["All", ...Array.from(set)];
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.template_body.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === "All" ||
        (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());

      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormCategory("Information");
    setFormBody("");
    setFormIsDefault(templates.length === 0);
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (t: WhatsAppTemplate) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormCategory(t.category || "Information");
    setFormBody(t.template_body);
    setFormIsDefault(Boolean(t.is_default));
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsEditorOpen(true);
  };

  const handleInsertToken = (token: string) => {
    setFormBody((prev) => `${prev} ${token} `);
  };

  // Render live preview with sample variables
  const previewText = useMemo(() => {
    let text = formBody;
    PLACEHOLDER_TOKENS.forEach(({ token, sample }) => {
      text = text.replaceAll(token, sample);
    });
    return text;
  }, [formBody]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formBody.trim()) {
      setErrorMsg("Please provide both a template name and message body.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const isNew = !editingTemplate;
      const method = isNew ? "POST" : "PUT";
      const payload: any = {
        name: formName.trim(),
        category: formCategory.trim(),
        template_body: formBody.trim(),
        is_default: formIsDefault ? 1 : 0,
      };

      if (!isNew && editingTemplate) {
        payload.id = editingTemplate.id;
      }

      const res = await fetch("/api/whatsapp-templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save WhatsApp template");

      await fetchTemplates();
      setIsEditorOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (t: WhatsAppTemplate) => {
    try {
      const res = await fetch("/api/whatsapp-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: t.id,
          name: t.name,
          category: t.category,
          template_body: t.template_body,
          is_default: 1,
        }),
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch (err) {
      console.error("Failed to set default template:", err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete the template "${name}"?`)) return;

    try {
      const res = await fetch(`/api/whatsapp-templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchTemplates();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete template");
      }
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  const handleCopyBody = (id: string, body: string) => {
    navigator.clipboard.writeText(body);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/80 p-5 rounded-2xl shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                WhatsApp Template Studio
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                  {templates.length} Active Templates
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Standardize admissions counseling messages with dynamic 1-click token personalization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTemplates}
            disabled={loading}
            className="h-9 text-xs gap-1.5 border-border/80 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-9 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Template</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by name, keyword or token..."
            className="pl-9 h-9 text-xs bg-background border-border/80 rounded-lg"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white font-semibold shadow-2xs"
                  : "bg-background border border-border/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-muted/40 animate-pulse border border-border/60" />
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-border/80">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">No WhatsApp templates found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {searchQuery
              ? "Try adjusting your search query or category filter."
              : "Create your first outreach template to streamline WhatsApp conversations for admissions counseling."}
          </p>
          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="mt-4 h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Template</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((tpl) => (
            <Card
              key={tpl.id}
              className={`flex flex-col border transition-all duration-200 hover:shadow-md ${
                tpl.is_default ? "border-emerald-500/40 ring-1 ring-emerald-500/20 bg-emerald-500/[0.02]" : "border-border/80"
              }`}
            >
              <CardHeader className="p-4 pb-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px] font-semibold bg-muted/60 text-muted-foreground">
                    {tpl.category || "General"}
                  </Badge>

                  <div className="flex items-center gap-1">
                    {tpl.is_default ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        <Star className="w-3 h-3 fill-emerald-600 dark:fill-emerald-400" />
                        <span>Default</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(tpl)}
                        className="text-[10px] font-medium text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 px-2 py-0.5 rounded-full border border-border/60 transition-colors cursor-pointer"
                        title="Set as Default outreach template"
                      >
                        Set Default
                      </button>
                    )}
                  </div>
                </div>

                <CardTitle className="text-sm font-bold text-foreground tracking-tight leading-snug">
                  {tpl.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 pt-1 flex-1 flex flex-col justify-between space-y-3">
                {/* Template Content Box */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-xs text-foreground font-mono whitespace-pre-wrap line-clamp-6 leading-relaxed relative group">
                  {tpl.template_body}
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <button
                    onClick={() => handleCopyBody(tpl.id, tpl.template_body)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Copy template text"
                  >
                    {copiedId === tpl.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(tpl)}
                      className="h-8 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tpl.id, tpl.name)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Delete Template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ===================== CREATE / EDIT MODAL ===================== */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl">
          <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-emerald-600/10 via-emerald-500/5 to-transparent border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {editingTemplate ? "Edit WhatsApp Template" : "Create New WhatsApp Template"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Configure template metadata, dynamic tokens, and student messaging bodies.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="p-5 space-y-4">
            {errorMsg && (
              <div className="p-2.5 rounded-xl border text-xs flex items-center gap-2 bg-destructive/10 border-destructive/20 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Template Title & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Template Name</label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Admission Prospectus Brochure"
                  className="h-8 text-xs bg-background"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Category</label>
                <Input
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Information, Counseling, Follow-up"
                  className="h-8 text-xs bg-background"
                  required
                />
              </div>
            </div>

            {/* Default Checkbox */}
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formIsDefault}
                onChange={(e) => setFormIsDefault(e.target.checked)}
                className="rounded border-border text-emerald-600 focus:ring-emerald-500"
              />
              <span className="font-medium">Set as Default Outreach Template</span>
              <span className="text-[10px] text-muted-foreground">(Pre-selected when messaging students)</span>
            </label>

            {/* Template Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Message Body</label>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {formBody.length} characters
                </span>
              </div>

              <Textarea
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Hi {name}, thanks for your interest in the {stream} program..."
                className="text-xs font-mono min-h-[120px] bg-background resize-y leading-relaxed"
                required
              />
            </div>

            {/* Dynamic Placeholder Insertion Chips */}
            <div className="space-y-1.5 bg-muted/40 p-3 rounded-xl border border-border/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                Click to Insert Dynamic Student Tokens
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDER_TOKENS.map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => handleInsertToken(token)}
                    className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-background border border-border/80 text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 transition-colors cursor-pointer"
                    title={`Insert ${label}`}
                  >
                    <Plus className="w-3 h-3 text-emerald-600" />
                    <span>{token}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Student Preview Box */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Eye className="w-3 h-3 text-emerald-600" />
                <span>Live Student Preview (with sample data)</span>
              </span>
              <div className="p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 text-xs text-foreground font-sans whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                {previewText || <span className="text-muted-foreground italic">Type a template body to see the live preview...</span>}
              </div>
            </div>

            {/* Modal Footer */}
            <DialogFooter className="pt-2 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditorOpen(false)}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="h-8 text-xs font-bold px-4 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              >
                {submitting ? "Saving..." : editingTemplate ? "Save Changes" : "Create Template"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
