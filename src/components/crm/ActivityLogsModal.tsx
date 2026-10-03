"use client";

import React, { useEffect, useState } from "react";
import { ActivityLog } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, UserCheck, Tag, Trash2, Upload, Clock } from "lucide-react";

interface ActivityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityLogsModal({ isOpen, onClose }: ActivityLogsModalProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch("/api/activity")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setLogs(data);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case "bulk_assign":
        return <UserCheck className="w-3.5 h-3.5 text-blue-500" />;
      case "status_update":
        return <Tag className="w-3.5 h-3.5 text-amber-500" />;
      case "import":
        return <Upload className="w-3.5 h-3.5 text-emerald-500" />;
      case "bulk_delete":
        return <Trash2 className="w-3.5 h-3.5 text-rose-500" />;
      default:
        return <History className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 bg-muted/40 border-b">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <History className="w-4 h-4" />
            <span>Audit Trail</span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Activity & Bulk Operations Log
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Complete historical log of all bulk assignments, status shifts, and data imports.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2.5">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Loading activity logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No activity logs recorded yet.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border bg-card text-xs space-y-1.5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    {getActionIcon(log.action_type)}
                    <span>{log.description}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {log.affected_count.toLocaleString()} leads
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
                  <span>By {log.performed_by || "Admin"}</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted-foreground/70" />
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
