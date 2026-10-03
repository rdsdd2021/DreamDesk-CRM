"use client";

import React, { useState, useMemo } from "react";
import { SchemaMeta } from "@/types/crm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
import {
  SlidersHorizontal,
  Plus,
  Search,
  Filter,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Database,
  Hash,
  Calendar,
  ToggleLeft,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface SchemaStudioWorkspaceProps {
  schemaMeta: SchemaMeta[];
  onSchemaChange: () => void;
  totalLeadsCount: number;
}

export function SchemaStudioWorkspace({
  schemaMeta,
  onSchemaChange,
  totalLeadsCount,
}: SchemaStudioWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Add / Edit Modal State
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [editingField, setEditingField] = useState<SchemaMeta | null>(null);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldDataType, setFieldDataType] = useState<"string" | "number" | "date" | "boolean">("string");
  const [fieldFilterType, setFieldFilterType] = useState<"faceted" | "range" | "search">("faceted");
  const [fieldIsFilterable, setFieldIsFilterable] = useState(true);
  const [fieldIsVisible, setFieldIsVisible] = useState(true);
  const [fieldSubmitting, setFieldSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Field Deletion state
  const [fieldToDelete, setFieldToDelete] = useState<SchemaMeta | null>(null);
  const [purgeDataFromLeads, setPurgeDataFromLeads] = useState(true);
  const [deletingField, setDeletingField] = useState(false);

  // Metrics
  const filterableCount = useMemo(
    () => schemaMeta.filter((f) => f.is_filterable).length,
    [schemaMeta]
  );

  const visibleCount = useMemo(
    () => schemaMeta.filter((f) => f.is_visible).length,
    [schemaMeta]
  );

  // Filtered fields
  const filteredFields = useMemo(() => {
    return schemaMeta.filter((f) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        f.display_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.key_name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchType = typeFilter === "all" || f.data_type === typeFilter;

      return matchSearch && matchType;
    });
  }, [schemaMeta, searchQuery, typeFilter]);

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
      const res = await fetch(
        `/api/schema?key=${encodeURIComponent(fieldToDelete.key_name)}&purge=${purgeDataFromLeads}`,
        {
          method: "DELETE",
        }
      );
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

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case "number":
        return <Hash className="w-3.5 h-3.5 text-blue-500" />;
      case "date":
        return <Calendar className="w-3.5 h-3.5 text-purple-500" />;
      case "boolean":
        return <ToggleLeft className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <span className="font-mono text-xs font-bold text-amber-500">Tt</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shadow-xs">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <span>Dynamic Schema & Fields Studio</span>
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
                SQLite EAV / No-Migration
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Define arbitrary lead attributes, configure instant faceted sidebar filters, and toggle table visibility without running migrations.
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleOpenAddField}
          className="h-8 text-xs font-semibold gap-1.5 shadow-2xs bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Dynamic Field</span>
        </Button>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Dynamic Custom Headers</span>
            <Database className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground font-sans tabular-nums">
            {schemaMeta.length}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Registered lead attributes
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Filterable Facets</span>
            <Filter className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 font-sans tabular-nums">
            {filterableCount} <span className="text-xs font-normal text-muted-foreground">/ {schemaMeta.length}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Active in filter sidebar
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Visible in Table</span>
            <Eye className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600 font-sans tabular-nums">
            {visibleCount}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Default leads table columns
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-border/70 bg-card shadow-2xs space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Indexed Records</span>
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground font-sans tabular-nums">
            {totalLeadsCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Student leads indexed in WAL
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/80 shadow-2xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search attributes by label or raw key..."
            className="h-8 pl-8 text-xs bg-muted/30"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase mr-1">Data Type:</span>
          {["all", "string", "number", "date", "boolean"].map((dt) => (
            <button
              key={dt}
              onClick={() => setTypeFilter(dt)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-all ${
                typeFilter === dt
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {dt}
            </button>
          ))}
        </div>
      </div>

      {/* Attributes Registry Table */}
      <div className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Dynamic Lead Attributes Registry ({filteredFields.length} Fields)
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Changes take effect immediately across all counseling workspaces without server restarts.
            </p>
          </div>

          <span className="text-[11px] text-muted-foreground font-medium">
            Fast indexed JSON queries enabled
          </span>
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
              {filteredFields.map((field) => {
                const count = field.lead_count || 0;
                const usagePercent =
                  totalLeadsCount > 0 ? ((count / totalLeadsCount) * 100).toFixed(0) : "0";

                return (
                  <tr key={field.id} className="hover:bg-muted/30 transition-colors h-12">
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="p-1.5 rounded-lg bg-muted/60 border border-border/60">
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
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                          field.is_filterable
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border/80 hover:bg-muted/80"
                        }`}
                        title="Click to toggle filterable state in sidebar"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            field.is_filterable ? "bg-emerald-500" : "bg-muted-foreground"
                          }`}
                        />
                        <span>{field.is_filterable ? "Filterable" : "Off"}</span>
                      </button>
                    </td>

                    <td className="py-2 px-3 min-w-[180px]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
                          <span className="font-medium text-foreground">
                            {count.toLocaleString()} leads
                          </span>
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
                        title={field.is_visible ? "Visible in table (click to hide)" : "Hidden from table (click to show)"}
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

      {/* Add / Edit Field Dialog */}
      <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              <span>{editingField ? "Edit Dynamic Field" : "Create Dynamic Field"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure how this custom attribute is captured, indexed, and displayed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveField} className="space-y-4 pt-2">
            {fieldError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fieldError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Display Label</label>
              <Input
                value={fieldLabel}
                onChange={(e) => {
                  setFieldLabel(e.target.value);
                  if (!editingField && !fieldKey) {
                    setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
                  }
                }}
                placeholder="e.g. Desired Major, Score Percentile, Hostel Needed"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                System Key Name
                <span className="text-[10px] font-normal text-muted-foreground ml-1.5 font-mono">
                  (raw_attributes.{fieldKey || "key"})
                </span>
              </label>
              <Input
                value={fieldKey}
                onChange={(e) =>
                  setFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
                }
                placeholder="e.g. desired_major"
                className="text-xs font-mono"
                disabled={Boolean(editingField)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Data Type</label>
                <Select
                  value={fieldDataType}
                  onValueChange={(val: any) => setFieldDataType(val)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">Text (String)</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean (Yes/No)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Filter Widget</label>
                <Select
                  value={fieldFilterType}
                  onValueChange={(val: any) => setFieldFilterType(val)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="faceted">Faceted Checkbox</SelectItem>
                    <SelectItem value="range">Numeric Range</SelectItem>
                    <SelectItem value="search">Text Search</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={fieldIsFilterable}
                  onCheckedChange={(checked) => setFieldIsFilterable(Boolean(checked))}
                />
                <span className="text-xs font-medium text-foreground">
                  Include as Filter in Left Filter Sidebar
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={fieldIsVisible}
                  onCheckedChange={(checked) => setFieldIsVisible(Boolean(checked))}
                />
                <span className="text-xs font-medium text-foreground">
                  Show by Default in Leads DataGrid
                </span>
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
                className="h-8 text-xs font-semibold"
              >
                {fieldSubmitting ? "Saving..." : editingField ? "Update Field" : "Create Field"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Field Confirmation Dialog */}
      <Dialog open={Boolean(fieldToDelete)} onOpenChange={() => setFieldToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              <span>Delete Dynamic Field</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete the field &quot;{fieldToDelete?.display_label}&quot; (
              <span className="font-mono text-muted-foreground">{fieldToDelete?.key_name}</span>)?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Impact on Existing Leads</span>
              </div>
              <p>
                {fieldToDelete?.lead_count || 0} leads currently have data saved under this attribute key.
              </p>
            </div>

            <label className="flex items-start gap-2.5 p-2 rounded-lg border border-border/80 bg-muted/20 cursor-pointer">
              <Checkbox
                checked={purgeDataFromLeads}
                onCheckedChange={(checked) => setPurgeDataFromLeads(Boolean(checked))}
                className="mt-0.5"
              />
              <div>
                <span className="text-xs font-semibold text-foreground">
                  Purge stored values from all leads
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Removes &quot;{fieldToDelete?.key_name}&quot; from all raw attributes JSON objects.
                </p>
              </div>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFieldToDelete(null)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deletingField}
                onClick={handleConfirmDeleteField}
                className="h-8 text-xs font-semibold"
              >
                {deletingField ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
