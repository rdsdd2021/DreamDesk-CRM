"use client";

import React from "react";
import { Lead } from "@/types/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  GraduationCap,
  Phone,
  Mail,
  ArrowRight,
  School,
  Clock,
  Sparkles,
  MessageSquare,
  PhoneCall,
  Target,
} from "lucide-react";

interface PipelineKanbanViewProps {
  leads: Lead[];
  onViewLeadDetails: (lead: Lead) => void;
  onUpdateLeadStatus: (leadId: number, status: string) => void;
}

const STAGES = [
  { id: "New", title: "New Inquiries", color: "border-blue-500/40 bg-blue-500/5", badge: "bg-blue-500/10 text-blue-600", next: "Contacted" },
  { id: "Contacted", title: "Contacted", color: "border-amber-500/40 bg-amber-500/5", badge: "bg-amber-500/10 text-amber-600", next: "Interested" },
  { id: "Interested", title: "Interested / Qualified", color: "border-emerald-500/40 bg-emerald-500/5", badge: "bg-emerald-500/10 text-emerald-600", next: "Follow-up" },
  { id: "Follow-up", title: "Follow-up Scheduled", color: "border-violet-500/40 bg-violet-500/5", badge: "bg-violet-500/10 text-violet-600", next: "Admitted" },
  { id: "Admitted", title: "Admitted / Enrolled", color: "border-purple-500/40 bg-purple-500/5", badge: "bg-purple-500/10 text-purple-600", next: null },
  { id: "Not Interested", title: "Closed / Lost", color: "border-rose-500/40 bg-rose-500/5", badge: "bg-rose-500/10 text-rose-600", next: null },
];

export function PipelineKanbanView({
  leads,
  onViewLeadDetails,
  onUpdateLeadStatus,
}: PipelineKanbanViewProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-1 min-h-[600px]">
      {STAGES.map((stage) => {
        const stageLeads = leads.filter(
          (l) => l.status.toLowerCase() === stage.id.toLowerCase()
        );

        return (
          <div
            key={stage.id}
            className={`w-80 shrink-0 border-2 rounded-2xl flex flex-col ${stage.color} backdrop-blur-xs`}
          >
            {/* Column Header */}
            <div className="p-3.5 border-b flex items-center justify-between bg-card/60 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-foreground">
                  {stage.title}
                </span>
                <Badge className={`text-[10px] font-mono px-1.5 py-0 ${stage.badge}`}>
                  {stageLeads.length}
                </Badge>
              </div>
            </div>

            {/* Cards List */}
            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
              {stageLeads.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border-2 border-dashed rounded-xl bg-card/40">
                  No leads in this stage
                </div>
              ) : (
                stageLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    onClick={() => onViewLeadDetails(lead)}
                    className="p-3.5 bg-card hover:border-primary/60 cursor-pointer shadow-xs hover:shadow-md transition-all space-y-2.5"
                  >
                    {/* Top Row: Code & Counselor */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-muted-foreground font-semibold">
                        {lead.lead_code}
                      </span>
                      {lead.assigned_user_name ? (
                        <div className="flex items-center gap-1">
                          <div
                            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ backgroundColor: lead.assigned_user_color || "#3b82f6" }}
                          >
                            {lead.assigned_user_name.charAt(0)}
                          </div>
                          <span className="text-[10px] font-medium text-foreground truncate max-w-[80px]">
                            {lead.assigned_user_name.split(" ")[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </div>

                    {/* Student Name */}
                    <div className="font-bold text-xs text-foreground truncate">
                      {lead.name || "Unnamed Student"}
                    </div>

                    {/* School & Stream */}
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {lead.raw_attributes.school && (
                        <div className="flex items-center gap-1.5 truncate">
                          <School className="w-3 h-3 shrink-0 text-muted-foreground/70" />
                          <span className="truncate">{lead.raw_attributes.school}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-1">
                        {lead.raw_attributes.stream && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">
                            {lead.raw_attributes.stream}
                          </Badge>
                        )}
                        {lead.campaign_name && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal bg-muted">
                            {lead.campaign_name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Disposition & Callback Badge */}
                    {(lead.disposition_name || lead.callback_at) && (
                      <div className="space-y-1 pt-1">
                        {lead.disposition_name && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              backgroundColor: `${lead.disposition_color || "#3b82f6"}18`,
                              color: lead.disposition_color || "#3b82f6",
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: lead.disposition_color || "#3b82f6" }}
                            />
                            <span className="truncate max-w-[180px]">{lead.disposition_name}</span>
                          </span>
                        )}

                        {lead.callback_at && (
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            <Clock className="w-2.5 h-2.5 animate-pulse" />
                            <span>
                              Callback:{" "}
                              {new Date(lead.callback_at).toLocaleString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Contacts & Quick Advance */}
                    <div className="flex items-center justify-between pt-2 border-t text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-muted-foreground text-[10px]">
                          {lead.phone || "No phone"}
                        </span>
                        {lead.phone && (
                          <>
                            <a
                              href={`tel:${lead.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded text-primary hover:bg-primary/10 transition-colors"
                              title="Call Student"
                            >
                              <PhoneCall className="w-3 h-3" />
                            </a>
                            <a
                              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                              title="WhatsApp Student"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </a>
                          </>
                        )}
                      </div>

                      {stage.next && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateLeadStatus(lead.id, stage.next!);
                          }}
                          className="h-6 px-1.5 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10 font-medium"
                        >
                          <span>Move</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </Button>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
