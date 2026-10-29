"use client";

import React, { useState } from "react";
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
  Loader2,
} from "lucide-react";
import { ApiClient } from "@/lib/api/apiClient";

interface PipelineKanbanViewProps {
  leads: Lead[];
  onViewLeadDetails: (lead: Lead) => void;
  onUpdateLeadStatus: (leadId: number, status: string) => void;
}

const STAGES = [
  { id: "New", title: "New Inquiries", color: "border-blue-500/30 bg-blue-500/[0.03]", badge: "bg-blue-500/10 text-blue-600", next: "Contacted" },
  { id: "Contacted", title: "Contacted", color: "border-amber-500/30 bg-amber-500/[0.03]", badge: "bg-amber-500/10 text-amber-600", next: "Interested" },
  { id: "Interested", title: "Interested / Qualified", color: "border-emerald-500/30 bg-emerald-500/[0.03]", badge: "bg-emerald-500/10 text-emerald-600", next: "Follow-up" },
  { id: "Follow-up", title: "Follow-up Scheduled", color: "border-violet-500/30 bg-violet-500/[0.03]", badge: "bg-violet-500/10 text-violet-600", next: "Admitted" },
  { id: "Admitted", title: "Admitted / Enrolled", color: "border-purple-500/30 bg-purple-500/[0.03]", badge: "bg-purple-500/10 text-purple-600", next: null },
  { id: "Not Interested", title: "Closed / Lost", color: "border-rose-500/30 bg-rose-500/[0.03]", badge: "bg-rose-500/10 text-rose-600", next: null },
];

export function PipelineKanbanView({
  leads,
  onViewLeadDetails,
  onUpdateLeadStatus,
}: PipelineKanbanViewProps) {
  const [dialingLeadId, setDialingLeadId] = useState<number | null>(null);

  const handleTriggerCall = async (leadId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDialingLeadId(leadId);
      const { data, error } = await ApiClient.fetchJson<{ success: boolean; dialUri: string }>(
        `/api/leads/${leadId}/call-intent`,
        { method: "POST" }
      );
      if (error) throw new Error(error.message);
      if (data?.dialUri) {
        window.location.href = data.dialUri;
      }
    } catch (err: any) {
      console.error("Dial failed:", err);
      alert(err.message || "Failed to trigger call dialer");
    } finally {
      setDialingLeadId(null);
    }
  };

  const handleTriggerWhatsApp = async (leadId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data, error } = await ApiClient.fetchJson<{ success: boolean; launchUrl: string }>(
        `/api/leads/${leadId}/whatsapp-intent`,
        { method: "POST" }
      );
      if (error) throw new Error(error.message);
      if (data?.launchUrl) {
        window.open(data.launchUrl, "_blank");
      }
    } catch (err: any) {
      console.error("WhatsApp intent failed:", err);
      alert(err.message || "Failed to launch WhatsApp");
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 pt-0.5 min-h-[550px]">
      {STAGES.map((stage) => {
        const stageLeads = leads.filter(
          (l) => l.status.toLowerCase() === stage.id.toLowerCase()
        );

        return (
          <div
            key={stage.id}
            className={`w-72 shrink-0 border rounded-xl flex flex-col ${stage.color} backdrop-blur-xs`}
          >
            {/* Column Header */}
            <div className="px-3 py-2 border-b flex items-center justify-between bg-card/70 rounded-t-xl">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-xs text-foreground">
                  {stage.title}
                </span>
                <Badge className={`text-[10px] font-mono px-1.5 py-0 ${stage.badge}`}>
                  {stageLeads.length}
                </Badge>
              </div>
            </div>

            {/* Cards List */}
            <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-270px)]">
              {stageLeads.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-card/30">
                  No leads in this stage
                </div>
              ) : (
                stageLeads.map((lead) => (
                  <Card
                    key={lead.id}
                    onClick={() => onViewLeadDetails(lead)}
                    className="p-2.5 bg-card hover:border-primary/50 cursor-pointer shadow-2xs hover:shadow-xs transition-all space-y-2 rounded-lg"
                  >
                    {/* Top Row: Code & Counselor */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-muted-foreground font-semibold">
                        {lead.lead_code}
                      </span>
                      {lead.assigned_user_name ? (
                        <div className="flex items-center gap-1">
                          <div
                            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
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
                          Unallocated
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
                          <span className="truncate text-[11px]">{lead.raw_attributes.school}</span>
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
                      <div className="space-y-1 pt-0.5">
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
                            <span className="truncate max-w-[170px]">{lead.disposition_name}</span>
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
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/60 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-muted-foreground text-[10px]">
                          {lead.phone || "No phone"}
                        </span>
                        {lead.phone && (
                          <>
                            <button
                              onClick={(e) => handleTriggerCall(lead.id, e)}
                              disabled={dialingLeadId === lead.id}
                              className="p-1 rounded text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                              title="Call Student via Secure Intent"
                            >
                              {dialingLeadId === lead.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <PhoneCall className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={(e) => handleTriggerWhatsApp(lead.id, e)}
                              className="p-1 rounded text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              title="WhatsApp Student via Secure Intent"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
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
                          className="h-6 px-1.5 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10 font-medium cursor-pointer"
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
