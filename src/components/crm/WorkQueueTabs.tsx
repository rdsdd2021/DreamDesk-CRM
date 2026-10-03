"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Clock,
  Flame,
  PhoneForwarded,
  PhoneOff,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";

export type WorkQueueId = "all" | "callbacks" | "unassigned" | "high_intent" | "followups" | "unreached";

interface WorkQueueTabsProps {
  activeQueue: WorkQueueId;
  onSelectQueue: (queueId: WorkQueueId) => void;
  unassignedCount: number;
  callbacksCount?: number;
  myLeadsCount?: number;
  roleMode: "admin" | "counselor";
  onClaimLeads?: () => void;
  claimingLeads?: boolean;
  onOpenTasks?: () => void;
  onAutoDistribute?: () => void;
  isAutoDistributing?: boolean;
}

export function WorkQueueTabs({
  activeQueue,
  onSelectQueue,
  unassignedCount,
  callbacksCount = 0,
  myLeadsCount,
  roleMode,
  onClaimLeads,
  claimingLeads = false,
  onOpenTasks,
  onAutoDistribute,
  isAutoDistributing = false,
}: WorkQueueTabsProps) {
  const queues = [
    {
      id: "all" as WorkQueueId,
      label: roleMode === "counselor" ? "My Leads" : "All Leads",
      icon: Layers,
      count: roleMode === "counselor" && myLeadsCount !== undefined ? myLeadsCount : null,
      shortcut: "1",
    },
    {
      id: "callbacks" as WorkQueueId,
      label: "Urgent Callbacks",
      icon: Clock,
      count: callbacksCount > 0 ? callbacksCount : null,
      badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      shortcut: "2",
    },
    ...(roleMode !== "counselor"
      ? [
          {
            id: "unassigned" as WorkQueueId,
            label: "Unassigned Pool",
            icon: Inbox,
            count: unassignedCount,
            badgeColor: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
            shortcut: "3",
          },
        ]
      : []),
    {
      id: "high_intent" as WorkQueueId,
      label: "High Intent",
      icon: Flame,
      count: null,
      badgeColor: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      shortcut: "4",
    },
    {
      id: "followups" as WorkQueueId,
      label: "Pending Follow-up",
      icon: PhoneForwarded,
      count: null,
      badgeColor: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
    },
    {
      id: "unreached" as WorkQueueId,
      label: "RNR / Unreached",
      icon: PhoneOff,
      count: null,
      badgeColor: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
    },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
      {/* Horizontal Scrollable Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {queues.map((q) => {
          const Icon = q.icon;
          const isActive = activeQueue === q.id;

          return (
            <button
              key={q.id}
              onClick={() => onSelectQueue(q.id)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border ${
                isActive
                  ? "bg-foreground text-background border-foreground shadow-xs font-semibold"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 border-border/70"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-background" : "text-muted-foreground"}`} />
              <span>{q.label}</span>
              {q.count !== null && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${
                    isActive
                      ? "bg-background/20 text-background border-transparent"
                      : q.badgeColor || "bg-muted text-muted-foreground border-border/80"
                  }`}
                >
                  {q.count.toLocaleString()}
                </span>
              )}
              {q.shortcut && (
                <span
                  className={`hidden md:inline-block text-[9px] font-mono opacity-60 ml-0.5 ${
                    isActive ? "text-background" : "text-muted-foreground"
                  }`}
                >
                  [{q.shortcut}]
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Queue Actions */}
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        {onAutoDistribute && unassignedCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAutoDistribute}
            disabled={isAutoDistributing}
            className="h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-2xs"
            title="Auto-distribute unallocated leads via rules & round-robin"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{isAutoDistributing ? "Distributing..." : "Auto-Distribute Pool"}</span>
          </Button>
        )}

        {onOpenTasks && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenTasks}
            className="h-8 text-xs font-semibold gap-1.5 border-border/80 hover:bg-muted text-foreground shadow-2xs"
            title="Open Scheduled Callbacks & Tasks (T)"
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Scheduled Tasks</span>
          </Button>
        )}

        {/* Counselor Fast Claim Action Button */}
        {roleMode === "counselor" && onClaimLeads && (
          <Button
            size="sm"
            onClick={onClaimLeads}
            disabled={claimingLeads || unassignedCount === 0}
            className="h-8 text-xs font-semibold gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs shrink-0"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>{claimingLeads ? "Claiming..." : "Claim 25 Fresh Leads"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
