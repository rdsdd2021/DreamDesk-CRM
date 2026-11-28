"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  User,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppSettings,
  WhatsAppTemplate,
} from "@/types/crm";
import { MetaKapsoTemplateStudio } from "@/components/crm/MetaKapsoTemplateStudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { WhatsAppTemplateBubblePreview } from "@/components/crm/WhatsAppTemplateBubblePreview";
import { prepareMediaForKapso } from "@/lib/utils/imageCompress";
import {
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Image as ImageIcon,
  Inbox,
  KeyRound,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  Phone,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";

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

interface WhatsAppInboxWorkspaceProps {
  currentUser: User | null;
  users: User[];
  onShowToast?: (text: string, type: "success" | "error") => void;
  onOpenLeadById?: (leadId: number) => void;
}

export function WhatsAppInboxWorkspace({
  currentUser,
  users,
  onShowToast,
  onOpenLeadById,
}: WhatsAppInboxWorkspaceProps) {
  const isAdmin = currentUser?.role === "admin";
  const canManageTemplates = ["admin", "team_lead"].includes(currentUser?.role || "");
  const [activeTab, setActiveTab] = useState<"inbox" | "templates" | "setup">("inbox");

  // Inbox state
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [convFilter, setConvFilter] = useState<"all" | "unread" | "open" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [activeConv, setActiveConv] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // Composer & Rich Template state
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateVarValues, setTemplateVarValues] = useState<Record<string, string>>({});
  const [attachedMedia, setAttachedMedia] = useState<{
    type: "image" | "document" | "video" | "audio";
    id?: string;
    url?: string;
    name: string;
  } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Kapso Settings state
  const [settings, setSettings] = useState<WhatsAppSettings>({
    kapso_api_key: "",
    phone_number_id: "",
    business_account_id: "",
    webhook_secret: "",
    display_phone_number: "",
    is_connected: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const lastScrolledKeyRef = React.useRef<string>("");

  useEffect(() => {
    const lastId = messages.length > 0 ? messages[messages.length - 1]?.id : "empty";
    const scrollKey = `${selectedConvId || "none"}:${lastId}`;
    if (scrollKey !== lastScrolledKeyRef.current) {
      lastScrolledKeyRef.current = scrollKey;
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedConvId]);

  const loadConversations = useCallback(async () => {
    try {
      const sp = new URLSearchParams();
      sp.set("filter", convFilter);
      if (search.trim()) sp.set("search", search.trim());
      const res = await fetch(`/api/whatsapp/conversations?${sp.toString()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } finally {
      setLoadingConvs(false);
    }
  }, [convFilter, search]);

  const loadThread = useCallback(async (convId: number, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/whatsapp/conversations/${convId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const nextConv = data.conversation || null;
        const nextMsgs: WhatsAppMessage[] = data.messages || [];
        setActiveConv((prev) =>
          prev &&
          nextConv &&
          prev.id === nextConv.id &&
          prev.last_inbound_at === nextConv.last_inbound_at &&
          prev.status === nextConv.status &&
          prev.assigned_to === nextConv.assigned_to &&
          prev.lead_id === nextConv.lead_id
            ? prev
            : nextConv
        );
        setMessages((prev) => {
          if (
            prev.length === nextMsgs.length &&
            prev.every(
              (m, i) =>
                m.id === nextMsgs[i]?.id &&
                m.status === nextMsgs[i]?.status &&
                m.error_message === nextMsgs[i]?.error_message
            )
          ) {
            return prev;
          }
          return nextMsgs;
        });
        setConversations((prev) => {
          const target = prev.find((c) => c.id === convId);
          if (!target || target.unread_count === 0) return prev;
          return prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c));
        });
      }
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  }, []);

  const loadSettingsAndTemplates = useCallback(async () => {
    try {
      const [tplRes, setRes] = await Promise.all([
        fetch("/api/whatsapp/templates?approved=1", { cache: "no-store" }),
        canManageTemplates
          ? fetch("/api/whatsapp/settings", { cache: "no-store" })
          : Promise.resolve(null),
      ]);
      if (tplRes.ok) {
        const tData = await tplRes.json();
        setTemplates(tData.templates || []);
      }
      if (setRes && setRes.ok) {
        const sData = await setRes.json();
        if (sData?.settings) setSettings(sData.settings);
      }
    } catch {
      // ignore
    }
  }, [canManageTemplates]);

  useEffect(() => {
    loadConversations();
    const timer = setInterval(loadConversations, 5000);
    return () => clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    loadSettingsAndTemplates();
  }, [loadSettingsAndTemplates]);

  useEffect(() => {
    if (!selectedConvId) return;
    loadThread(selectedConvId, false);
    setSelectedTemplate(null);
    setAttachedMedia(null);
    const threadTimer = setInterval(() => loadThread(selectedConvId, true), 4000);
    return () => clearInterval(threadTimer);
  }, [selectedConvId, loadThread]);

  const handleSyncHistory = async () => {
    setSyncingHistory(true);
    try {
      const res = await fetch("/api/whatsapp/history/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "History sync failed");
      onShowToast?.(
        `Synced ${data.conversationsSynced || 0} conversation(s) & ${data.messagesSynced || 0} message(s)`,
        "success"
      );
      await loadConversations();
      if (selectedConvId) await loadThread(selectedConvId, true);
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to sync Kapso chat history", "error");
    } finally {
      setSyncingHistory(false);
    }
  };

  const handleUploadMedia = async (rawFile: File) => {
    setUploadingMedia(true);
    try {
      const { file, compressed } = await prepareMediaForKapso(rawFile);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/whatsapp/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const type: "image" | "video" | "audio" | "document" = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
        ? "audio"
        : "document";
      setAttachedMedia({
        type,
        id: data.id,
        url: data.url || (data.id ? `/api/whatsapp/media?id=${encodeURIComponent(data.id)}` : undefined),
        name: file.name,
      });
      onShowToast?.(
        compressed
          ? `Compressed & attached ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`
          : `Attached ${file.name}`,
        "success"
      );
    } catch (err: any) {
      onShowToast?.(err?.message || "Media upload failed", "error");
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleSelectTemplate = (tpl: WhatsAppTemplate) => {
    setSelectedTemplate(tpl);
    const defaults: Record<string, string> = {};
    const vars = tpl.variables || [];
    for (const v of vars) {
      const k = v.name.toLowerCase();
      if (k.includes("name") && !k.includes("counselor")) {
        defaults[v.name] = activeConv?.contact_name || activeConv?.lead_name || "Student";
      } else if (k.includes("counselor")) {
        defaults[v.name] = currentUser?.name || "Counselor";
      } else if (k.includes("code") || k.includes("id")) {
        defaults[v.name] = activeConv?.lead_code || "";
      } else {
        defaults[v.name] = v.example || "";
      }
    }
    setTemplateVarValues(defaults);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv) return;

    setSending(true);
    try {
      let payload: any;
      if (selectedTemplate) {
        let renderedBody = selectedTemplate.template_body;
        const vars = (selectedTemplate.variables || []).map((v) => {
          const val = templateVarValues[v.name] || "";
          renderedBody = renderedBody.split(`{{${v.name}}}`).join(val);
          return { name: v.name, value: val };
        });
        payload = {
          conversation_id: activeConv.id,
          lead_id: activeConv.lead_id || undefined,
          message_type: "template",
          template_name: selectedTemplate.name,
          language_code: selectedTemplate.language || "en_US",
          parameter_format: selectedTemplate.parameter_format || "NAMED",
          template_variables: vars,
          header_media_type: selectedTemplate.header_type,
          media_id: attachedMedia?.id,
          media_url: attachedMedia?.url,
          body: renderedBody,
        };
      } else if (attachedMedia) {
        payload = {
          conversation_id: activeConv.id,
          lead_id: activeConv.lead_id || undefined,
          message_type: attachedMedia.type,
          media_id: attachedMedia.id,
          media_url: attachedMedia.url,
          body: replyText.trim(),
        };
      } else {
        if (!replyText.trim()) return;
        payload = {
          conversation_id: activeConv.id,
          lead_id: activeConv.lead_id || undefined,
          message_type: "text",
          body: replyText.trim(),
        };
      }

      // Optimistic instant message bubble
      const tempId = -Date.now();
      const optimisticMsg: WhatsAppMessage = {
        id: tempId,
        conversation_id: activeConv.id,
        lead_id: activeConv.lead_id || null,
        direction: "outbound",
        message_type: payload.message_type || "text",
        body: payload.body,
        template_name: payload.template_name || null,
        media_url: payload.media_url || null,
        status: "sending" as any,
        sent_by_name: currentUser?.name || "You",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setReplyText("");
      setSelectedTemplate(null);
      setAttachedMedia(null);

      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m)));
        throw new Error(data.error || "Failed to send message");
      }

      if (data.message) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? data.message : m)));
      }
      loadConversations();
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to send WhatsApp message", "error");
    } finally {
      setSending(false);
    }
  };

  const handleToggleConvStatus = async () => {
    if (!activeConv) return;
    const next = activeConv.status === "resolved" ? "open" : "resolved";
    const res = await fetch(`/api/whatsapp/conversations/${activeConv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setActiveConv((prev) => (prev ? { ...prev, status: next } : prev));
      setConversations((prev) => prev.map((c) => (c.id === activeConv.id ? { ...c, status: next } : c)));
      onShowToast?.(`Conversation marked ${next}`, "success");
    }
  };

  const handleAssignConv = async (userId: string) => {
    if (!activeConv) return;
    const res = await fetch(`/api/whatsapp/conversations/${activeConv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: userId || null }),
    });
    if (res.ok) {
      setActiveConv((prev) => (prev ? { ...prev, assigned_to: userId || null } : prev));
      loadConversations();
      onShowToast?.("Conversation assignment updated", "success");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save Kapso settings");
      if (data.settings) setSettings(data.settings);
      onShowToast?.("Kapso WhatsApp settings saved", "success");
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    try {
      const res = await fetch("/api/whatsapp/settings", { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Connection test failed");
      onShowToast?.(data.message || "Connected to Kapso!", "success");
      loadSettingsAndTemplates();
    } catch (err: any) {
      onShowToast?.(err?.message || "Connection test failed", "error");
    } finally {
      setTestingConn(false);
    }
  };

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "/api/whatsapp/webhook";

  return (
    <div
      className={
        activeTab === "inbox"
          ? "h-full flex flex-col bg-card overflow-hidden"
          : "p-4 sm:p-6 max-w-7xl mx-auto space-y-4 overflow-y-auto h-full"
      }
    >
      {/* Top Sub-Navigation */}
      <div
        className={
          activeTab === "inbox"
            ? "flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 border-b border-border/70 bg-card shrink-0"
            : "flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        }
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600/15 text-emerald-600 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Integrated WhatsApp (Kapso)
              </h2>
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold ${
                  settings.is_connected
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                }`}
              >
                {settings.is_connected ? "● Kapso Connected" : "Setup Required"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {canManageTemplates
                ? "Two-way WhatsApp Business inbox, Meta template submissions, and full WABA sync."
                : "View full WhatsApp chat history and reply directly to your assigned leads."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "inbox" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={syncingHistory}
              onClick={handleSyncHistory}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingHistory ? "animate-spin" : ""}`} />
              <span>{syncingHistory ? "Syncing..." : "Sync Kapso History"}</span>
            </Button>
          )}
          {isAdmin && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                if (!confirm("Clear all cached WhatsApp chats & messages from local CRM cache? You can re-sync from Kapso right after.")) return;
                const res = await fetch("/api/whatsapp/conversations", { method: "DELETE" });
                if (res.ok) {
                  setConversations([]);
                  setSelectedConvId(null);
                  setActiveConv(null);
                  setMessages([]);
                  onShowToast?.("Cleared stale WhatsApp cache. Click Sync Kapso History to pull fresh chats.", "success");
                }
              }}
              className="h-8 text-xs text-rose-600 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
            >
              Purge Stale Chats
            </Button>
          )}

          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("inbox")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === "inbox" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Inbox</span>
            </button>
            {canManageTemplates && (
              <button
                type="button"
                onClick={() => setActiveTab("templates")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === "templates" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Meta Templates</span>
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab("setup")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  activeTab === "setup" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Kapso Setup</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TAB 1: 2-PANE INBOX */}
      {activeTab === "inbox" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 bg-card overflow-hidden flex-1 min-h-0">
          {/* Left Pane: Conversation List */}
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border/70 flex flex-col min-h-0">
            <div className="p-3 border-b border-border/60 space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, phone, or lead ID..."
                  className="h-8 pl-8 text-xs rounded-lg"
                />
              </div>
              <div className="flex items-center gap-1">
                {(["all", "unread", "open", "resolved"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setConvFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize cursor-pointer ${
                      convFilter === f
                        ? "bg-emerald-600 text-white"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={loadConversations}
                  className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                  title="Refresh conversations"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingConvs ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/40 min-h-0">
              {conversations.length === 0 ? (
                <div className="py-12 px-4 text-center text-xs text-muted-foreground space-y-1">
                  <MessageSquare className="w-7 h-7 mx-auto opacity-30" />
                  <p className="font-semibold text-foreground">No conversations yet</p>
                  <p>
                    {canManageTemplates
                      ? "Send a WhatsApp message from any lead or click Sync Kapso History."
                      : "Conversations for your assigned leads will appear here."}
                  </p>
                </div>
              ) : (
                conversations.map((c) => {
                  const selected = c.id === selectedConvId;
                  const is24h = Boolean(
                    c.last_inbound_at &&
                      Date.now() - parseWaTimestamp(c.last_inbound_at).getTime() < 24 * 60 * 60 * 1000
                  );
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedConvId(c.id)}
                      className={`w-full text-left px-3.5 py-3 transition-colors cursor-pointer flex items-start gap-2.5 border-l-2 ${
                        selected
                          ? "bg-emerald-500/10 border-l-emerald-600"
                          : "border-l-transparent hover:bg-muted/40"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center">
                          {(c.contact_name || c.lead_name || "W").charAt(0).toUpperCase()}
                        </div>
                        <span
                          title={is24h ? "24h window open" : "Outside 24h window (Template required)"}
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                            is24h ? "bg-emerald-500" : "bg-amber-400"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-foreground truncate">
                            {c.contact_name || c.lead_name || c.phone_number}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                            {parseWaTimestamp(c.last_message_at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {c.last_message_direction === "outbound" ? "You: " : ""}
                          {c.last_message_preview || c.phone_number}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {c.lead_code ? (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">
                              {c.lead_code}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-500/10 text-amber-700 border-amber-500/30">
                              Unlinked
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 px-1.5 capitalize ${
                              c.status === "resolved" ? "text-muted-foreground" : "text-emerald-600 border-emerald-500/30"
                            }`}
                          >
                            {c.status}
                          </Badge>
                          {c.unread_count > 0 && (
                            <Badge className="text-[9px] h-4 px-1.5 bg-emerald-600 text-white ml-auto">
                              {c.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Pane: Thread & Rich Composer */}
          <div className="lg:col-span-8 flex flex-col min-h-0 bg-[#efeae2]/45 dark:bg-zinc-950/60">
            {!activeConv ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground space-y-2">
                <MessageSquare className="w-10 h-10 opacity-25" />
                <p className="text-sm font-semibold text-foreground">Select a WhatsApp Conversation</p>
                <p className="max-w-sm">
                  View complete message history, send approved Meta/Kapso templates with dynamic variables, or attach media.
                </p>
              </div>
            ) : (
              <>
                <div className="p-3.5 bg-card border-b border-border/70 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {activeConv.contact_name || activeConv.lead_name || activeConv.phone_number}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {activeConv.phone_number}
                      </span>
                    </div>
                    {activeConv.lead_id && onOpenLeadById ? (
                      <button
                        type="button"
                        onClick={() => onOpenLeadById(activeConv.lead_id!)}
                        className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                      >
                        Open Lead Profile ({activeConv.lead_code || `#${activeConv.lead_id}`}) →
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30">
                          Not in CRM
                        </Badge>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch(`/api/whatsapp/conversations/${activeConv.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "create_lead" }),
                            });
                            const data = await res.json();
                            if (res.ok) {
                              onShowToast?.(`Saved as Lead ${data.leadCode}`, "success");
                              await loadConversations();
                              await loadThread(activeConv.id, true);
                            } else {
                              onShowToast?.(data.error || "Failed to save lead", "error");
                            }
                          }}
                          className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                        >
                          + Save as Lead
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const lastIn =
                        activeConv.last_inbound_at ||
                        messages.filter((m) => m.direction === "inbound").slice(-1)[0]?.created_at;
                      const diffMs = lastIn ? Date.now() - parseWaTimestamp(lastIn).getTime() : Infinity;
                      const is24hOpen = diffMs < 24 * 60 * 60 * 1000;
                      const hrsLeft = is24hOpen ? Math.max(0, Math.floor((24 * 3600000 - diffMs) / 3600000)) : 0;
                      const minsLeft = is24hOpen ? Math.max(0, Math.floor(((24 * 3600000 - diffMs) % 3600000) / 60000)) : 0;
                      return (
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold gap-1 ${
                            is24hOpen
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {is24hOpen ? <Clock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          <span>{is24hOpen ? `24h Open · ${hrsLeft}h ${minsLeft}m` : "Template Only"}</span>
                        </Badge>
                      );
                    })()}
                    {canManageTemplates && (
                      <select
                        value={activeConv.assigned_to || ""}
                        onChange={(e) => handleAssignConv(e.target.value)}
                        className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleToggleConvStatus}
                      className="h-8 text-xs gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{activeConv.status === "resolved" ? "Reopen" : "Resolve"}</span>
                    </Button>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 min-h-0 p-4 space-y-2.5 overflow-y-auto">
                  {loadingMsgs && messages.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
                      Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="py-10 text-center text-xs text-muted-foreground">
                      No messages in this thread yet. Send a message or approved template below.
                    </div>
                  ) : (
                    <>
                      {messages.map((m, idx) => {
                        const isOutbound = m.direction === "outbound";
                        const msgDate = parseWaTimestamp(m.created_at);
                        const curDay = msgDate.toDateString();
                        const prevDay = idx > 0 ? parseWaTimestamp(messages[idx - 1].created_at).toDateString() : null;
                        const showDatePill = curDay !== prevDay;
                        const todayStr = new Date().toDateString();
                        const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
                        const dateLabel =
                          curDay === todayStr
                            ? "Today"
                            : curDay === yesterdayStr
                            ? "Yesterday"
                            : msgDate.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              });

                        return (
                          <React.Fragment key={m.id}>
                            {showDatePill && (
                              <div className="flex justify-center py-1">
                                <span className="px-2.5 py-0.5 rounded-full bg-card/90 border border-border/60 text-[10px] font-semibold text-muted-foreground shadow-2xs">
                                  {dateLabel}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                              <div
                                title={m.status === "failed" && m.error_message ? m.error_message : undefined}
                                className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-xs shadow-xs space-y-1 ${
                                  isOutbound
                                    ? m.status === "failed"
                                      ? "bg-rose-600 text-white rounded-br-xs"
                                      : "bg-emerald-600 text-white rounded-br-xs"
                                    : "bg-card border border-border/80 text-foreground rounded-bl-xs"
                                }`}
                              >
                                {m.template_name && (
                                  <div className="text-[10px] font-mono opacity-80">
                                    Template: {m.template_name}
                                  </div>
                                )}
                                {m.media_url && m.message_type === "image" && (
                                  <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="block">
                                    <img
                                      src={m.media_url}
                                      alt="Attachment"
                                      className="rounded-lg max-h-52 object-cover border border-black/10"
                                    />
                                  </a>
                                )}
                                {m.media_url && m.message_type === "video" && (
                                  <video
                                    src={m.media_url}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="rounded-lg max-h-56 w-full bg-black/90 border border-black/10"
                                  />
                                )}
                                {m.media_url &&
                                  (m.message_type === "audio" ||
                                    (m.message_type === "document" &&
                                      /\.(mp3|ogg|wav|aac|m4a)(\b|$)/i.test(`${m.media_url} ${m.body || ""}`))) && (
                                    <audio
                                      src={m.media_url}
                                      controls
                                      preload="metadata"
                                      className="w-full min-w-[220px] max-w-[300px] h-9"
                                    />
                                  )}
                                {m.media_url &&
                                  m.message_type === "document" &&
                                  !/\.(mp3|ogg|wav|aac|m4a)(\b|$)/i.test(`${m.media_url} ${m.body || ""}`) && (
                                    <a
                                      href={m.media_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium ${
                                        isOutbound
                                          ? "bg-black/15 border-white/20 text-white hover:bg-black/25"
                                          : "bg-muted/60 border-border text-foreground hover:bg-muted"
                                      }`}
                                    >
                                      <FileText className="w-4 h-4 shrink-0" />
                                      <span className="truncate">Open Document</span>
                                    </a>
                                  )}
                                {(() => {
                                  const cleaned = (m.body || "")
                                    .replace(/\s*(?:Image|Video|Audio|Document|Media|File)\s+attached\s*\([^)]*\)\s*\[Size:[^\]]*\]\s*URL:\s*\S+/gi, "")
                                    .replace(/^\[(?:image|video|audio|document):\s*[^\]]+\]\s*/i, "")
                                    .trim();
                                  if (!cleaned) {
                                    if (!m.media_url && m.body) {
                                      return <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>;
                                    }
                                    return null;
                                  }
                                  return <p className="whitespace-pre-wrap leading-relaxed">{cleaned}</p>;
                                })()}
                                {m.status === "failed" && m.error_message && (
                                  <div className="text-[10px] text-rose-100 bg-black/20 px-2 py-0.5 rounded">
                                    Failed: {m.error_message}
                                  </div>
                                )}
                                <div
                                  className={`flex items-center justify-end gap-1.5 text-[10px] ${
                                    isOutbound ? "text-emerald-100" : "text-muted-foreground"
                                  }`}
                                >
                                  {m.sent_by_name && isOutbound && <span>{m.sent_by_name} ·</span>}
                                  <span>
                                    {msgDate.toLocaleTimeString("en-IN", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                  {isOutbound && (
                                    <>
                                      {(m.status as any) === "sending" && <Loader2 className="w-3 h-3 animate-spin" />}
                                      {m.status === "read" && <CheckCheck className="w-3 h-3 text-sky-200" />}
                                      {m.status === "delivered" && <CheckCheck className="w-3 h-3" />}
                                      {m.status === "sent" && <Check className="w-3 h-3" />}
                                      {m.status === "failed" && <XCircle className="w-3 h-3 text-rose-200" />}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Rich Reply Composer */}
                <form
                  onSubmit={handleSendReply}
                  className="p-3 bg-card border-t border-border/70 space-y-2"
                >
                  {/* Approved Meta Templates Strip */}
                  {templates.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <span className="text-[10px] font-semibold text-muted-foreground shrink-0">
                        Approved Templates:
                      </span>
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTemplate(t)}
                          className={`text-[11px] px-2 py-0.5 rounded-md border shrink-0 cursor-pointer ${
                            selectedTemplate?.id === t.id
                              ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                              : "border-border bg-muted/40 hover:bg-muted text-foreground"
                          }`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected Template Variable Auto-fill Card */}
                  {selectedTemplate && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2 text-xs max-h-[240px] overflow-y-auto">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          Sending Template: <code className="font-mono">{selectedTemplate.name}</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTemplate(null)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
                        {(selectedTemplate.variables || []).length > 0 && (
                          <div className="lg:col-span-6 space-y-1.5">
                            {(selectedTemplate.variables || []).map((v) => {
                              const inboxSuggestions = [
                                { label: "Name", val: activeConv?.lead_name || activeConv?.contact_name || "" },
                                { label: "Code", val: activeConv?.lead_code || "" },
                                { label: "Phone", val: activeConv?.phone_number || "" },
                                { label: "Counselor", val: currentUser?.name || "" },
                              ].filter((s) => s.val);
                              return (
                                <div key={v.name} className="flex items-center gap-1.5">
                                  <span className="w-11 shrink-0 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                                    {`{{${v.name}}}`}
                                  </span>
                                  <Input
                                    value={templateVarValues[v.name] || ""}
                                    onChange={(e) =>
                                      setTemplateVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                                    }
                                    placeholder={`{{${v.name}}}`}
                                    className="h-7 text-xs bg-background flex-1 min-w-0"
                                  />
                                  {inboxSuggestions.length > 0 && (
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          setTemplateVarValues((prev) => ({ ...prev, [v.name]: e.target.value }));
                                        }
                                      }}
                                      className="h-7 max-w-[88px] rounded-md border border-border bg-background px-1 text-[10px] text-muted-foreground cursor-pointer"
                                    >
                                      <option value="">Lead…</option>
                                      {inboxSuggestions.map((s) => (
                                        <option key={s.label} value={s.val}>
                                          {s.label}: {s.val.slice(0, 18)}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className={(selectedTemplate.variables || []).length > 0 ? "lg:col-span-6" : "lg:col-span-12"}>
                          <WhatsAppTemplateBubblePreview
                            headerType={selectedTemplate.header_type}
                            headerContent={selectedTemplate.header_content}
                            bodyText={selectedTemplate.template_body}
                            footerText={selectedTemplate.footer_text}
                            buttons={selectedTemplate.buttons}
                            variableValues={templateVarValues}
                            templateName={selectedTemplate.name}
                            category={selectedTemplate.category}
                            language={selectedTemplate.language}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Attached Media Pill */}
                  {attachedMedia && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border text-xs">
                      {attachedMedia.type === "image" ? (
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span className="truncate max-w-[200px]">{attachedMedia.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachedMedia(null)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <label
                      className="h-9 w-9 rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center cursor-pointer shrink-0"
                      title="Attach Image / Video / PDF via Kapso Media"
                    >
                      {uploadingMedia ? (
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      ) : (
                        <Paperclip className="w-4 h-4 text-muted-foreground" />
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadMedia(f);
                        }}
                      />
                    </label>
                    {!selectedTemplate && (() => {
                      const activeConv = conversations.find((c) => c.id === selectedConvId);
                      const lastIn =
                        activeConv?.last_inbound_at ||
                        messages.filter((m) => m.direction === "inbound").slice(-1)[0]?.created_at;
                      const is24hOpen = Boolean(
                        lastIn && Date.now() - parseWaTimestamp(lastIn).getTime() < 24 * 60 * 60 * 1000
                      );
                      return is24hOpen ? (
                        <Input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder={
                            attachedMedia
                              ? "Optional caption for attached media..."
                              : "Type a WhatsApp reply via Kapso..."
                          }
                          className="h-9 text-xs flex-1"
                        />
                      ) : (
                        <div className="h-9 px-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-[11px] flex items-center gap-2 flex-1 truncate">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            24h window closed — select an Approved Template above to message this lead.
                          </span>
                        </div>
                      );
                    })()}
                    <Button
                      type="submit"
                      disabled={sending || (!selectedTemplate && !attachedMedia && !replyText.trim())}
                      className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer ml-auto"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {sending
                          ? "Sending..."
                          : selectedTemplate
                          ? "Send Template"
                          : "Send"}
                      </span>
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: META / KAPSO TEMPLATE STUDIO */}
      {activeTab === "templates" && canManageTemplates && (
        <MetaKapsoTemplateStudio
          onShowToast={onShowToast}
          onTemplatesChanged={loadSettingsAndTemplates}
        />
      )}

      {/* TAB 3: KAPSO SETUP (ADMIN ONLY) */}
      {activeTab === "setup" && isAdmin && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-card border border-border/80 rounded-2xl p-5 space-y-4 max-w-2xl shadow-2xs"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-foreground">Kapso WhatsApp API Configuration</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={testingConn}
              onClick={handleTestConnection}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              {testingConn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-600" />}
              <span>Test Connection</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold text-foreground">Kapso API Key (X-API-Key) *</label>
              <Input
                value={settings.kapso_api_key}
                onChange={(e) => setSettings({ ...settings, kapso_api_key: e.target.value })}
                placeholder="Paste your Kapso Project API Key..."
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Phone Number ID *</label>
              <Input
                value={settings.phone_number_id}
                onChange={(e) => setSettings({ ...settings, phone_number_id: e.target.value })}
                placeholder="e.g. 123456789012345"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Business Account ID (WABA)</label>
              <Input
                value={settings.business_account_id}
                onChange={(e) => setSettings({ ...settings, business_account_id: e.target.value })}
                placeholder="For Meta Template submission & sync"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Display Phone Number</label>
              <Input
                value={settings.display_phone_number}
                onChange={(e) => setSettings({ ...settings, display_phone_number: e.target.value })}
                placeholder="+91 98XXXXXXXX"
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Webhook Secret Key</label>
              <Input
                value={settings.webhook_secret}
                onChange={(e) => setSettings({ ...settings, webhook_secret: e.target.value })}
                placeholder="Optional X-Webhook-Secret"
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5 text-xs">
            <div className="font-semibold text-foreground">Webhook Endpoint URL (Paste in Kapso Dashboard)</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 font-mono text-[11px] truncate">
                {webhookUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2000);
                }}
                className="h-8 text-xs gap-1 cursor-pointer"
              >
                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedWebhook ? "Copied" : "Copy"}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/whatsapp/settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "register_webhook", webhook_url: webhookUrl }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Webhook registration failed");
                    onShowToast?.(data.message || "Webhook registered with Kapso!", "success");
                  } catch (err: any) {
                    onShowToast?.(err?.message || "Failed to register webhook", "error");
                  }
                }}
                className="h-8 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shrink-0"
              >
                <span>Register with Kapso</span>
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={savingSettings}
            className="h-9 px-5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
          >
            {savingSettings ? "Saving..." : "Save Kapso Configuration"}
          </Button>
        </form>
      )}
    </div>
  );
}
