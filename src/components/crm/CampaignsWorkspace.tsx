"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Campaign, Disposition } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignModal } from "@/components/crm/CampaignModal";
import {
  Target,
  Plus,
  Search,
  Filter,
  TrendingUp,
  Settings2,
  Trash2,
  Layers,
  Sparkles,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  BarChart3,
  Users,
} from "lucide-react";

interface CampaignsWorkspaceProps {
  onFilterByCampaign: (campaignId: string, campaignName: string) => void;
  totalLeadsCount: number;
}

export function CampaignsWorkspace({
  onFilterByCampaign,
  totalLeadsCount,
}: CampaignsWorkspaceProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "completed">("all");

  // Campaign Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCampaignForEdit, setSelectedCampaignForEdit] = useState<Campaign | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [campRes, dispRes] = await Promise.all([
        fetch("/api/campaigns").then((r) => r.json()),
        fetch("/api/dispositions").then((r) => r.json()),
      ]);

      if (Array.isArray(campRes)) setCampaigns(campRes);
      if (Array.isArray(dispRes)) setDispositions(dispRes);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics
  const totalAttributedLeads = useMemo(
    () => campaigns.reduce((acc, c) => acc + (c.total_leads || 0), 0),
    [campaigns]
  );

  const totalConvertedLeads = useMemo(
    () => campaigns.reduce((acc, c) => acc + (c.converted_leads || 0), 0),
    [campaigns]
  );

  const overallConversionRate = totalAttributedLeads > 0
    ? ((totalConvertedLeads / totalAttributedLeads) * 100).toFixed(1)
    : "0.0";

  const activeCampaignsCount = useMemo(
    () => campaigns.filter((c) => c.status === "active").length,
    [campaigns]
  );

  // Distinct channels
  const channels = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => {
      if (c.channel) set.add(c.channel);
    });
    return Array.from(set);
  }, [campaigns]);

  // Filtered campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.channel && c.channel.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.target_audience && c.target_audience.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchChannel = selectedChannel === "all" || c.channel === selectedChannel;
      const matchStatus = statusFilter === "all" || c.status === statusFilter;

      return matchSearch && matchChannel && matchStatus;
    });
  }, [campaigns, searchQuery, selectedChannel, statusFilter]);

  const handleOpenCreate = () => {
    setSelectedCampaignForEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Campaign) => {
    setSelectedCampaignForEdit(c);
    setIsModalOpen(true);
  };

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete campaign "${name}"?`)) return;
    try {
      const res = await fetch(`/api/campaigns?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadData();
      } else {
        const err = await res.json();
        alert("Failed to delete campaign: " + (err.error || "Unknown error"));
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
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shadow-xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Campaigns & Sources Management</span>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-600 bg-amber-500/5">
                {campaigns.length} Sources Active
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Multi-channel lead source attribution, campaign ROI metrics, and linked telecalling disposition workflows.
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
            title="Refresh campaign stats"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreate}
            className="h-8 text-xs font-semibold gap-1.5 shadow-2xs bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Campaign</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Active Campaigns</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground font-sans tabular-nums">
            {activeCampaignsCount} <span className="text-xs font-normal text-muted-foreground">/ {campaigns.length} total</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Actively collecting student inquiries
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Attributed Leads</span>
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground font-sans tabular-nums">
            {totalAttributedLeads.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {totalLeadsCount > 0 ? `${((totalAttributedLeads / totalLeadsCount) * 100).toFixed(0)}% of database linked` : "All leads tracked"}
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Admissions Converted</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 font-sans tabular-nums">
            {totalConvertedLeads.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Successful enrollments secured
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Average Conversion</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground font-sans tabular-nums flex items-center gap-1">
            <span>{overallConversionRate}%</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Inquiry-to-Admission conversion
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-2xs">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns, audience, or channel..."
              className="h-8 pl-8 text-xs bg-muted/30"
            />
          </div>

          {channels.length > 0 && (
            <Select value={selectedChannel} onValueChange={(val: any) => setSelectedChannel(val || "all")}>
              <SelectTrigger className="h-8 text-xs w-[170px]">
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {channels.map((ch) => (
                  <SelectItem key={ch} value={ch}>
                    {ch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mr-1">Status:</span>
          {(["all", "active", "paused", "completed"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-all ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="p-12 text-center border border-dashed rounded-xl bg-muted/10 space-y-3">
          <Target className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
          <h3 className="text-sm font-semibold text-foreground">No campaigns match your search</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Try adjusting your search query, clearing filters, or create a brand new campaign.
          </p>
          <Button size="sm" onClick={handleOpenCreate} className="h-8 text-xs font-semibold gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Create Campaign</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCampaigns.map((camp) => {
            const total = camp.total_leads || 0;
            const converted = camp.converted_leads || 0;
            const convRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";
            const linkedDisps = (camp.linked_disposition_ids || [])
              .map((id) => dispositions.find((d) => d.id === id))
              .filter(Boolean) as Disposition[];

            return (
              <Card
                key={camp.id}
                className="hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between border-border/80"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px] font-medium bg-muted/40">
                      {camp.channel}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 font-mono">
                        <TrendingUp className="w-3 h-3" /> {convRate}% Conversion
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] capitalize ${
                          camp.status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : camp.status === "paused"
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {camp.status}
                      </Badge>
                    </div>
                  </div>

                  <CardTitle className="text-base font-bold text-foreground mt-2">
                    {camp.name}
                  </CardTitle>

                  {camp.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {camp.description}
                    </p>
                  )}

                  {camp.target_audience && (
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground/80">Target:</span> {camp.target_audience}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Lead Generation & Conversion Metrics */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl text-xs border border-border/40">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        Captured Leads
                      </div>
                      <div className="text-xl font-bold text-foreground font-mono tabular-nums mt-0.5">
                        {total.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        Interested / Admitted
                      </div>
                      <div className="text-xl font-bold text-emerald-600 font-mono tabular-nums mt-0.5">
                        {converted.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Allowed Dispositions Badge Preview */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Layers className="w-3 h-3 text-primary" />
                        <span>Allowed Dispositions ({linkedDisps.length})</span>
                      </span>
                      <button
                        onClick={() => handleOpenEdit(camp)}
                        className="text-[11px] font-medium text-primary hover:underline cursor-pointer"
                      >
                        Configure
                      </button>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap min-h-[24px]">
                      {linkedDisps.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground italic">
                          All standard call dispositions available
                        </span>
                      ) : (
                        <>
                          {linkedDisps.slice(0, 4).map((d) => (
                            <span
                              key={d.id}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border font-medium"
                              style={{
                                borderColor: `${d.color}40`,
                                backgroundColor: `${d.color}15`,
                                color: d.color,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                              <span>{d.name}</span>
                            </span>
                          ))}
                          {linkedDisps.length > 4 && (
                            <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
                              +{linkedDisps.length - 4} more
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/60">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(camp)}
                        className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Settings2 className="w-3 h-3" />
                        <span>Edit</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCampaign(camp.id, camp.name)}
                        className="h-7 text-xs gap-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onFilterByCampaign(camp.id, camp.name)}
                      className="h-7 text-xs gap-1.5 font-semibold border-primary/30 text-primary hover:bg-primary/10"
                      title="Filter and browse all leads from this campaign"
                    >
                      <Filter className="w-3 h-3" />
                      <span>View Leads ({total.toLocaleString()})</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Campaign Create/Edit Modal */}
      <CampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        campaign={selectedCampaignForEdit}
        allDispositions={dispositions}
        onSaved={() => {
          loadData();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
