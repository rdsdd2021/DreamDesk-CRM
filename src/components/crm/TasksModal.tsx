"use client";

import React, { useState, useEffect } from "react";
import { CallbackTask } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  User,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCounselorId?: string;
  roleMode: "admin" | "counselor";
  onSelectLeadById: (leadId: number) => void;
}

export function TasksModal({
  isOpen,
  onClose,
  activeCounselorId,
  roleMode,
  onSelectLeadById,
}: TasksModalProps) {
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
  const [activeTab, setActiveTab] = useState<"today" | "overdue" | "upcoming">("today");
  const [dialingTaskId, setDialingTaskId] = useState<number | null>(null);

  const handleTaskCall = async (leadId: number) => {
    try {
      setDialingTaskId(leadId);
      const res = await fetch(`/api/leads/${leadId}/call-intent`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger call");
      if (data.dialUri) {
        window.location.href = data.dialUri;
      }
    } catch (err: any) {
      alert(err.message || "Failed to initiate call");
    } finally {
      setDialingTaskId(null);
    }
  };

  const handleTaskWhatsApp = async (leadId: number) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/whatsapp-intent`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to launch WhatsApp");
      if (data.whatsappUri) {
        window.open(data.whatsappUri, "_blank");
      }
    } catch (err: any) {
      alert(err.message || "Failed to launch WhatsApp");
    }
  };

  const loadTasks = async () => {
    setLoading(true);
    try {
      const url = roleMode === "counselor" && activeCounselorId
        ? `/api/tasks?counselor_id=${encodeURIComponent(activeCounselorId)}`
        : "/api/tasks";
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
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen, activeCounselorId, roleMode]);

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Scheduled Callbacks & Follow-up Tasks</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {roleMode === "counselor" ? "Your personal queued callbacks" : "All counselors' scheduled follow-ups"}
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-semibold">
              {tasksData.totalCount} active
            </Badge>
          </div>

          {/* Search within tasks */}
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tasks by student name, phone, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-background rounded-lg"
            />
          </div>
        </DialogHeader>

        {/* Tab Buckets: Today, Overdue, Upcoming */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-2 border-b bg-muted/10">
            <TabsList className="grid grid-cols-3 h-8">
              <TabsTrigger value="today" className="text-xs gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Today</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold">
                  {tasksData.today.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="overdue" className="text-xs gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                <span>Overdue</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold">
                  {tasksData.overdue.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                <span>Upcoming</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold">
                  {tasksData.upcoming.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeTab === "today" && renderTaskList(todayList, "today")}
            {activeTab === "overdue" && renderTaskList(overdueList, "overdue")}
            {activeTab === "upcoming" && renderTaskList(upcomingList, "upcoming")}
          </div>
        </Tabs>

        <DialogFooter className="p-3 px-4 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{tasksData.totalCount}</span> scheduled follow-up tasks
          </div>
          <Button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold h-8 px-4 rounded-lg shadow-2xs bg-primary text-primary-foreground cursor-pointer"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function renderTaskList(tasks: CallbackTask[], bucket: "today" | "overdue" | "upcoming") {
    if (loading) {
      return (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Loading scheduled callbacks...
        </div>
      );
    }

    if (tasks.length === 0) {
      return (
        <div className="py-12 text-center space-y-2 text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-70" />
          <p className="text-sm font-semibold text-foreground">No {bucket} callbacks</p>
          <p className="text-xs">
            {bucket === "overdue" ? "Great job! You have zero overdue follow-up calls." : "No follow-up calls scheduled in this queue."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-2.5">
        {tasks.map((task) => {
          const cleanPhone = (task.phone || "").replace(/[^0-9]/g, "");
          const callbackTime = new Date(task.callback_at);

          return (
            <div
              key={`${task.lead_id}-${task.callback_at}`}
              className="p-3.5 rounded-xl border bg-card hover:bg-accent/40 transition-colors shadow-2xs space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {task.lead_code}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {task.name || "Student"}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    {task.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold">
                  <Clock className={`w-3.5 h-3.5 ${bucket === "overdue" ? "text-rose-500" : bucket === "today" ? "text-amber-500" : "text-emerald-500"}`} />
                  <span className={bucket === "overdue" ? "text-rose-600 font-bold" : "text-foreground"}>
                    {callbackTime.toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {/* Disposition & Counselor Info */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {task.disposition_name && (
                  <span className="font-medium text-foreground">
                    Reason: <span className="font-semibold">{task.disposition_name}</span>
                    {task.sub_disposition_name && (
                      <span className="text-primary font-normal"> ({task.sub_disposition_name})</span>
                    )}
                  </span>
                )}
                {task.assigned_user_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{task.assigned_user_name}</span>
                  </span>
                )}
              </div>

              {/* Notes Snippet */}
              {task.notes && (
                <p className="text-[11px] text-muted-foreground line-clamp-1 italic bg-muted/40 p-1.5 rounded-md">
                  "{task.notes.split("\n")[0]}"
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1 border-t">
                <div className="flex items-center gap-1.5">
                  {task.phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      disabled={dialingTaskId === task.lead_id}
                      onClick={() => handleTaskCall(task.lead_id)}
                      title="Direct Phone Call via secure dialer"
                    >
                      {dialingTaskId === task.lead_id ? (
                        <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                      ) : (
                        <Phone className="w-3 h-3" />
                      )}
                      <span>{dialingTaskId === task.lead_id ? "Calling..." : "Call"}</span>
                    </Button>
                  )}
                  {task.phone && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => handleTaskWhatsApp(task.lead_id)}
                      title="Direct WhatsApp Message"
                    >
                      <MessageSquare className="w-3 h-3 text-emerald-600" />
                      <span>WhatsApp</span>
                    </Button>
                  )}
                </div>

                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 font-semibold"
                  onClick={() => {
                    onClose();
                    onSelectLeadById(task.lead_id);
                  }}
                >
                  <span>Open Lead & Log Call</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}
