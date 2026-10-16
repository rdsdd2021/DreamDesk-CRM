"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Disposition, Campaign, LeadScoringPolicyConfig } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlaybookOutcomeModal } from "@/components/crm/PlaybookOutcomeModal";
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  RefreshCw,
  Edit2,
  Trash2,
  PhoneCall,
  Flame,
  XCircle,
  Sliders,
  Save,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PlaybookStudioWorkspaceProps {
  onFilterByDisposition?: (dispositionName: string) => void;
}

const STARTER_PLAYBOOKS = [
  {
    id: "general_college",
    title: "🎓 Undergrad & College Admissions",
    description: "Standard admissions cycle: Campus visits, parent consultations, scholarship queries, and document verification.",
    outcomes: [
      { name: "🎓 Admission Form Submitted", category: "positive", score: 100, requires_callback: 0, chips: ["Registration Fee Paid", "Documents Verified", "Provisional Issued"] },
      { name: "🏛️ Campus Visit Scheduled", category: "positive", score: 85, requires_callback: 1, chips: ["Weekend Tour", "Hostel Inspection", "Dean Meeting"] },
      { name: "🔥 Ready to Apply / High Intent", category: "positive", score: 75, requires_callback: 1, chips: ["Prospectus Reviewed", "Online Portal Help", "Scholarship Test"] },
      { name: "👨‍👩‍👧 Discussing with Parents", category: "neutral", score: 35, requires_callback: 1, chips: ["Evening Callback", "Father Reviewing Fees", "Parent Consultation"] },
      { name: "💰 Fee & Installment Inquiry", category: "neutral", score: 30, requires_callback: 1, chips: ["Education Loan", "Installment Plan", "Merit Waiver"] },
      { name: "📝 Awaiting 12th / CUET Results", category: "neutral", score: 25, requires_callback: 1, chips: ["Results Expected Next Week", "Mark Sheet Pending"] },
      { name: "📳 Ringing - No Response", category: "unreachable", score: 5, requires_callback: 1, chips: ["Attempt 1", "Attempt 2", "Evening Retry"] },
      { name: "📵 Switched Off / Busy", category: "unreachable", score: 5, requires_callback: 1, chips: ["Network Issue", "In Coaching Class"] },
      { name: "🏫 Enrolled in Another College", category: "negative", score: -50, requires_callback: 0, chips: ["State University", "Private College", "Govt Seat"] },
      { name: "🚫 Not Interested / Opt-Out", category: "negative", score: -30, requires_callback: 0, chips: ["Location Too Far", "Stream Mismatch", "Wrong Number"] },
    ],
  },
  {
    id: "engineering_stem",
    title: "⚙️ Engineering & B.Tech Admissions",
    description: "Tailored for STEM: JEE Mains / Advanced ranks, branch selection (CSE, AI/ML, ECE), and hostel availability.",
    outcomes: [
      { name: "🎓 Seat Confirmed & Token Paid", category: "positive", score: 100, requires_callback: 0, chips: ["CSE Branch Allocated", "AI/ML Seat Locked", "Fee Receipt Sent"] },
      { name: "🔥 Branch Counseling Requested", category: "positive", score: 80, requires_callback: 1, chips: ["Comparing CSE vs ECE", "Core Branch Inquiry", "Faculty Interaction"] },
      { name: "📝 Awaiting JEE / State Exam Rank", category: "neutral", score: 35, requires_callback: 1, chips: ["Counseling Round 1", "Rank Within Cutoff"] },
      { name: "🏢 Hostel & Lab Facility Inquiry", category: "neutral", score: 30, requires_callback: 1, chips: ["Hostel Accommodation", "Placement Record", "Campus Tour"] },
      { name: "📳 Unreachable (Auto-Retry)", category: "unreachable", score: 5, requires_callback: 1, chips: ["In Coaching", "Call Cut"] },
      { name: "🏫 Opted for IIT / NIT / Govt College", category: "negative", score: -50, requires_callback: 0, chips: ["Got Govt Seat", "Taking Drop Year"] },
    ],
  },
  {
    id: "mba_management",
    title: "💼 MBA & Post-Graduate Admissions",
    description: "Designed for business schools: CAT/MAT/GMAT percentiles, GD/PI rounds, and executive financing.",
    outcomes: [
      { name: "🎓 GD/PI Cleared & Offer Accepted", category: "positive", score: 100, requires_callback: 0, chips: ["Offer Letter Sent", "Deposit Received"] },
      { name: "🔥 Interview / GD Scheduled", category: "positive", score: 85, requires_callback: 1, chips: ["Virtual PI", "Campus GD", "Portfolio Review"] },
      { name: "💼 Work Experience Discussion", category: "neutral", score: 40, requires_callback: 1, chips: ["2+ Years Exp", "Sponsorship Letter", "Evening Batch"] },
      { name: "💰 Corporate Loan & EMI Inquiry", category: "neutral", score: 30, requires_callback: 1, chips: ["Bank Partner Loan", "Tax Benefit Inquirer"] },
      { name: "📳 No Answer / Office Hours", category: "unreachable", score: 5, requires_callback: 1, chips: ["In Meeting", "Weekend Callback"] },
      { name: "❌ Dropped / Ineligible Score", category: "negative", score: -40, requires_callback: 0, chips: ["Below 50% Cutoff", "Job Promotion Instead"] },
    ],
  },
];

export function PlaybookStudioWorkspace({ onFilterByDisposition }: PlaybookStudioWorkspaceProps) {
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTrayFilter, setActiveTrayFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState<Disposition | null>(null);

  // Template Loader State
  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scoring Settings State
  const [scoringConfig, setScoringConfig] = useState<LeadScoringPolicyConfig>({
    academic_weight: 40,
    disposition_weight: 60,
    attempt_penalty: 5,
    high_intent_threshold: 70,
    auto_recalculate_on_call: true,
  });
  const [isScoringExpanded, setIsScoringExpanded] = useState(false);
  const [savingScoring, setSavingScoring] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dispRes, campRes, scoreRes] = await Promise.all([
        fetch("/api/dispositions").then((r) => r.json()),
        fetch("/api/campaigns").then((r) => r.json()),
        fetch("/api/dispositions/scoring-config").then((r) => r.json()).catch(() => null),
      ]);

      if (Array.isArray(dispRes)) setDispositions(dispRes);
      if (Array.isArray(campRes)) setCampaigns(campRes);
      if (scoreRes && scoreRes.config) setScoringConfig(scoreRes.config);
    } catch (err) {
      console.error("Failed to load admissions playbook data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Group dispositions by the 4 human trays
  const groupedDispositions = useMemo(() => {
    const groups = {
      positive: [] as Disposition[],
      neutral: [] as Disposition[],
      unreachable: [] as Disposition[],
      negative: [] as Disposition[],
    };

    dispositions.forEach((d) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.sub_dispositions && d.sub_dispositions.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchSearch) return;

      const cat = d.category as keyof typeof groups;
      if (groups[cat]) {
        groups[cat].push(d);
      } else {
        groups.neutral.push(d);
      }
    });

    return groups;
  }, [dispositions, searchQuery]);

  const stats = useMemo(() => {
    const total = dispositions.length;
    const progressing = dispositions.filter((d) => d.category === "positive").length;
    const followup = dispositions.filter((d) => d.category === "neutral").length;
    const unreachable = dispositions.filter((d) => d.category === "unreachable").length;
    const closed = dispositions.filter((d) => d.category === "negative").length;
    return { total, progressing, followup, unreachable, closed };
  }, [dispositions]);

  const handleOpenCreate = () => {
    setSelectedDisposition(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (disp: Disposition) => {
    setSelectedDisposition(disp);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? Callers will no longer see this outcome.`)) return;
    try {
      const res = await fetch(`/api/dispositions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast(`Deleted outcome recipe "${name}".`);
        loadData();
      } else {
        const err = await res.json();
        alert("Failed to delete: " + (err.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  // 1-Click Starter Playbook Loader
  const handleApplyStarterPlaybook = async (templateId: string) => {
    const template = STARTER_PLAYBOOKS.find((t) => t.id === templateId);
    if (!template) return;

    if (!confirm(`Apply the "${template.title}" Playbook? This will register ${template.outcomes.length} curated human outcome recipes.`)) {
      return;
    }

    setApplyingTemplate(templateId);
    try {
      for (const outcome of template.outcomes) {
        const autoCode = outcome.name
          .replace(/[^\w\s]/gi, "")
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "_")
          .slice(0, 30);

        const res = await fetch("/api/dispositions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: outcome.name,
            code: autoCode,
            category: outcome.category,
            score: outcome.score,
            requires_callback: outcome.requires_callback,
            is_active: 1,
            linked_campaign_ids: campaigns.map((c) => c.id),
          }),
        });

        if (res.ok) {
          const created = await res.json();
          // Add sub-chips
          for (const chip of outcome.chips) {
            await fetch("/api/dispositions/sub", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                disposition_id: created.id,
                name: chip,
                score: outcome.score,
              }),
            }).catch(() => {});
          }
        }
      }

      showToast(`Successfully applied "${template.title}" Playbook!`);
      loadData();
    } catch (err: any) {
      alert("Failed to apply playbook: " + err.message);
    } finally {
      setApplyingTemplate(null);
    }
  };

  const handleSaveScoringConfig = async (recalculateAll = false) => {
    setSavingScoring(true);
    try {
      const res = await fetch("/api/dispositions/scoring-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: scoringConfig,
          recalculateAll,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update scoring");
      if (recalculateAll && data.batchResult) {
        showToast(`Re-ranked ${data.batchResult.affectedCount.toLocaleString()} student leads across database!`);
      } else {
        showToast("Scoring policy saved successfully!");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setSavingScoring(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-foreground text-background shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER: Studio Title & Starter Playbook Selector */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Admissions Playbook & Smart Outcomes Studio</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span>Student Call Outcomes & Action Recipes</span>
              <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/5">
                {stats.total} Live Recipes
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              Clean visual outcomes that telecallers understand in a second. Configure what the student said, their intent temperature, and automated next steps without any technical jargon.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="h-9 px-4 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Outcome Recipe</span>
            </Button>
          </div>
        </div>

        {/* 1-Click Starter Playbook Packs */}
        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
            <span className="font-semibold text-foreground">Need quick setup?</span>
            <span className="text-muted-foreground hidden md:inline">
              Apply a ready-to-use admissions playbook pack in 1 click:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {STARTER_PLAYBOOKS.map((pb) => (
              <Button
                key={pb.id}
                size="sm"
                variant="outline"
                disabled={Boolean(applyingTemplate)}
                onClick={() => handleApplyStarterPlaybook(pb.id)}
                className="h-7 text-xs font-medium border-border/80 hover:bg-card cursor-pointer"
              >
                <span>{pb.title.split(" ")[0]} {pb.title.split(" ")[1]}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* QUICK STATS PILLS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
              <span>Progressing Forward</span>
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {stats.progressing}
            </div>
            <p className="text-[10px] text-muted-foreground">High intent enrollment steps</p>
          </div>

          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>Needs Follow-up</span>
              <Clock className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {stats.followup}
            </div>
            <p className="text-[10px] text-muted-foreground">Warm evaluation & callbacks</p>
          </div>

          <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center justify-between">
              <span>Couldn't Connect</span>
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {stats.unreachable}
            </div>
            <p className="text-[10px] text-muted-foreground">Smart auto-retry queues</p>
          </div>

          <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center justify-between">
              <span>Closed / Dropped</span>
              <XCircle className="w-3.5 h-3.5" />
            </div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {stats.closed}
            </div>
            <p className="text-[10px] text-muted-foreground">Ineligible or opted out</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROL BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search outcome recipes or reason chips..."
            className="h-9 pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All Trays" },
            { id: "positive", label: "🌟 Progressing" },
            { id: "neutral", label: "⏳ Follow-up" },
            { id: "unreachable", label: "📵 Unreached" },
            { id: "negative", label: "🛑 Closed" },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setActiveTrayFilter(btn.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                activeTrayFilter === btn.id
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "bg-card border-border/80 text-muted-foreground hover:bg-muted"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* THE 4 VISUAL REACTION TRAYS */}
      <div className="space-y-6">
        {/* TRAY 1: Progressing Forward */}
        {(activeTrayFilter === "all" || activeTrayFilter === "positive") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  🌟 Tray 1: Progressing Forward
                </h3>
                <span className="text-xs text-muted-foreground">
                  (High intent students moving toward admission)
                </span>
              </div>
              <Badge variant="outline" className="text-xs font-mono text-emerald-600 border-emerald-500/30 bg-emerald-500/5">
                {groupedDispositions.positive.length} Recipes
              </Badge>
            </div>

            {groupedDispositions.positive.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                No outcomes in this tray. Click "+ Create Outcome Recipe" to add one!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {groupedDispositions.positive.map((disp) => (
                  <OutcomeCard
                    key={disp.id}
                    disposition={disp}
                    onEdit={() => handleOpenEdit(disp)}
                    onDelete={() => handleDelete(disp.id, disp.name)}
                    trayColor="emerald"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRAY 2: Needs Follow-up */}
        {(activeTrayFilter === "all" || activeTrayFilter === "neutral") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  ⏳ Tray 2: Needs Follow-up
                </h3>
                <span className="text-xs text-muted-foreground">
                  (Warm evaluation: parent calls, fee inquiries, awaiting marks)
                </span>
              </div>
              <Badge variant="outline" className="text-xs font-mono text-amber-600 border-amber-500/30 bg-amber-500/5">
                {groupedDispositions.neutral.length} Recipes
              </Badge>
            </div>

            {groupedDispositions.neutral.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                No outcomes in this tray.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {groupedDispositions.neutral.map((disp) => (
                  <OutcomeCard
                    key={disp.id}
                    disposition={disp}
                    onEdit={() => handleOpenEdit(disp)}
                    onDelete={() => handleDelete(disp.id, disp.name)}
                    trayColor="amber"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRAY 3: Couldn't Connect */}
        {(activeTrayFilter === "all" || activeTrayFilter === "unreachable") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-blue-500/30 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
                  <PhoneCall className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  📵 Tray 3: Couldn't Connect
                </h3>
                <span className="text-xs text-muted-foreground">
                  (1-Tap fast logging with auto-retry cooldown)
                </span>
              </div>
              <Badge variant="outline" className="text-xs font-mono text-blue-600 border-blue-500/30 bg-blue-500/5">
                {groupedDispositions.unreachable.length} Recipes
              </Badge>
            </div>

            {groupedDispositions.unreachable.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                No outcomes in this tray.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {groupedDispositions.unreachable.map((disp) => (
                  <OutcomeCard
                    key={disp.id}
                    disposition={disp}
                    onEdit={() => handleOpenEdit(disp)}
                    onDelete={() => handleDelete(disp.id, disp.name)}
                    trayColor="blue"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRAY 4: Closed / Dropped */}
        {(activeTrayFilter === "all" || activeTrayFilter === "negative") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-rose-500/30 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  🛑 Tray 4: Closed / Dropped
                </h3>
                <span className="text-xs text-muted-foreground">
                  (Ineligible candidates, joined other institutions, or opt-outs)
                </span>
              </div>
              <Badge variant="outline" className="text-xs font-mono text-rose-600 border-rose-500/30 bg-rose-500/5">
                {groupedDispositions.negative.length} Recipes
              </Badge>
            </div>

            {groupedDispositions.negative.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                No outcomes in this tray.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {groupedDispositions.negative.map((disp) => (
                  <OutcomeCard
                    key={disp.id}
                    disposition={disp}
                    onEdit={() => handleOpenEdit(disp)}
                    onDelete={() => handleDelete(disp.id, disp.name)}
                    trayColor="rose"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* LEAD SCORING & RANKING ENGINE (POWER-USER DRAWER) */}
      <div className="border border-border/80 rounded-2xl bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setIsScoringExpanded((prev) => !prev)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground">
                Lead Priority & Scoring Engine (Under the Hood)
              </div>
              <p className="text-[11px] text-muted-foreground">
                How student intent temperatures and academic weights automatically rank your 112,500+ leads (0 - 100 points).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>{isScoringExpanded ? "Hide Engine Settings" : "Configure Engine"}</span>
            {isScoringExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isScoringExpanded && (
          <div className="p-5 pt-2 border-t border-border/70 space-y-4 bg-muted/10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl border bg-card space-y-1.5">
                <label className="font-semibold text-foreground">Academic Intent Weight</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={scoringConfig.academic_weight}
                    onChange={(e) => setScoringConfig({ ...scoringConfig, academic_weight: Number(e.target.value) })}
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <span className="text-muted-foreground font-mono">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Weights 12th/Entrance test marks</p>
              </div>

              <div className="p-3 rounded-xl border bg-card space-y-1.5">
                <label className="font-semibold text-foreground">Call Outcome Weight</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={scoringConfig.disposition_weight}
                    onChange={(e) => setScoringConfig({ ...scoringConfig, disposition_weight: Number(e.target.value) })}
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <span className="text-muted-foreground font-mono">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Weights counselor interaction results</p>
              </div>

              <div className="p-3 rounded-xl border bg-card space-y-1.5">
                <label className="font-semibold text-foreground">High-Intent Threshold</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={scoringConfig.high_intent_threshold}
                    onChange={(e) => setScoringConfig({ ...scoringConfig, high_intent_threshold: Number(e.target.value) })}
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <span className="text-muted-foreground font-mono">pts</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Leads above this score get VIP priority</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-muted-foreground">
                Recalculating triggers a fast WAL SQLite batch update on all leads.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSaveScoringConfig(false)}
                  disabled={savingScoring}
                  className="h-8 text-xs font-semibold"
                >
                  Save Policy
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveScoringConfig(true)}
                  disabled={savingScoring}
                  className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save & Re-rank All Leads</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RECIPE BUILDER MODAL */}
      <PlaybookOutcomeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        disposition={selectedDisposition}
        campaigns={campaigns}
        onSaved={() => {
          showToast(selectedDisposition ? "Outcome recipe updated!" : "New outcome recipe created!");
          loadData();
        }}
      />
    </div>
  );
}

// Visual Outcome Recipe Card Component
interface OutcomeCardProps {
  disposition: Disposition;
  onEdit: () => void;
  onDelete: () => void;
  trayColor: "emerald" | "amber" | "blue" | "rose";
}

function OutcomeCard({ disposition, onEdit, onDelete, trayColor }: OutcomeCardProps) {
  const chips = disposition.sub_dispositions || [];
  const score = disposition.score ?? 50;

  return (
    <Card className="shadow-2xs hover:shadow-sm border-border/80 hover:border-primary/40 transition-all flex flex-col justify-between group">
      <CardHeader className="p-4 pb-2.5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-bold text-foreground leading-snug">
            {disposition.name}
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold shrink-0 py-0.5 px-1.5"
            style={{ borderColor: disposition.color || "#3b82f6", color: disposition.color || "#3b82f6" }}
          >
            {score > 0 ? `+${score}` : score} pts
          </Badge>
        </div>

        {/* Action pills summary */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {disposition.requires_callback === 1 && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Clock className="w-2.5 h-2.5" />
              <span>Prompts Callback</span>
            </Badge>
          )}

          {disposition.category === "unreachable" && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-2 bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
              <PhoneCall className="w-2.5 h-2.5" />
              <span>1-Tap Retry</span>
            </Badge>
          )}

          {disposition.category === "positive" && score >= 90 && (
            <Badge variant="secondary" className="text-[10px] gap-1 py-0 px-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>Moves to Admitted</span>
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-1.5 space-y-3">
        {/* Reason Chips list */}
        {chips.length > 0 ? (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {chips.length} Sub-Reason Chips:
            </span>
            <div className="flex flex-wrap gap-1">
              {chips.slice(0, 3).map((c) => (
                <span
                  key={c.id}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/80 font-medium"
                >
                  {c.name}
                </span>
              ))}
              {chips.length > 3 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{chips.length - 3} more
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground italic">
            No sub-reason chips configured
          </p>
        )}

        {/* Card Footer: Quick Actions */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">
            {disposition.code}
          </span>

          <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="h-7 px-2.5 text-xs font-semibold gap-1 border-border/80 hover:bg-muted cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="h-7 px-2 text-xs border-destructive/20 text-destructive hover:bg-destructive/10 cursor-pointer"
              title="Delete outcome"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
