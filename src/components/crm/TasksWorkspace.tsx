"use client";

import React, { useState, useEffect } from "react";
import { User, Lead, TaskPriority } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Clock,
  PhoneCall,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Search,
  MessageSquare,
  RefreshCw,
  ArrowRight,
  Flame,
  Zap,
  Bookmark,
  Check,
  CheckCheck,
  Loader2,
  Tag,
  Target,
  UserCheck,
} from "lucide-react";

export interface UnifiedTaskItem {
  id: number;
  lead_id: number;
  lead_code: string;
  lead_name?: string | null;
  name?: string | null;
  lead_phone?: string | null;
  phone?: string | null;
  lead_status?: string;
  status: string;
  assigned_to?: string | null;
  assigned_user_name?: string | null;
  title: string;
  description?: string | null;
  notes?: string | null;
  priority: TaskPriority;
  due_date?: string;
  callback_at?: string;
  created_by?: string;
  source_action?: string;
  is_callback?: boolean;
  completed_at?: string | null;
}

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
    overdue: UnifiedTaskItem[];
    today: UnifiedTaskItem[];
    upcoming: UnifiedTaskItem[];
    completed: UnifiedTaskItem[];
    totalCount: number;
    crmSummary?: {
      total: number;
      urgentCount: number;
      highCount: number;
      normalCount: number;
      lowCount: number;
      pendingCount: number;
      completedCount: number;
      overdueCount: number;
    };
  }>({
    overdue: [],
    today: [],
    upcoming: [],
    completed: [],
    totalCount: 0,
  });

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCounselorId, setSelectedCounselorId] = useState<string>(
    roleMode === "counselor" && activeCounselorId ? activeCounselorId : "all"
  );
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"today" | "overdue" | "upcoming" | "completed" | "all">("today");
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    try {
      let url = "/api/tasks";
      const params = new URLSearchParams();

      const targetCounselor =
        roleMode === "counselor" && activeCounselorId
          ? activeCounselorId
          : selectedCounselorId !== "all"
          ? selectedCounselorId
          : null;

      if (targetCounselor) params.append("counselor_id", targetCounselor);
      if (selectedPriority !== "all") params.append("priority", selectedPriority);
      if (search.trim()) params.append("search", search.trim());

      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data && data.today) {
        setTasksData({
          overdue: data.overdue || [],
          today: data.today || [],
          upcoming: data.upcoming || [],
          completed: data.completed || [],
          totalCount: data.totalCount || 0,
          crmSummary: data.crmSummary,
        });
      }
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [roleMode, activeCounselorId, selectedCounselorId, selectedPriority]);

  const handleCompleteTask = async (task: UnifiedTaskItem) => {
    setCompletingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("Failed to mark task completed");

      // Optimistic state update
      setTasksData((prev) => {
        const removeFilter = (list: UnifiedTaskItem[]) => list.filter((t) => t.id !== task.id);
        const completedTask: UnifiedTaskItem = {
          ...task,
          status: "completed",
          completed_at: new Date().toISOString(),
        };

        return {
          ...prev,
          overdue: removeFilter(prev.overdue),
          today: removeFilter(prev.today),
          upcoming: removeFilter(prev.upcoming),
          completed: [completedTask, ...(prev.completed || [])],
          totalCount: Math.max(0, prev.totalCount - 1),
        };
      });
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setCompletingTaskId(null);
    }
  };

  const filterTasks = (taskList: UnifiedTaskItem[]) => {
    let list = taskList;
    if (selectedPriority !== "all") {
      list = list.filter((t) => t.priority === selectedPriority);
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (t) =>
        (t.name || t.lead_name || "").toLowerCase().includes(q) ||
        (t.phone || t.lead_phone || "").includes(q) ||
        (t.lead_code || "").toLowerCase().includes(q) ||
        (t.title || "").toLowerCase().includes(q) ||
        (t.notes || t.description || "").toLowerCase().includes(q)
    );
  };

  const overdueList = filterTasks(tasksData.overdue);
  const todayList = filterTasks(tasksData.today);
  const upcomingList = filterTasks(tasksData.upcoming);
  const completedList = filterTasks(tasksData.completed);
  const allList = [...overdueList, ...todayList, ...upcomingList, ...completedList];

  const getListForCurrentTab = () => {
    switch (activeTab) {
      case "overdue":
        return overdueList;
      case "today":
        return todayList;
      case "upcoming":
        return upcomingList;
      case "completed":
        return completedList;
      case "all":
      default:
        return allList;
    }
  };

  const currentList = getListForCurrentTab();

  const formatTaskTime = (dateStr?: string) => {
    if (!dateStr) return { formatted: "Flexible", relative: "No SLA", isOverdue: false };
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

  const renderPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "urgent":
        return (
          <Badge className="bg-red-500/15 text-red-600 border border-red-500/30 text-[10px] font-bold gap-1 px-2 py-0.5">
            <Flame className="w-3 h-3 text-red-500 fill-red-500" />
            <span>URGENT</span>
          </Badge>
        );
      case "high":
        return (
          <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 text-[10px] font-bold gap-1 px-2 py-0.5">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>HIGH</span>
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5">
            LOW
          </Badge>
        );
      case "normal":
      default:
        return (
          <Badge className="bg-blue-500/15 text-blue-600 border border-blue-500/30 text-[10px] font-semibold gap-1 px-2 py-0.5">
            NORMAL
          </Badge>
        );
    }
  };

  const renderSourceBadge = (source?: string) => {
    if (!source) return null;
    switch (source) {
      case "bulk_assign":
        return (
          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0 font-medium">
            <UserCheck className="w-2.5 h-2.5 text-primary" />
            <span>Bulk Assign</span>
          </Badge>
        );
      case "bulk_campaign":
        return (
          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0 font-medium">
            <Target className="w-2.5 h-2.5 text-amber-500" />
            <span>Campaign</span>
          </Badge>
        );
      case "bulk_tags":
        return (
          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0 font-medium">
            <Bookmark className="w-2.5 h-2.5 text-blue-500" />
            <span>Tagged</span>
          </Badge>
        );
      case "callback":
        return (
          <Badge variant="secondary" className="text-[9px] gap-1 px-1.5 py-0 font-medium">
            <PhoneCall className="w-2.5 h-2.5 text-emerald-500" />
            <span>Callback</span>
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Prioritized Follow-Up & Callbacks Command Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Tasks, Callbacks & Counselor Priorities
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Never drop a lead. Follow-up tasks auto-generated from bulk assignments, campaign switches,
            and tag updates are routed here sorted by TL priority and SLA.
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
            <span className="text-xs font-semibold text-muted-foreground">Overdue SLA</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400 mt-2">
            {tasksData.overdue.length}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Missed SLA: needs immediate attention</p>
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
          <p className="text-[10px] text-muted-foreground mt-0.5">Today&apos;s active calling queue</p>
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
            <span className="text-xs font-semibold text-muted-foreground">Upcoming</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-2">
            {tasksData.upcoming.length}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Future booked consultations & tasks</p>
        </div>

        <div
          onClick={() => setActiveTab("completed")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === "completed"
              ? "bg-emerald-500/10 border-emerald-500/40 shadow-xs ring-1 ring-emerald-500/30"
              : "bg-card border-border/80 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Completed Tasks</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-2">
            {tasksData.completed.length}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Resolved follow-up items</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border w-full md:w-auto overflow-x-auto">
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
            onClick={() => setActiveTab("completed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === "completed" ? "bg-card text-emerald-600 shadow-2xs font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Completed</span>
            <Badge variant="secondary" className="text-[10px] font-mono h-4 px-1">
              {tasksData.completed.length}
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

        {/* Priority Filter Pills & Search */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          {/* Priority filter */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border">
            {["all", "urgent", "high", "normal", "low"].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPriority(p)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold capitalize transition-colors ${
                  selectedPriority === p
                    ? "bg-card text-foreground shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p === "all" ? "All Pri" : p}
              </button>
            ))}
          </div>

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

          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student, task title..."
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Task Cards List */}
      {loading ? (
        <div className="py-24 text-center text-xs text-muted-foreground bg-card border rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary opacity-60" />
          <span>Loading priority tasks from database...</span>
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
            All priority follow-ups have been completed! Switch tabs or use bulk actions to allocate new student queues.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {currentList.map((task) => {
            const timeInfo = formatTaskTime(task.due_date || task.callback_at);
            const studentName = task.name || task.lead_name || "Student Lead";
            const studentPhone = task.phone || task.lead_phone;
            const isCompleted = task.status === "completed";

            return (
              <div
                key={task.id}
                className={`bg-card border rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between gap-3 group ${
                  isCompleted
                    ? "opacity-60 bg-muted/20 border-border/50"
                    : task.priority === "urgent"
                    ? "border-red-500/30 hover:border-red-500/50"
                    : "border-border/80"
                }`}
              >
                <div>
                  {/* Top Bar: Lead Name, Priority Pill, Source Badge, Due Time */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {renderPriorityBadge(task.priority)}
                        {renderSourceBadge(task.source_action)}
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {task.lead_code}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <span
                          className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer"
                          onClick={() => onSelectLeadById(task.lead_id)}
                        >
                          {studentName}
                        </span>
                        {task.assigned_user_name && (
                          <span className="text-[11px] text-muted-foreground">
                            • Assigned to: <strong className="text-foreground/90">{task.assigned_user_name}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <Badge
                        variant={isCompleted ? "secondary" : timeInfo.isOverdue ? "destructive" : "secondary"}
                        className="text-[10px] font-semibold"
                      >
                        {isCompleted ? "Completed" : timeInfo.relative}
                      </Badge>
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {timeInfo.formatted}
                      </div>
                    </div>
                  </div>

                  {/* Task Title & Instructions */}
                  <div className="mt-2.5 p-2.5 rounded-xl bg-muted/30 border border-border/60 text-xs text-foreground/90 space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      {isCompleted ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-primary" />
                      )}
                      <span>{task.title}</span>
                    </div>
                    {(task.description || task.notes) && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {task.description || task.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5">
                    {/* Mark Complete Button */}
                    {!isCompleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCompleteTask(task)}
                        disabled={completingTaskId === task.id}
                        className="h-7 text-xs px-2.5 gap-1 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 font-medium"
                        title="Mark task done"
                      >
                        {completingTaskId === task.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        <span>Done</span>
                      </Button>
                    )}

                    {studentPhone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => (window.location.href = `tel:${studentPhone}`)}
                        className="h-7 text-xs px-2.5 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        title="Direct Phone Call"
                      >
                        <PhoneCall className="w-3 h-3 text-emerald-500" />
                        <span>Call</span>
                      </Button>
                    )}

                    {studentPhone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const syntheticLead: Lead = {
                            id: task.lead_id,
                            lead_code: task.lead_code,
                            name: studentName,
                            phone: studentPhone,
                            email: null,
                            status: task.lead_status || "Follow-up",
                            assigned_to: task.assigned_to || null,
                            assigned_at: null,
                            campaign_id: null,
                            disposition_id: null,
                            sub_disposition_id: null,
                            callback_at: task.callback_at || null,
                            raw_attributes: {},
                            notes: task.description || task.notes || null,
                            created_at: task.due_date || new Date().toISOString(),
                            updated_at: task.due_date || new Date().toISOString(),
                          };
                          onOpenWhatsApp(syntheticLead);
                        }}
                        className="h-7 text-xs px-2.5 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        title="Send WhatsApp Message"
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
                    <span>View Lead</span>
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
