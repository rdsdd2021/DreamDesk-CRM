"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Disposition, Campaign } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DispositionsManagerModal } from "@/components/crm/DispositionsManagerModal";
import {
  Tag,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Edit2,
  Trash2,
  Layers,
  ArrowRight,
  TrendingUp,
  Sparkles,
} from "lucide-react";

interface DispositionsWorkspaceProps {
  onFilterByDisposition?: (dispositionName: string) => void;
}

export function DispositionsWorkspace({
  onFilterByDisposition,
}: DispositionsWorkspaceProps) {
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dispRes, campRes] = await Promise.all([
        fetch("/api/dispositions").then((r) => r.json()),
        fetch("/api/campaigns").then((r) => r.json()),
      ]);

      if (Array.isArray(dispRes)) setDispositions(dispRes);
      if (Array.isArray(campRes)) setCampaigns(campRes);
    } catch (err) {
      console.error("Failed to load dispositions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics
  const positiveCount = useMemo(
    () => dispositions.filter((d) => (d.score || 0) > 20).length,
    [dispositions]
  );

  const callbackCount = useMemo(
    () => dispositions.filter((d) => d.requires_callback).length,
    [dispositions]
  );

  const avgScore = useMemo(() => {
    if (dispositions.length === 0) return 0;
    const sum = dispositions.reduce((acc, d) => acc + (d.score || 0), 0);
    return Math.round(sum / dispositions.length);
  }, [dispositions]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    dispositions.forEach((d) => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set);
  }, [dispositions]);

  // Filtered dispositions
  const filteredDispositions = useMemo(() => {
    return dispositions.filter((d) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.code && d.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (d.category && d.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory = categoryFilter === "all" || d.category === categoryFilter;

      return matchSearch && matchCategory;
    });
  }, [dispositions, searchQuery, categoryFilter]);

  const handleDeleteDisposition = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete disposition "${name}"?`)) return;
    try {
      const res = await fetch(`/api/dispositions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json();
        alert("Failed to delete disposition: " + (err.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shadow-xs">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Call Dispositions & Outcomes</span>
              <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-600 bg-rose-500/5">
                {dispositions.length} Outcomes Registered
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Standardized telecalling outcome tags, conversion scoring impact, and automatic callback scheduling rules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
            title="Refresh dispositions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="h-8 text-xs font-semibold gap-1.5 shadow-2xs bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage Dispositions</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Total Dispositions</span>
            <Tag className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground font-sans tabular-nums">
            {dispositions.length}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Standard telecalling tags
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>High-Intent Outcomes</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 font-sans tabular-nums">
            {positiveCount}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Score weight &gt; 20 points
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Callback Triggers</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 font-sans tabular-nums">
            {callbackCount}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Requires follow-up scheduling
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Average Score Impact</span>
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground font-sans tabular-nums">
            {avgScore > 0 ? `+${avgScore}` : avgScore} pts
          </div>
          <p className="text-[11px] text-muted-foreground">
            Mean conversion weight
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search disposition name, code, or category..."
            className="h-8 pl-8 text-xs bg-muted/30"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mr-1">Category:</span>
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
              categoryFilter === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            All ({dispositions.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-all ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Dispositions Table */}
      <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Call Outcomes Directory ({filteredDispositions.length} Displayed)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Counselors select these disposition outcomes during and after student counseling phone calls.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            className="h-7 text-xs font-semibold gap-1.5"
          >
            <Plus className="w-3 h-3" />
            <span>Add New</span>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
              <tr>
                <th className="py-2.5 px-4 text-left">Outcome Tag</th>
                <th className="py-2.5 px-3 text-left">Category</th>
                <th className="py-2.5 px-3 text-center">Score Weight</th>
                <th className="py-2.5 px-3 text-center">Callback Scheduled</th>
                <th className="py-2.5 px-3 text-left">Associated Campaigns</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDispositions.map((d) => {
                const linkedCount = (d.linked_campaign_ids || []).length;
                return (
                  <tr key={d.id} className="hover:bg-muted/30 transition-colors h-12">
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 shadow-2xs"
                          style={{ backgroundColor: d.color || "#3b82f6" }}
                        />
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{d.name}</span>
                            {d.is_active === 0 && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {d.code}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <Badge variant="outline" className="text-[10px] capitalize font-medium">
                        {d.category}
                      </Badge>
                    </td>

                    <td className="py-2 px-3 text-center font-mono font-bold">
                      <span
                        className={
                          d.score > 30
                            ? "text-emerald-600 font-semibold"
                            : d.score > 0
                            ? "text-blue-600 font-semibold"
                            : d.score < 0
                            ? "text-rose-600 font-semibold"
                            : "text-muted-foreground"
                        }
                      >
                        {d.score > 0 ? `+${d.score}` : d.score} pts
                      </span>
                    </td>

                    <td className="py-2 px-3 text-center">
                      {d.requires_callback ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Yes</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60">No</span>
                      )}
                    </td>

                    <td className="py-2 px-3">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {linkedCount === 0 || linkedCount >= campaigns.length
                          ? `All ${campaigns.length} Campaigns`
                          : `${linkedCount} of ${campaigns.length} Campaigns`}
                      </span>
                    </td>

                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onFilterByDisposition && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onFilterByDisposition(d.name)}
                            className="h-7 text-xs text-primary hover:bg-primary/10 gap-1 font-medium"
                            title="Filter leads table with this disposition"
                          >
                            <Filter className="w-3 h-3" />
                            <span className="hidden md:inline">Filter Leads</span>
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsModalOpen(true)}
                          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          title="Edit disposition settings"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteDisposition(d.id, d.name)}
                          className="h-7 text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          title="Delete disposition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispositions Manager Modal */}
      <DispositionsManagerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dispositions={dispositions}
        campaigns={campaigns}
        onDispositionsChange={() => {
          loadData();
        }}
      />
    </div>
  );
}
