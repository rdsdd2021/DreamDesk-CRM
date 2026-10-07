"use client";

import React, { useState, useEffect } from "react";
import { User, UserNotification, TaskPriority } from "@/types/crm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCheck, Clock, Flame, Zap, Shield, Sparkles } from "lucide-react";

interface NotificationBellProps {
  currentUser?: User | null;
  onNavigateToTasks?: () => void;
}

export function NotificationBell({ currentUser, onNavigateToTasks }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/notifications?user_id=${encodeURIComponent(currentUser.id)}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, user_id: currentUser?.id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true, user_id: currentUser?.id }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return dateStr;
    }
  };

  const renderPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case "urgent":
        return <Flame className="w-3 h-3 text-red-500 shrink-0" />;
      case "high":
        return <Zap className="w-3 h-3 text-amber-500 shrink-0" />;
      case "normal":
      default:
        return <Clock className="w-3 h-3 text-blue-500 shrink-0" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        className="relative h-9 w-9 rounded-xl border border-border/80 bg-card hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer shadow-2xs"
        title="Notifications & Caller Task Alerts"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-xs animate-in zoom-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 overflow-hidden rounded-2xl shadow-2xl border border-border/80"
      >
        <div className="p-3.5 bg-muted/40 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Notifications & Alerts</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 font-bold">
                {unreadCount} new
              </Badge>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
              <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
              <p className="font-semibold text-foreground">All caught up!</p>
              <p className="text-[11px]">No pending tasks or system alerts.</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.is_read) handleMarkAsRead(item.id);
                  if (item.type === "task" && onNavigateToTasks) {
                    onNavigateToTasks();
                    setIsOpen(false);
                  }
                }}
                className={`p-3 transition-colors cursor-pointer flex items-start gap-2.5 ${
                  item.is_read
                    ? "bg-card hover:bg-muted/30 opacity-70"
                    : "bg-primary/5 hover:bg-primary/10"
                }`}
              >
                <div className="mt-0.5">{renderPriorityIcon(item.priority)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-foreground truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {formatTimeAgo(item.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-foreground/80 mt-0.5 line-clamp-2">
                    {item.message}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] font-mono capitalize px-1 py-0 h-3.5"
                    >
                      {item.priority}
                    </Badge>
                    {item.type === "task" && (
                      <span className="text-[10px] text-primary font-medium hover:underline">
                        View in Tasks →
                      </span>
                    )}
                  </div>
                </div>

                {!item.is_read && (
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                )}
              </div>
            ))
          )}
        </div>

        {onNavigateToTasks && (
          <div className="p-2 bg-muted/20 border-t border-border/60 text-center">
            <button
              onClick={() => {
                onNavigateToTasks();
                setIsOpen(false);
              }}
              className="text-xs font-semibold text-primary hover:underline py-1 w-full"
            >
              Go to Tasks & Callbacks Workspace →
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
