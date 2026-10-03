"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  User,
  FacetGroup,
  CounselorMetric,
  FunnelStage,
  Campaign,
  Disposition,
  AnalyticsReportData,
} from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  TrendingUp,
  UserCheck,
  UserX,
  GraduationCap,
  Sparkles,
  ArrowUpRight,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Clock,
  Target,
  PhoneCall,
  Trophy,
  Award,
  ArrowRight,
  CheckCircle2,
  Flame,
  Filter,
  Download,
  RotateCcw,
  SlidersHorizontal,
  FileSpreadsheet,
  Layers,
  ChevronDown,
  X,
  AlertCircle,
  Eye,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  AreaChart,
  Area,
} from "recharts";

interface AnalyticsDashboardProps {
  totalCount: number;
  unassignedCount: number;
  assignedCount: number;
  users: User[];
  facets: FacetGroup[];
  campaigns?: Campaign[];
  dispositions?: Disposition[];
  statusBreakdown: Record<string, number>;
  onNavigateToFilter: (facetKey: string, value: string) => void;
  currentUser?: User | null;
}

const STATUS_COLORS: Record<string, string> = {
  New: "#3b82f6",
  Contacted: "#f59e0b",
  Interested: "#10b981",
  "Follow-up": "#8b5cf6",
  Admitted: "#6366f1",
  "Not Interested": "#f43f5e",
  Invalid: "#94a3b8",
};

const STREAM_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#059669",
  "#0891b2",
  "#d97706",
  "#4f46e5",
];

export function AnalyticsDashboard({
  totalCount: initialTotal,
  unassignedCount: initialUnassigned,
  assignedCount: initialAssigned,
  users,
  facets,
  campaigns = [],
  dispositions = [],
  statusBreakdown: initialStatusBreakdown,
  onNavigateToFilter,
  currentUser,
}: AnalyticsDashboardProps) {
  // Filter States
  const [datePreset, setDatePreset] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [timeFrom, setTimeFrom] = useState<string>("00:00");
  const [dateTo, setDateTo] = useState<string>("");
  const [timeTo, setTimeTo] = useState<string>("23:59");
  const [showCustomDate, setShowCustomDate] = useState<boolean>(false);

  const [selectedCounselor, setSelectedCounselor] = useState<string>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedStream, setSelectedStream] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(0);

  // Active Report Tab: counselor, campaigns, sample
  const [activeReportTab, setActiveReportTab] = useState<"counselors" | "campaigns" | "drilldown">("counselors");

  // Data fetching state
  const [reportData, setReportData] = useState<AnalyticsReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch report data whenever filters change
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("date_preset", datePreset);

      if (datePreset === "custom") {
        if (dateFrom) params.set("date_from", `${dateFrom} ${timeFrom || "00:00"}:00`);
        if (dateTo) params.set("date_to", `${dateTo} ${timeTo || "23:59"}:59`);
      }

      if (selectedCounselor && selectedCounselor !== "all") {
        params.set("assigned_to", selectedCounselor);
      }
      if (selectedCampaign && selectedCampaign !== "all") {
        params.set("campaign_id", selectedCampaign);
      }
      if (selectedStatus && selectedStatus !== "all") {
        params.set("status", selectedStatus);
      }
      if (selectedStream && selectedStream !== "all") {
        params.set("stream", selectedStream);
      }
      if (minScore > 0) {
        params.set("min_score", String(minScore));
      }

      const res = await fetch(`/api/analytics/report?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load filtered analytics report");
      const data: AnalyticsReportData = await res.json();
      setReportData(data);
    } catch (err: any) {
      console.error("Report fetch error:", err);
      setError(err?.message || "Error generating report");
    } finally {
      setLoading(false);
    }
  }, [
    datePreset,
    dateFrom,
    timeFrom,
    dateTo,
    timeTo,
    selectedCounselor,
    selectedCampaign,
    selectedStatus,
    selectedStream,
    minScore,
  ]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Extract unique academic streams from facets
  const streamOptions = useMemo(() => {
    const streamFacet = facets.find((f) => f.key_name === "stream");
    return streamFacet?.options || [];
  }, [facets]);

  // Compute active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (datePreset !== "all") count++;
    if (selectedCounselor !== "all") count++;
    if (selectedCampaign !== "all") count++;
    if (selectedStatus !== "all") count++;
    if (selectedStream !== "all") count++;
    if (minScore > 0) count++;
    return count;
  }, [datePreset, selectedCounselor, selectedCampaign, selectedStatus, selectedStream, minScore]);

  // Reset all filters
  const handleResetFilters = () => {
    setDatePreset("all");
    setDateFrom("");
    setTimeFrom("00:00");
    setDateTo("");
    setTimeTo("23:59");
    setShowCustomDate(false);
    setSelectedCounselor("all");
    setSelectedCampaign("all");
    setSelectedStatus("all");
    setSelectedStream("all");
    setMinScore(0);
  };

  // CSV Export Function
  const handleExportCSV = () => {
    if (!reportData) return;

    const lines: string[] = [];
    lines.push("DreamDesk CRM - Filtered Admissions & Performance Report");
    lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);
    lines.push(`Date Range Preset: ${reportData.filters.date_preset.toUpperCase()}`);
    if (reportData.filters.date_from || reportData.filters.date_to) {
      lines.push(`Date Range: ${reportData.filters.date_from || "Start"} to ${reportData.filters.date_to || "Present"}`);
    }
    lines.push(`Counselor Filter: ${selectedCounselor}`);
    lines.push(`Campaign Filter: ${selectedCampaign}`);
    lines.push(`Status Filter: ${selectedStatus}`);
    lines.push("");

    // Summary Section
    lines.push("=== EXECUTIVE KPI SUMMARY ===");
    lines.push("Metric,Value");
    lines.push(`Total Ingested Leads,${reportData.summary.totalLeads}`);
    lines.push(`Active Assigned Leads,${reportData.summary.assignedCount}`);
    lines.push(`Unassigned Pool,${reportData.summary.unassignedCount}`);
    lines.push(`Contacted Leads,${reportData.summary.contactedCount}`);
    lines.push(`Interested Candidates,${reportData.summary.interestedCount}`);
    lines.push(`Admissions Enrolled,${reportData.summary.admittedCount}`);
    lines.push(`Positive Conversion Rate,${reportData.summary.conversionRate}%`);
    lines.push(`Calls & Outreach Logged,${reportData.summary.callsLogged}`);
    lines.push(`Average Quality Score,${reportData.summary.avgScore}`);
    lines.push("");

    // Counselor Breakdown
    lines.push("=== COUNSELOR PERFORMANCE & CONVERSION ===");
    lines.push("Counselor Name,Active Leads,Calls in Period,Contact Rate %,Admitted Enrolled,Conversion Rate %,Avg Score");
    reportData.counselorBreakdown.forEach((c) => {
      lines.push(
        `"${c.name}",${c.total_assigned},${c.calls_in_period},${c.contact_rate}%,${c.admissions_count},${c.conversion_rate}%,${c.avg_score}`
      );
    });
    lines.push("");

    // Campaign Breakdown
    lines.push("=== CAMPAIGN INTAKE & CONVERSION ROI ===");
    lines.push("Campaign Name,Total Leads,Contacted,Admitted,Conversion Rate %");
    reportData.campaignBreakdown.forEach((camp) => {
      lines.push(`"${camp.name}",${camp.total},${camp.contacted},${camp.admitted},${camp.conversionRate}%`);
    });
    lines.push("");

    // Sample Leads
    lines.push("=== SAMPLE MATCHING LEADS ===");
    lines.push("Lead Code,Name,Phone,Status,School,Stream,Score,Counselor,Campaign,Date Added");
    reportData.sampleLeads.forEach((l) => {
      lines.push(
        `"${l.lead_code}","${l.name}","${l.phone}","${l.status}","${l.school}","${l.stream}",${l.score},"${l.assigned_user_name || "Unassigned"}","${l.campaign_name || "Direct"}",${l.created_at}`
      );
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join("\n"));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", csvContent);
    downloadAnchor.setAttribute("download", `DreamDesk_Admissions_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Active dataset fallback
  const summary = reportData ? reportData.summary : {
    totalLeads: initialTotal,
    assignedCount: initialAssigned,
    unassignedCount: initialUnassigned,
    contactedCount: Math.round(initialTotal * 0.45),
    interestedCount: initialStatusBreakdown["Interested"] || 0,
    admittedCount: initialStatusBreakdown["Admitted"] || 0,
    positiveCount: (initialStatusBreakdown["Admitted"] || 0) + (initialStatusBreakdown["Interested"] || 0),
    conversionRate: initialTotal > 0 ? (((initialStatusBreakdown["Admitted"] || 0) / initialTotal) * 100).toFixed(1) : "0.0",
    callsLogged: 0,
    avgScore: 82,
  };

  const statusData = reportData ? reportData.statusBreakdown : Object.entries(initialStatusBreakdown).map(([status, count]) => ({
    name: status,
    value: count,
    color: STATUS_COLORS[status] || "#64748b",
  }));

  const streamData = reportData ? reportData.streamBreakdown : (facets.find((f) => f.key_name === "stream")?.options || []).slice(0, 6).map((opt, i) => ({
    name: opt.value.replace("Science ", "").replace("Commerce ", "Comm. "),
    fullName: opt.value,
    count: opt.count,
    color: STREAM_COLORS[i % STREAM_COLORS.length],
  }));

  const campaignData = reportData ? reportData.campaignBreakdown.map((c) => ({
    name: c.name.length > 20 ? c.name.slice(0, 18) + "..." : c.name,
    fullName: c.name,
    count: c.total,
  })) : [];

  const dispositionData = reportData ? reportData.dispositionBreakdown : [];
  const funnel = reportData ? reportData.funnel : [];
  const counselorData = reportData ? reportData.counselorBreakdown.map((c) => ({
    name: c.name.split(" ")[0],
    fullName: c.name,
    leads: c.total_assigned,
    color: c.avatar_color,
  })) : [];

  const dailyTrend = reportData?.dailyIntakeTrend || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Comprehensive Filter Control Center */}
      <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
              <BarChart3 className="w-4 h-4" />
              <span>Admissions Intelligence & Reporting Suite</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <span>Executive Analytics & Performance</span>
              {loading && (
                <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
              Real-time multi-dimensional reports filtered by date, time window, counselor, campaign attribution, academic stream, and quality score.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {activeFiltersCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleResetFilters}
                className="h-8 text-xs font-semibold gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters ({activeFiltersCount})</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleExportCSV}
              disabled={loading || !reportData}
              className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report (CSV)</span>
            </Button>
          </div>
        </div>

        {/* INTERACTIVE FILTER CONTROL BAR */}
        <div className="pt-4 border-t border-border/60 space-y-4">
          {/* Row 1: Date & Time Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground mr-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Timeframe:</span>
            </span>

            {[
              { id: "all", label: "All Time" },
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "7days", label: "Last 7 Days" },
              { id: "30days", label: "Last 30 Days" },
              { id: "this_month", label: "This Month" },
              { id: "last_month", label: "Last Month" },
              { id: "custom", label: "Custom Date & Time" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setDatePreset(preset.id);
                  if (preset.id === "custom") {
                    setShowCustomDate(true);
                  } else {
                    setShowCustomDate(false);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  datePreset === preset.id
                    ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Expandable Custom Date & Time Picker */}
          {showCustomDate && (
            <div className="p-3.5 rounded-xl bg-muted/40 border border-primary/30 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>Specify Precise Date & Time Interval</span>
                </span>
                <span className="text-[11px] text-muted-foreground">Standard 24-hr format</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">From Date</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">From Time</label>
                  <Input
                    type="time"
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">To Date</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">To Time</label>
                  <Input
                    type="time"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                    className="h-8 text-xs bg-background"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Row 2: Dimension Dropdowns (Counselor, Campaign, Status, Stream, Quality) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
            {/* Counselor Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3 text-primary" />
                <span>Counselor</span>
              </label>
              <select
                value={selectedCounselor}
                onChange={(e) => setSelectedCounselor(e.target.value)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Counselors</option>
                <option value="unassigned">Unassigned Only</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Campaign Attribution Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Target className="w-3 h-3 text-amber-500" />
                <span>Campaign</span>
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lead Status Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-emerald-500" />
                <span>Stage / Status</span>
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Interested">Interested</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Admitted">Admitted</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>

            {/* Academic Stream Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-purple-500" />
                <span>Academic Stream</span>
              </label>
              <select
                value={selectedStream}
                onChange={(e) => setSelectedStream(e.target.value)}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">All Courses / Streams</option>
                {streamOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value} ({opt.count.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Minimum Lead Score Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Intent / Score</span>
              </label>
              <select
                value={minScore}
                onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
                className="w-full h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="0">All Lead Scores</option>
                <option value="80">Score 80+ (High Intent)</option>
                <option value="60">Score 60+ (Qualified)</option>
                <option value="40">Score 40+ (Moderate)</option>
              </select>
            </div>
          </div>

          {/* Active Filter Chips Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-muted-foreground">Active filter set:</span>

              {datePreset !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5">
                  <Calendar className="w-2.5 h-2.5 text-primary" />
                  <span>
                    {datePreset === "custom"
                      ? `${dateFrom || "Start"} → ${dateTo || "Now"}`
                      : datePreset.replace("_", " ").toUpperCase()}
                  </span>
                  <X
                    className="w-2.5 h-2.5 cursor-pointer hover:text-destructive"
                    onClick={() => {
                      setDatePreset("all");
                      setShowCustomDate(false);
                    }}
                  />
                </Badge>
              )}

              {selectedCounselor !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5">
                  <Users className="w-2.5 h-2.5 text-primary" />
                  <span>Counselor: {users.find((u) => u.id === selectedCounselor)?.name || selectedCounselor}</span>
                  <X className="w-2.5 h-2.5 cursor-pointer hover:text-destructive" onClick={() => setSelectedCounselor("all")} />
                </Badge>
              )}

              {selectedCampaign !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5">
                  <Target className="w-2.5 h-2.5 text-amber-500" />
                  <span>Campaign: {campaigns.find((c) => c.id === selectedCampaign)?.name || selectedCampaign}</span>
                  <X className="w-2.5 h-2.5 cursor-pointer hover:text-destructive" onClick={() => setSelectedCampaign("all")} />
                </Badge>
              )}

              {selectedStatus !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5">
                  <span>Status: {selectedStatus}</span>
                  <X className="w-2.5 h-2.5 cursor-pointer hover:text-destructive" onClick={() => setSelectedStatus("all")} />
                </Badge>
              )}

              {selectedStream !== "all" && (
                <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5">
                  <span>Stream: {selectedStream}</span>
                  <X className="w-2.5 h-2.5 cursor-pointer hover:text-destructive" onClick={() => setSelectedStream("all")} />
                </Badge>
              )}

              {minScore > 0 && (
                <Badge variant="secondary" className="text-[10px] gap-1 px-2 py-0.5">
                  <span>Score: {minScore}+</span>
                  <X className="w-2.5 h-2.5 cursor-pointer hover:text-destructive" onClick={() => setMinScore(0)} />
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TOP FILTERED KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Ingested in Range */}
        <Card className="shadow-2xs hover:border-primary/40 transition-colors">
          <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Filtered Leads
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {summary.totalLeads.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Matching active filter criteria
            </p>
          </CardContent>
        </Card>

        {/* Assigned in Pipeline */}
        <Card className="shadow-2xs hover:border-emerald-500/40 transition-colors">
          <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Active Pipeline
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {summary.assignedCount.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              In counseling queues
            </p>
          </CardContent>
        </Card>

        {/* Unassigned Pool */}
        <Card className="shadow-2xs hover:border-amber-500/40 transition-colors">
          <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Unassigned Pool
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <UserX className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-amber-600">
              {summary.unassignedCount.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Awaiting counselor claim
            </p>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card className="shadow-2xs hover:border-purple-500/40 transition-colors">
          <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Positive Ratio
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {summary.conversionRate}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Interested / Admitted
            </p>
          </CardContent>
        </Card>

        {/* Calls Logged */}
        <Card className="shadow-2xs hover:border-violet-500/40 transition-colors">
          <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Calls Logged
            </span>
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center">
              <PhoneCall className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-violet-600 dark:text-violet-400">
              {summary.callsLogged.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              In selected time window
            </p>
          </CardContent>
        </Card>

        {/* Avg Lead Quality Score */}
        <Card className="shadow-2xs hover:border-amber-500/40 transition-colors">
          <CardHeader className="p-4 pb-2 space-y-0 flex flex-row items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Avg Quality
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black text-foreground">
              {summary.avgScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Average academic intent
            </p>
          </CardContent>
        </Card>
      </div>

      {/* TIMELINE INTAKE TREND (IF AVAILABLE) */}
      {dailyTrend.length > 1 && (
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>Lead Intake & Registration Trend</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Daily distribution of incoming student inquiries matching active filters
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {dailyTrend.length} Days Recorded
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="intakeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any) => [Number(val).toLocaleString() + " leads", "Intake"]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#intakeGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ADMISSIONS CONVERSION FUNNEL */}
      {funnel.length > 0 && (
        <Card className="shadow-xs border-primary/20 bg-gradient-to-b from-card to-muted/10">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500 fill-current" />
                  <span>Filtered Student Admissions Funnel</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Stage-by-stage conversion and student drop-off metrics for selected filters
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs w-fit">
                {funnel[funnel.length - 1]?.percentage}% Overall Conversion
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 relative">
              {funnel.map((stage, idx) => {
                const colors = [
                  "from-blue-600 to-indigo-600",
                  "from-indigo-600 to-violet-600",
                  "from-violet-600 to-purple-600",
                  "from-amber-500 to-orange-500",
                  "from-emerald-500 to-teal-600",
                ];
                const bgGradient = colors[idx % colors.length];

                return (
                  <div
                    key={stage.stage}
                    className="p-3.5 rounded-xl border bg-card shadow-2xs space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                        <span className="font-mono">Stage 0{idx + 1}</span>
                        {idx > 0 && stage.drop_off > 0 && (
                          <span className="text-[10px] text-rose-500 font-mono font-bold">
                            -{stage.drop_off}% drop
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-foreground leading-snug">
                        {stage.stage}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-black font-sans text-foreground">
                          {stage.count.toLocaleString()}
                        </span>
                        <span className="text-xs font-mono font-bold text-primary">
                          {stage.percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${bgGradient}`}
                          style={{ width: `${Math.max(4, stage.percentage)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-primary" />
              <span>Lead Status Distribution</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Distribution across pipeline stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [Number(val).toLocaleString() + " leads", "Count"]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Academic Stream Distribution */}
        <Card className="shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Students by Stream / Course</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Subject preferences for current filter set
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={streamData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(val: any, _: any, item: any) => [
                      Number(val).toLocaleString() + " students",
                      item.payload.fullName,
                    ]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {streamData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Acquisition Performance */}
        {campaignData.length > 0 && (
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-500" />
                <span>Campaign Attribution & Intake</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Inquiries generated by marketing drives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={campaignData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip
                      formatter={(val: any, _: any, item: any) => [
                        Number(val).toLocaleString() + " leads",
                        item.payload.fullName,
                      ]}
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Telecalling Dispositions Breakdown */}
        {dispositionData.length > 0 && (
          <Card className="shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-violet-500" />
                <span>Logged Call Dispositions</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Outcomes of logged counselor interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dispositionData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip
                      formatter={(val: any, _: any, item: any) => [
                        Number(val).toLocaleString() + " calls",
                        item.payload.fullName,
                      ]}
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {dispositionData.map((entry, index) => (
                        <Cell key={`disp-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Counselor Workload Distribution */}
        {counselorData.length > 0 && (
          <Card className="shadow-xs lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <span>Counselor Lead Workloads (Filtered Scope)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Allocation of matching student leads per admissions counselor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={counselorData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any, _: any, item: any) => [
                        Number(val).toLocaleString() + " leads",
                        item.payload.fullName,
                      ]}
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                    />
                    <Bar dataKey="leads" radius={[4, 4, 0, 0]}>
                      {counselorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* DETAILED TABULAR REPORTS SECTION */}
      <Card className="shadow-xs border-border/80 overflow-hidden">
        <CardHeader className="p-4 sm:p-5 bg-muted/20 border-b space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                <span>Detailed Tabular Breakdown & Audit Drilldown</span>
              </CardTitle>
              <CardDescription className="text-xs">
                In-depth reporting tables for counselor performance, campaign conversions, and sample filtered leads
              </CardDescription>
            </div>

            {/* Sub-tab selection */}
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border/60 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveReportTab("counselors")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeReportTab === "counselors"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Counselor Velocity
              </button>
              <button
                type="button"
                onClick={() => setActiveReportTab("campaigns")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeReportTab === "campaigns"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Campaign ROI
              </button>
              <button
                type="button"
                onClick={() => setActiveReportTab("drilldown")}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeReportTab === "drilldown"
                    ? "bg-card text-foreground shadow-2xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Matching Records ({reportData?.sampleLeads?.length || 0})
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* TAB 1: COUNSELOR VELOCITY REPORT */}
          {activeReportTab === "counselors" && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-semibold border-b tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-4">Counselor</th>
                    <th className="py-2.5 px-4 text-center">Active Leads in Scope</th>
                    <th className="py-2.5 px-4 text-center">Calls in Period</th>
                    <th className="py-2.5 px-4">Contact Rate</th>
                    <th className="py-2.5 px-4 text-center">Admitted Students</th>
                    <th className="py-2.5 px-4 text-center">Conversion %</th>
                    <th className="py-2.5 px-4 text-right">Avg Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(reportData?.counselorBreakdown || []).map((c, idx) => (
                    <tr key={c.counselor_id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-center font-bold font-mono">
                        <span className={idx < 3 ? "text-amber-500 font-black" : "text-muted-foreground"}>
                          {idx === 0 ? "🥇 #1" : idx === 1 ? "🥈 #2" : idx === 2 ? "🥉 #3" : `#${idx + 1}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-2xs shrink-0"
                          style={{ backgroundColor: c.avatar_color }}
                        >
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-foreground text-xs">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{c.counselor_id}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-semibold">
                        {c.total_assigned.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <Badge
                          variant={c.calls_in_period > 0 ? "default" : "outline"}
                          className={`text-[10px] font-bold ${
                            c.calls_in_period > 0
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                              : "text-muted-foreground"
                          }`}
                        >
                          {c.calls_in_period} calls
                        </Badge>
                      </td>
                      <td className="py-3 px-4 w-40">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="font-bold text-foreground">{c.contact_rate}%</span>
                            <span className="text-[10px] text-muted-foreground">contacted</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.max(5, c.contact_rate))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{c.admissions_count} enrolled</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-primary">
                        {c.conversion_rate}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                        {c.avg_score} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: CAMPAIGN ROI REPORT */}
          {activeReportTab === "campaigns" && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-semibold border-b tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Campaign Name</th>
                    <th className="py-2.5 px-4 text-center">Total Ingested</th>
                    <th className="py-2.5 px-4 text-center">Contacted Inquiries</th>
                    <th className="py-2.5 px-4 text-center">Admitted Enrollments</th>
                    <th className="py-2.5 px-4 text-center">Enrollment Rate</th>
                    <th className="py-2.5 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(reportData?.campaignBreakdown || []).map((camp) => (
                    <tr key={camp.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">
                        <div className="font-bold text-foreground">{camp.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{camp.id}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {camp.total.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-amber-600">
                        {camp.contacted.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          {camp.admitted} admitted
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-primary">
                        {camp.conversionRate}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onNavigateToFilter("campaign_id", camp.id)}
                          className="h-7 text-xs text-primary gap-1 cursor-pointer"
                        >
                          <span>Drilldown</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: SAMPLE FILTERED LEADS DRILLDOWN */}
          {activeReportTab === "drilldown" && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-semibold border-b tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Student Applicant</th>
                    <th className="py-2.5 px-4">Contact</th>
                    <th className="py-2.5 px-4">School & Stream</th>
                    <th className="py-2.5 px-4 text-center">Score</th>
                    <th className="py-2.5 px-4 text-center">Stage</th>
                    <th className="py-2.5 px-4">Assigned Counselor</th>
                    <th className="py-2.5 px-4 text-right">Date Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(reportData?.sampleLeads || []).map((lead) => (
                    <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground">{lead.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{lead.lead_code}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                        {lead.phone}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-foreground truncate max-w-[180px]">{lead.school}</div>
                        <div className="text-[10px] text-primary font-semibold">{lead.stream}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <Badge variant="outline" className="text-[10px] bg-background">
                          {lead.score} pts
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize"
                          style={{
                            borderColor: STATUS_COLORS[lead.status] || "#94a3b8",
                            color: STATUS_COLORS[lead.status] || "#94a3b8",
                          }}
                        >
                          {lead.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-foreground font-medium">
                        {lead.assigned_user_name || (
                          <span className="text-amber-500 font-normal">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[10px] text-muted-foreground">
                        {lead.created_at}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
