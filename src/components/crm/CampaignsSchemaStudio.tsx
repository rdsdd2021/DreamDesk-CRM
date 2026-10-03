"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SchemaMeta, Campaign, Disposition } from "@/types/crm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DispositionsManagerModal } from "@/components/crm/DispositionsManagerModal";
import { CampaignModal } from "@/components/crm/CampaignModal";
import {
  SlidersHorizontal,
  Target,
  Tag,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Filter,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  TrendingUp,
  Settings2,
  AlertCircle,
  Database,
  Search,
  Hash,
  Calendar,
  ToggleLeft,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface CampaignsSchemaStudioProps {
  initialTab?: "fields" | "campaigns" | "dispositions" | "matrix";
  schemaMeta: SchemaMeta[];
  onSchemaChange: () => void;
  onFilterByCampaign: (campaignId: string, campaignName: string) => void;
  totalLeadsCount: number;
}

export function CampaignsSchemaStudio({
  initialTab = "fields",
  schemaMeta,
  onSchemaChange,
  onFilterByCampaign,
  totalLeadsCount,
}: CampaignsSchemaStudioProps) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Data state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [loading, setLoading] = useState(true);

  // Field creation & editing state
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState<SchemaMeta | null>(null);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldDataType, setFieldDataType] = useState<'string' | 'number' | 'date' | 'boolean'>("string");
  const [fieldFilterType, setFieldFilterType] = useState<'faceted' | 'range' | 'search'>("faceted");
  const [fieldIsFilterable, setFieldIsFilterable] = useState(true);
  const [fieldIsVisible, setFieldIsVisible] = useState(true);
  const [fieldSubmitting, setFieldSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Field Deletion state
  const [fieldToDelete, setFieldToDelete] = useState<SchemaMeta | null>(null);
  const [purgeDataFromLeads, setPurgeDataFromLeads] = useState(true);
  const [deletingField, setDeletingField] = useState(false);

  // Modals state
  const [isDispModalOpen, setIsDispModalOpen] = useState(false);
  const [isCampModalOpen, setIsCampModalOpen] = useState(false);
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
      console.error("Failed to load studio data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset Field Form
  const resetFieldForm = () => {
    setFieldLabel("");
    setFieldKey("");
    setFieldDataType("string");
    setFieldFilterType("faceted");
    setFieldIsFilterable(true);
    setFieldIsVisible(true);
    setEditingField(null);
    setFieldError(null);
  };

  const handleOpenAddField = () => {
    resetFieldForm();
    setIsAddFieldOpen(true);
  };

  const handleOpenEditField = (field: SchemaMeta) => {
    setEditingField(field);
    setFieldLabel(field.display_label);
    setFieldKey(field.key_name);
    setFieldDataType(field.data_type);
    setFieldFilterType(field.filter_type);
    setFieldIsFilterable(Boolean(field.is_filterable));
    setFieldIsVisible(Boolean(field.is_visible));
    setFieldError(null);
    setIsAddFieldOpen(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim() || !fieldKey.trim()) {
      setFieldError("Field label and system key are required.");
      return;
    }

    setFieldSubmitting(true);
    setFieldError(null);

    try {
      if (editingField) {
        // PATCH
        const res = await fetch("/api/schema", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key_name: editingField.key_name,
            updates: {
              display_label: fieldLabel.trim(),
              data_type: fieldDataType,
              filter_type: fieldFilterType,
              is_filterable: fieldIsFilterable ? 1 : 0,
              is_visible: fieldIsVisible ? 1 : 0,
            },
          }),
        });
        if (!res.ok) throw new Error("Failed to update field configuration");
      } else {
        // POST
        const res = await fetch("/api/schema", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key_name: fieldKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            display_label: fieldLabel.trim(),
            data_type: fieldDataType,
            filter_type: fieldFilterType,
            is_filterable: fieldIsFilterable ? 1 : 0,
            is_visible: fieldIsVisible ? 1 : 0,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to create dynamic field");
        }
      }

      onSchemaChange();
      setIsAddFieldOpen(false);
      resetFieldForm();
    } catch (err: any) {
      setFieldError(err.message || "An error occurred");
    } finally {
      setFieldSubmitting(false);
    }
  };

  const handleToggleFieldVisibility = async (field: SchemaMeta) => {
    const nextVal = field.is_visible ? 0 : 1;
    try {
      await fetch("/api/schema", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_name: field.key_name,
          updates: { is_visible: nextVal },
        }),
      });
      onSchemaChange();
    } catch (err) {
      console.error("Failed to toggle visibility:", err);
    }
  };

  const handleToggleFieldFilterable = async (field: SchemaMeta) => {
    const nextVal = field.is_filterable ? 0 : 1;
    try {
      await fetch("/api/schema", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key_name: field.key_name,
          updates: { is_filterable: nextVal },
        }),
      });
      onSchemaChange();
    } catch (err) {
      console.error("Failed to toggle filterable:", err);
    }
  };

  const handleConfirmDeleteField = async () => {
    if (!fieldToDelete) return;
    setDeletingField(true);
    try {
      const res = await fetch(`/api/schema?key=${encodeURIComponent(fieldToDelete.key_name)}&purge=${purgeDataFromLeads}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete field");
      }
      onSchemaChange();
      setFieldToDelete(null);
    } catch (err: any) {
      alert("Error deleting field: " + err.message);
    } finally {
      setDeletingField(false);
    }
  };

  const handleOpenCreateCampaign = () => {
    setSelectedCampaignForEdit(null);
    setIsCampModalOpen(true);
  };

  const handleOpenEditCampaign = (camp: Campaign) => {
    setSelectedCampaignForEdit(camp);
    setIsCampModalOpen(true);
  };

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case "number":
        return <Hash className="w-3 h-3 text-blue-500" />;
      case "date":
        return <Calendar className="w-3 h-3 text-purple-500" />;
      case "boolean":
        return <ToggleLeft className="w-3 h-3 text-emerald-500" />;
      default:
        return <Tag className="w-3 h-3 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-5">
      {/* Studio Header & Navigation Tabs */}
      <div className="bg-card border border-border/80 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-2xs">
              <Layers className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground tracking-tight flex items-center gap-2">
                <span>Campaigns & Schema Operations Studio</span>
                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  Data Engine
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Centralized architectural hub for dynamic fields, campaign attribution, and customized telecalling dispositions.
              </p>
            </div>
          </div>
        </div>

        {/* Global Studio Quick Actions */}
        <div className="flex items-center gap-2">
          {activeTab === "fields" && (
            <Button
              size="sm"
              onClick={handleOpenAddField}
              className="h-8 text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Dynamic Field</span>
            </Button>
          )}

          {activeTab === "campaigns" && (
            <Button
              size="sm"
              onClick={handleOpenCreateCampaign}
              className="h-8 text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Campaign</span>
            </Button>
          )}

          {activeTab === "dispositions" && (
            <Button
              size="sm"
              onClick={() => setIsDispModalOpen(true)}
              className="h-8 text-xs font-semibold gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Disposition</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Studio Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val)}>
        <TabsList className="bg-card border border-border/80 h-10 p-1 w-full sm:w-auto grid grid-cols-4 max-w-xl shadow-2xs">
          <TabsTrigger value="fields" className="text-xs font-medium gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Dynamic Fields ({schemaMeta.length})</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs font-medium gap-1.5">
            <Target className="w-3.5 h-3.5" />
            <span>Campaigns ({campaigns.length})</span>
          </TabsTrigger>
          <TabsTrigger value="dispositions" className="text-xs font-medium gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            <span>Dispositions ({dispositions.length})</span>
          </TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs font-medium gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Linkage Matrix</span>
          </TabsTrigger>
        </TabsList>

        {/* ============================================================== */}
        {/* TAB 1: DYNAMIC SCHEMA & FIELDS STUDIO                          */}
        {/* ============================================================== */}
        <TabsContent value="fields" className="space-y-4 pt-2 m-0">
          <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Registered Lead Attributes ({schemaMeta.length} Dynamic Headers)
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Dynamic headers adapt to arbitrary batch uploads without requiring database schema migrations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-medium">
                  {totalLeadsCount.toLocaleString()} total student leads indexed
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 text-left">Display Label & System Key</th>
                    <th className="py-2.5 px-3 text-left">Data Type</th>
                    <th className="py-2.5 px-3 text-center">Faceted Filter</th>
                    <th className="py-2.5 px-3 text-left">Database Lead Usage</th>
                    <th className="py-2.5 px-3 text-center">Visible in Table</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {schemaMeta.map((field) => {
                    const count = field.lead_count || 0;
                    const usagePercent = totalLeadsCount > 0 ? ((count / totalLeadsCount) * 100).toFixed(0) : "0";

                    return (
                      <tr key={field.id} className="hover:bg-muted/30 transition-colors h-11">
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-muted/60 border border-border/60">
                              {getDataTypeIcon(field.data_type)}
                            </span>
                            <div>
                              <div className="font-semibold text-foreground tracking-tight">
                                {field.display_label}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground">
                                raw_attributes.{field.key_name}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px] capitalize font-medium">
                            {field.data_type}
                          </Badge>
                        </td>

                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleToggleFieldFilterable(field)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                              field.is_filterable
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "bg-muted text-muted-foreground border-border/80"
                            }`}
                          >
                            <span>{field.is_filterable ? "Filterable" : "Off"}</span>
                          </button>
                        </td>

                        <td className="py-2 px-3 min-w-[170px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
                              <span className="font-medium text-foreground">{count.toLocaleString()} leads</span>
                              <span className="text-muted-foreground">{usagePercent}%</span>
                            </div>
                            <Progress value={Math.min(100, parseFloat(usagePercent))} className="h-1 bg-muted" />
                          </div>
                        </td>

                        <td className="py-2 px-3 text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleToggleFieldVisibility(field)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title={field.is_visible ? "Visible in table" : "Hidden from table"}
                          >
                            {field.is_visible ? (
                              <Eye className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5 text-muted-foreground/40" />
                            )}
                          </Button>
                        </td>

                        <td className="py-2 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOpenEditField(field)}
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Edit Field Configuration"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setFieldToDelete(field)}
                              className="h-7 w-7 hover:bg-rose-50 hover:text-rose-600 text-muted-foreground"
                              title="Delete Field"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 2: CAMPAIGNS & SOURCES                                     */}
        {/* ============================================================== */}
        <TabsContent value="campaigns" className="space-y-4 pt-2 m-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((camp) => {
              const total = camp.total_leads || 0;
              const converted = camp.converted_leads || 0;
              const convRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";
              const linkedDisps = (camp.linked_disposition_ids || [])
                .map((id) => dispositions.find((d) => d.id === id))
                .filter(Boolean) as Disposition[];

              return (
                <Card key={camp.id} className="hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-medium bg-muted/40">
                        {camp.channel}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 font-mono">
                          <TrendingUp className="w-3 h-3" /> {convRate}% Conversion
                        </span>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          {camp.status}
                        </Badge>
                      </div>
                    </div>

                    <CardTitle className="text-sm font-bold text-foreground mt-2">
                      {camp.name}
                    </CardTitle>

                    {camp.target_audience && (
                      <CardDescription className="text-xs text-muted-foreground line-clamp-1">
                        Target: {camp.target_audience}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl text-xs">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Captured Leads
                        </div>
                        <div className="text-lg font-bold text-foreground font-mono tabular-nums">
                          {total.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                          Interested / Admitted
                        </div>
                        <div className="text-lg font-bold text-primary font-mono tabular-nums">
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
                          onClick={() => handleOpenEditCampaign(camp)}
                          className="text-[11px] font-medium text-primary hover:underline"
                        >
                          Configure
                        </button>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap">
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
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/60">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEditCampaign(camp)}
                        className="h-7 text-xs gap-1"
                      >
                        <Settings2 className="w-3 h-3" />
                        <span>Settings</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onFilterByCampaign(camp.id, camp.name)}
                        className="h-7 text-xs gap-1.5 font-semibold"
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
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 3: CUSTOMIZABLE DISPOSITIONS MATRIX                        */}
        {/* ============================================================== */}
        <TabsContent value="dispositions" className="space-y-4 pt-2 m-0">
          <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Call Outcomes & Telecalling Stage Rules ({dispositions.length} Dispositions)
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Configure conversion score weightings, callback triggers, and associate outcomes with campaigns.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setIsDispModalOpen(true)}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Disposition</span>
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-4 text-left">Outcome Label</th>
                    <th className="py-2.5 px-3 text-left">Category</th>
                    <th className="py-2.5 px-3 text-center">Score Weight</th>
                    <th className="py-2.5 px-3 text-center">Callback Scheduled</th>
                    <th className="py-2.5 px-3 text-left">Associated Campaigns</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {dispositions.map((d) => {
                    const linkedCount = (d.linked_campaign_ids || []).length;
                    return (
                      <tr key={d.id} className="hover:bg-muted/30 transition-colors h-11">
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: d.color }}
                            />
                            <div>
                              <div className="font-semibold text-foreground">{d.name}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">{d.code}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px] capitalize font-medium">
                            {d.category}
                          </Badge>
                        </td>

                        <td className="py-2 px-3 text-center font-mono font-bold">
                          <span className={d.score > 50 ? "text-emerald-600" : d.score > 0 ? "text-blue-600" : "text-rose-600"}>
                            {d.score > 0 ? `+${d.score}` : d.score}
                          </span>
                        </td>

                        <td className="py-2 px-3 text-center">
                          {d.requires_callback ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              Yes
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60">No</span>
                          )}
                        </td>

                        <td className="py-2 px-3">
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {linkedCount === campaigns.length
                              ? `All ${campaigns.length} Campaigns`
                              : `${linkedCount} of ${campaigns.length} Campaigns`}
                          </span>
                        </td>

                        <td className="py-2 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsDispModalOpen(true)}
                            className="h-7 text-xs"
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ============================================================== */}
        {/* TAB 4: ARCHITECTURE LINKAGE MATRIX                             */}
        {/* ============================================================== */}
        <TabsContent value="matrix" className="space-y-4 pt-2 m-0">
          <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border/60 bg-muted/20">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Campaign <span className="text-primary font-mono">⟷</span> Schema Field <span className="text-primary font-mono">⟷</span> Disposition Cross-Matrix
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Overview of how lead capture sources map to customized telecalling dispositions and expected dynamic fields.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b border-border/80 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4 text-left">Campaign Name</th>
                    <th className="py-3 px-3 text-left">Source Channel</th>
                    <th className="py-3 px-3 text-left">Enabled Call Dispositions</th>
                    <th className="py-3 px-3 text-center">Conversion Potential</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {campaigns.map((c) => {
                    const linkedDisps = (c.linked_disposition_ids || [])
                      .map((id) => dispositions.find((d) => d.id === id))
                      .filter(Boolean) as Disposition[];
                    const total = c.total_leads || 0;
                    const converted = c.converted_leads || 0;
                    const rate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground">{c.target_audience || "General Audience"}</div>
                        </td>

                        <td className="py-3 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {c.channel}
                          </Badge>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 flex-wrap max-w-sm">
                            {linkedDisps.slice(0, 3).map((d) => (
                              <span
                                key={d.id}
                                className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium border"
                                style={{
                                  backgroundColor: `${d.color}15`,
                                  borderColor: `${d.color}35`,
                                  color: d.color,
                                }}
                              >
                                {d.name}
                              </span>
                            ))}
                            {linkedDisps.length > 3 && (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                +{linkedDisps.length - 3} more
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="font-mono font-bold text-emerald-600 tabular-nums">
                            {rate}%
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                            {converted} / {total}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onFilterByCampaign(c.id, c.name)}
                            className="h-7 text-xs gap-1"
                          >
                            <span>Filter Leads</span>
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ============================================================== */}
      {/* ADD / EDIT DYNAMIC FIELD MODAL                                 */}
      {/* ============================================================== */}
      <Dialog open={isAddFieldOpen} onOpenChange={(open) => !open && setIsAddFieldOpen(false)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <div className="p-5 border-b border-border/80 bg-muted/30">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span>{editingField ? "Edit Dynamic Field" : "Create New Dynamic Field"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Configure attributes, faceted filtering behavior, and table column visibility.
            </DialogDescription>
          </div>

          <form onSubmit={handleSaveField} className="p-5 space-y-4">
            {fieldError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fieldError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Display Label <span className="text-rose-500">*</span>
              </label>
              <Input
                value={fieldLabel}
                onChange={(e) => {
                  setFieldLabel(e.target.value);
                  if (!editingField && !fieldKey) {
                    setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30));
                  }
                }}
                placeholder="e.g. Scholarship Tier or Entrance Rank"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>System Key Name (JSON Attribute Key) <span className="text-rose-500">*</span></span>
                <span className="text-[10px] text-muted-foreground font-mono">raw_attributes.&lt;key&gt;</span>
              </label>
              <Input
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="e.g. scholarship_tier"
                className="h-8 text-xs font-mono"
                disabled={Boolean(editingField)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Data Type</label>
                <Select value={fieldDataType} onValueChange={(val: any) => setFieldDataType(val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string" className="text-xs">Text (String)</SelectItem>
                    <SelectItem value="number" className="text-xs">Numeric (Number)</SelectItem>
                    <SelectItem value="date" className="text-xs">Date</SelectItem>
                    <SelectItem value="boolean" className="text-xs">Boolean (Yes / No)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Filter Style</label>
                <Select value={fieldFilterType} onValueChange={(val: any) => setFieldFilterType(val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faceted" className="text-xs">Faceted Multi-select</SelectItem>
                    <SelectItem value="range" className="text-xs">Range Slider (Numbers)</SelectItem>
                    <SelectItem value="search" className="text-xs">Search Lookup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <label className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/20 cursor-pointer">
                <Checkbox
                  checked={fieldIsFilterable}
                  onCheckedChange={(c) => setFieldIsFilterable(Boolean(c))}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-xs font-semibold text-foreground">Enable Faceted Filtering</div>
                  <div className="text-[10px] text-muted-foreground">Appears in top filter toolbar with real-time value counts</div>
                </div>
              </label>

              <label className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/20 cursor-pointer">
                <Checkbox
                  checked={fieldIsVisible}
                  onCheckedChange={(c) => setFieldIsVisible(Boolean(c))}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-xs font-semibold text-foreground">Visible in Table Default</div>
                  <div className="text-[10px] text-muted-foreground">Renders as a primary column in the leads table workspace</div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddFieldOpen(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={fieldSubmitting}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                {fieldSubmitting ? "Saving..." : editingField ? "Update Field" : "Create Dynamic Field"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================== */}
      {/* DELETE DYNAMIC FIELD CONFIRMATION DIALOG                       */}
      {/* ============================================================== */}
      <Dialog open={Boolean(fieldToDelete)} onOpenChange={(open) => !open && setFieldToDelete(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="p-5 border-b border-border/80 bg-rose-50/50 dark:bg-rose-950/20">
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Delete Dynamic Field &quot;{fieldToDelete?.display_label}&quot;?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              This field is currently indexed in <span className="font-bold text-foreground font-mono">{fieldToDelete?.lead_count || 0}</span> student leads.
            </DialogDescription>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <p className="text-muted-foreground">
              Removing this schema definition will remove it from all table views and dynamic facet filter toolbars.
            </p>

            <label className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-200/80 bg-rose-50/30 dark:bg-rose-950/10 cursor-pointer">
              <Checkbox
                checked={purgeDataFromLeads}
                onCheckedChange={(c) => setPurgeDataFromLeads(Boolean(c))}
                className="mt-0.5"
              />
              <div>
                <div className="font-semibold text-foreground">
                  Purge data from all student records
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Executes SQLite <code className="font-mono bg-muted px-1 rounded">json_remove</code> on all leads to free storage. If unchecked, the values stay in raw attributes.
                </div>
              </div>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFieldToDelete(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDeleteField}
                disabled={deletingField}
                className="h-8 text-xs font-semibold gap-1.5"
              >
                {deletingField ? "Deleting..." : "Permanently Delete Field"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispositions Manager Modal */}
      <DispositionsManagerModal
        isOpen={isDispModalOpen}
        onClose={() => setIsDispModalOpen(false)}
        dispositions={dispositions}
        campaigns={campaigns}
        onDispositionsChange={loadData}
      />

      {/* Campaign Create / Edit Modal */}
      <CampaignModal
        isOpen={isCampModalOpen}
        onClose={() => setIsCampModalOpen(false)}
        campaign={selectedCampaignForEdit}
        allDispositions={dispositions}
        onSaved={loadData}
      />
    </div>
  );
}
