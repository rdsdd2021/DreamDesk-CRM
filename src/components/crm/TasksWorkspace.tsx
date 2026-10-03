"use client";

import React, { useState, useEffect } from "react";
import { CallbackTask, User, Lead } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Clock,
  Phone,
  PhoneCall,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
  MessageSquare,
  Users,
  RefreshCw,
  ArrowRight,
  Filter,
  Check,
  Flame,
} from "lucide-react";

interface TasksWorkspaceProps {
  roleMode: "admin" | "counselor";
  activeCounselorId?: string;
  users: User[];
  onSelectLeadById: (leadId: number) => void;
  onOpenWhatsApp: (lead: Lead) => void;
}

export function TasksWorkspace({
  roleMode,
  activeCounselorId,
  users,
  onSelectLeadById,
  onOpenWhatsApp,
}: TasksWorkspaceProps) {
  const [tasksData, setTasksData] = useState<{
    overdue: CallbackTask[];
    today: CallbackTask[];
    upcoming: CallbackTask[];
    totalCount: number;
  }>({
    overdue: [],
    today: [],
    upcoming: [],
    totalCount: 0,
  });

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>(
    roleMode === "counselor" && activeCounselorId ? activeCounselorId : "all"
  );
  const [activeTab, setActiveTab] = useState<"today" | "overdue" | "upcoming" | "all">("today");

  const loadTasks = async () => {
    setLoading(true);
    try {
      let url = "/api/tasks";
      const targetCounselor =
        roleMode === "counselor" && activeCounselorId
          ? activeCounselorId
          : selectedCounselorId !== "all"
          ? selectedCounselorId
          : null;

      if (targetCounselor) {
        url += `?counselor_id=${encodeURIComponent(targetCounselor)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data && data.today) {
        setTasksData(data);
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [roleMode, activeCounselorId, selectedCounselorId]);

  const filterTasks = (taskList: CallbackTask[]) => {
    if (!search.trim()) return taskList;
    const q = search.toLowerCase();
    return taskList.filter(
      (t) =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.phone || "").includes(q) ||
        t.lead_code.toLowerCase().includes(q) ||
        (t.notes || "").toLowerCase().includes(q)
    );
  };

  const overdueList = filterTasks(tasksData.overdue);
  const todayList = filterTasks(tasksData.today);
  const upcomingList = filterTasks(tasksData.upcoming);
  const allList = [...overdueList, ...todayList, ...upcomingList];

  const getListForCurrentTab = () => {
    switch (activeTab) {
      case "overdue":
        return overdueList;
      case "today":
        return todayList;
      case "upcoming":
        return upcomingList;
      case "all":
      default:
        return allList;
    }
  };

  const currentList = getListForCurrentTab();

  const formatCallbackTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));

      const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateOnly = d.toLocaleDateString([], { month: "short", day: "numeric" });

      if (diffHours < 0) {
        return {
          formatted: `${dateOnly} at ${timeStr}`,
          relative: `${Math.abs(diffHours)}h overdue`,
          isOverdue: true,
        };
      } else if (diffHours === 0) {
        return {
          formatted: `Today at ${timeStr}`,
          relative: "Due now",
          isOverdue: false,
        };
      } else {
        return {
          formatted: `${dateOnly} at ${timeStr}`,
          relative: `in ${diffHours}h`,
          isOverdue: false,
        };
      }
    } catch {
      return { formatted: dateStr, relative: "", isOverdue: false };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Dedicated Follow-Up & Callbacks Command Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Scheduled Tasks & Callbacks
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Never lose a lead to dropped follow-ups. Prioritize overdue student callbacks,
            place 1-click calls, and send instant WhatsApp confirmations.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadTasks}
          disabled={loading}
          className="h-8 text-xs gap-1.5 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Tasks</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div
          onClick={() => setActiveTab("overdue")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "overdue"
              ? "bg-red-500/10 border-red-500/40 shadow-xs ring-1 ring-red-500/30"
              : "bg-card border-border/80 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Overdue Callbacks</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-2">
            {tasksData.overdue.length}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">High urgency: missed scheduled slot</p>
        </div>

        <div
          onClick={() => setActiveTab("today")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "today"
              ? "bg-amber-500/10 border-amber-500/40 shadow-xs ring-1 ring-amber-500/30"
              : "bg-card border-border/80 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Due Today</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-2">
            {tasksData.today.length}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Scheduled for today&apos;s calling queue</p>
        </div>

        <div
          onClick={() => setActiveTab("upcoming")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "upcoming"
              ? "bg-blue-500/10 border-blue-500/40 shadow-xs ring-1 ring-blue-500/30"
              : "bg-card border-border/80 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Upcoming This Week</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-2">
            {tasksData.upcoming.length}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Future booked consultations</p>
        </div>

        <div
          onClick={() => setActiveTab("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-primary/10 border-primary/40 shadow-xs ring-1 ring-primary/30"
              : "bg-card border-border/80 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Pending Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">
            {tasksData.totalCount}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Active callback pipeline</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("today")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === "today" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Due Today</span>
            <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1">
              {tasksData.today.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab("overdue")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === "overdue" ? "bg-card text-red-600 dark:text-red-400 shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Overdue</span>
            <Badge variant="destructive" className="text-[10px] font-mono h-4 px-1">
              {tasksData.overdue.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab("upcoming")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === "upcoming" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Upcoming</span>
            <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1">
              {tasksData.upcoming.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === "all" ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>All Tasks</span>
            <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1">
              {tasksData.totalCount}
            </Badge>
          </button>
        </div>

        {/* Search & Counselor Filter */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {roleMode === "admin" && (
            <select
              value={selectedCounselorId}
              onChange={(e) => setSelectedCounselorId(e.target.value)}
              className="h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Counselors</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student, phone, or notes..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Task Cards List */}
      {loading ? (
        <div className="py-24 text-center text-xs text-muted-foreground bg-card border rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary opacity-60" />
          <span>Loading scheduled tasks from database...</span>
        </div>
      ) : currentList.length === 0 ? (
        <div className="py-24 text-center bg-card border rounded-2xl shadow-sm space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            Zero Pending Tasks in This Category
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            All callbacks have been attended to! Switch tabs or use the Leads Workspace to schedule new follow-ups.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {currentList.map((task) => {
            const timeInfo = formatCallbackTime(task.callback_at);

            return (
              <div
                key={task.lead_id}
                className="bg-card border border-border/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => onSelectLeadById(task.lead_id)}>
                          {task.name || "Student Lead"}
                        </span>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {task.lead_code}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span className="font-mono">{task.phone || "No phone"}</span>
                        {task.assigned_user_name && (
                          <>
                            <span>•</span>
                            <span className="text-foreground/80 font-medium">
                              {task.assigned_user_name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <Badge
                        variant={timeInfo.isOverdue ? "destructive" : "secondary"}
                        className="text-[10px] font-semibold"
                      >
                        {timeInfo.relative}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {timeInfo.formatted}
                      </div>
                    </div>
                  </div>

                  {/* Notes / Reason */}
                  {task.notes && (
                    <div className="mt-3 p-2.5 rounded-xl bg-muted/30 border border-border/60 text-xs text-foreground/90 font-sans line-clamp-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground inline mr-1.5 -mt-0.5" />
                      <span>{task.notes}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5">
                    {task.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => (window.location.href = `tel:${task.phone}`)}
                        className="h-7 text-xs px-2.5 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        title="Direct Phone Call"
                      >
                        <PhoneCall className="w-3 h-3 text-emerald-500" />
                        <span>Call</span>
                      </Button>
                    )}

                    {task.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const syntheticLead: Lead = {
                            id: task.lead_id,
                            lead_code: task.lead_code,
                            name: task.name,
                            phone: task.phone,
                            email: null,
                            status: task.status || "Follow-up",
                            assigned_to: task.assigned_to || null,
                            assigned_at: null,
                            campaign_id: null,
                            disposition_id: null,
                            sub_disposition_id: null,
                            callback_at: task.callback_at,
                            raw_attributes: {},
                            notes: task.notes,
                            created_at: task.callback_at,
                            updated_at: task.callback_at,
                          };
                          onOpenWhatsApp(syntheticLead);
                        }}
                        className="h-7 text-xs px-2.5 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        title="Send WhatsApp Template"
                      >
                        <MessageSquare className="w-3 h-3 text-emerald-500" />
                        <span>WhatsApp</span>
                      </Button>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelectLeadById(task.lead_id)}
                    className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <span>View Lead Details</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
