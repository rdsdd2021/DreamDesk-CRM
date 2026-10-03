"use client";

import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { Campaign, SchemaMeta } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Target,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Download,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  Table as TableIcon,
  Check,
  HelpCircle,
  Layers,
} from "lucide-react";

interface ImportWorkspaceProps {
  campaigns: Campaign[];
  schemaMeta: SchemaMeta[];
  onImportComplete: (count: number, newHeaders: string[]) => void;
  onNavigateToLeads: () => void;
}

const STANDARD_FIELD_OPTIONS = [
  { group: "Core Lead Fields", options: [
    { value: "name", label: "Student Full Name (Core)" },
    { value: "phone", label: "Primary Phone Number (Core)" },
    { value: "email", label: "Email Address (Core)" },
    { value: "status", label: "Lead Status (Core)" },
    { value: "campaign_id", label: "Campaign ID (Core)" },
  ]},
  { group: "Academic & Profile Attributes", options: [
    { value: "score", label: "Marks / 12th Percentage / CGPA" },
    { value: "stream", label: "Academic Stream (Science, Commerce, Arts)" },
    { value: "school", label: "School / Institution Name" },
    { value: "board", label: "Education Board (CBSE, ICSE, State)" },
    { value: "city", label: "Student City / Town" },
    { value: "parent_phone", label: "Parent / Guardian Contact" },
    { value: "preferred_branch", label: "Preferred Course / Branch" },
    { value: "jee_percentile", label: "Entrance Exam Score / JEE" },
    { value: "hostel_required", label: "Hostel Requirement (Yes/No)" },
    { value: "scholarship_eligible", label: "Scholarship Tier" },
  ]},
];

// Helper to auto-match CSV headers to target fields
function autoDetectFieldMapping(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  const rules: { target: string; patterns: RegExp[] }[] = [
    { target: "name", patterns: [/^(student|candidate|applicant)?_?name$/i, /^full_?name$/i, /^name$/i] },
    { target: "phone", patterns: [/^(mobile|phone|contact|whatsapp|cell|tel)(_?no|_?number)?$/i, /^phone_?number$/i] },
    { target: "email", patterns: [/^(email|e_mail|student_email|mail)(_?id|_?address)?$/i] },
    { target: "status", patterns: [/^(status|stage|lead_status)$/i] },
    { target: "score", patterns: [/^(score|percentage|percent|marks|12th_percent|cgpa)$/i, /marks/i, /percent/i] },
    { target: "stream", patterns: [/^(stream|branch|course|discipline)$/i] },
    { target: "school", patterns: [/^(school|college|institute|institution)(_?name)?$/i] },
    { target: "board", patterns: [/^(board|education_board)$/i] },
    { target: "city", patterns: [/^(city|town|district|location|state|region)$/i] },
    { target: "parent_phone", patterns: [/^(parent|guardian|father|mother)(_?phone|_?mobile|_?contact)?$/i] },
    { target: "preferred_branch", patterns: [/^(preferred_branch|desired_branch|target_course)$/i] },
    { target: "jee_percentile", patterns: [/^(jee|percentile|rank|entrance)$/i] },
    { target: "hostel_required", patterns: [/^(hostel|accommodation)$/i] },
  ];

  csvHeaders.forEach((header) => {
    const clean = header.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    let matched = false;

    for (const rule of rules) {
      if (rule.patterns.some((p) => p.test(clean) || p.test(header.trim()))) {
        mapping[header] = rule.target;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Default to keeping column name as dynamic attribute
      mapping[header] = clean;
    }
  });

  return mapping;
}

export function ImportWorkspace({
  campaigns,
  schemaMeta,
  onImportComplete,
  onNavigateToLeads,
}: ImportWorkspaceProps) {
  // Stepper State: 1 = Upload, 2 = Field Mapping & Preview, 3 = Ingestion Result
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // File & Data State
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [customKeyInputs, setCustomKeyInputs] = useState<Record<string, string>>({});

  // Options State
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none");
  const [defaultStatus, setDefaultStatus] = useState<string>("New");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [sourceName, setSourceName] = useState("CSV Ingestion");

  // Ingestion State
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    importedCount: number;
    skippedDuplicates: number;
    newHeadersFound: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setSourceName(selectedFile.name.replace(/\.[^/.]+$/, ""));
    setError(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError("Failed to parse CSV file. Please verify file format.");
          return;
        }

        const data = results.data as Record<string, any>[];
        setParsedData(data);

        if (data.length > 0) {
          const headers = Object.keys(data[0]);
          setCsvHeaders(headers);
          const autoMap = autoDetectFieldMapping(headers);
          setFieldMapping(autoMap);
          setCurrentStep(2);
        } else {
          setError("CSV file contains no data rows.");
        }
      },
      error: (err) => {
        setError(err.message || "Failed to read CSV file.");
      },
    });
  };

  const handleMappingChange = (csvCol: string, targetValue: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [csvCol]: targetValue,
    }));
  };

  const handleCustomKeySave = (csvCol: string, keyName: string) => {
    const cleanKey = keyName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!cleanKey) return;
    setFieldMapping((prev) => ({
      ...prev,
      [csvCol]: cleanKey,
    }));
  };

  // Build 5-row live preview
  const previewRows = parsedData.slice(0, 5).map((row, idx) => {
    let name: string = "";
    let phone: string = "";
    let email: string = "";
    let status: string = defaultStatus;
    const attributes: Record<string, string> = {};

    for (const [csvCol, rawVal] of Object.entries(row)) {
      const target = fieldMapping[csvCol];
      if (!target || target === "__skip__") continue;
      const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";
      if (!strVal) continue;

      if (target === "name") name = strVal;
      else if (target === "phone") phone = strVal;
      else if (target === "email") email = strVal;
      else if (target === "status") status = strVal;
      else attributes[target] = strVal;
    }

    return {
      index: idx + 1,
      name: name || "—",
      phone: phone || "—",
      email: email || "—",
      status,
      attributes,
    };
  });

  const isPhoneMapped = Object.values(fieldMapping).includes("phone");
  const isNameMapped = Object.values(fieldMapping).includes("name");

  // Execute Ingestion
  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.length === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: parsedData,
          sourceName: sourceName.trim() || "Batch CSV Import",
          campaignId: selectedCampaignId === "none" ? undefined : selectedCampaignId,
          skipDuplicates,
          fieldMapping,
          defaultStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setImportResult({
        importedCount: data.importedCount,
        skippedDuplicates: data.skippedDuplicates,
        newHeadersFound: data.newHeadersFound || [],
      });

      onImportComplete(data.importedCount, data.newHeadersFound || []);
      setCurrentStep(3);
    } catch (err: any) {
      setError(err.message || "Failed to import leads");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      "Candidate Name,Mobile Number,Email Address,12th Score,Stream,School Name,City,Parent Contact\n" +
      "Rohan Deshmukh,+91 9820112345,rohan.deshmukh@gmail.com,88.5%,Science (PCM),Delhi Public School,Mumbai,+91 9820199999\n" +
      "Priya Sen,+91 9433012345,priya.sen@gmail.com,92.0%,Commerce with Maths,La Martiniere,Kolkata,+91 9433099999\n" +
      "Kavita Reddy,+91 9848012345,kavita.reddy@gmail.com,84.0%,Humanities / Arts,Hyderabad Public School,Hyderabad,+91 9848099999\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dreamdesk_leads_sample_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setCsvHeaders([]);
    setFieldMapping({});
    setImportResult(null);
    setError(null);
    setCurrentStep(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Workspace Header */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
            <Upload className="w-4 h-4" />
            <span>Enterprise Data Ingestion & Field Mapping Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Batch CSV Lead Ingestion
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Stream student spreadsheets into SQLite WAL with intelligent column auto-matching,
            phone deduplication, and dynamic schema auto-registration.
          </p>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-muted/40 p-1.5 rounded-xl border border-border/60 text-xs">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              currentStep === 1 ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground"
            }`}
          >
            <span>1</span>
            <span className="hidden sm:inline">Upload</span>
          </div>
          <div className="w-3 h-0.5 bg-border" />
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              currentStep === 2 ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground"
            }`}
          >
            <span>2</span>
            <span className="hidden sm:inline">Field Mapping</span>
          </div>
          <div className="w-3 h-0.5 bg-border" />
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
              currentStep === 3 ? "bg-emerald-600 text-white font-semibold shadow-xs" : "text-muted-foreground"
            }`}
          >
            <span>3</span>
            <span className="hidden sm:inline">Results</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD CSV FILE */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-2xl p-12 text-center cursor-pointer transition-all bg-card hover:bg-muted/30 group shadow-sm"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              Click to select or drag and drop your CSV spreadsheet
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Supports files with 50,000+ rows. Any custom column names are supported and can be mapped in the next step.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Browse Local Computer</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/60 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Need a standard format? Download our ready-to-use sample template.</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={downloadSampleTemplate}
              className="h-7 text-xs gap-1.5 text-primary hover:text-primary"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sample CSV</span>
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: FIELD MAPPING ENGINE & LIVE PREVIEW */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* File summary banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/80 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground flex items-center gap-2">
                  <span>{file?.name || "Uploaded Spreadsheet"}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {parsedData.length.toLocaleString()} Rows
                  </Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {csvHeaders.length} Columns
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Review and customize how each CSV column maps to student profile fields.
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Change File</span>
            </Button>
          </div>

          {/* Validation Warnings */}
          {(!isPhoneMapped || !isNameMapped) && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center gap-2.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                <strong>Attention:</strong>
                {!isPhoneMapped && " You have not mapped a Phone Number column. Phone is recommended for deduplication."}
                {!isNameMapped && " You have not mapped a Student Name column."}
              </span>
            </div>
          )}

          {/* Interactive Mapping Grid */}
          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Column Field Mapping Configuration
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {Object.values(fieldMapping).filter((v) => v !== "__skip__").length} of {csvHeaders.length} Columns Mapped
              </Badge>
            </div>

            <div className="divide-y divide-border/60">
              <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-muted/10 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <div className="col-span-4">CSV Column Header</div>
                <div className="col-span-3">Sample Value (Row 1)</div>
                <div className="col-span-5">Maps To CRM Field</div>
              </div>

              {csvHeaders.map((header) => {
                const sampleVal = parsedData[0]?.[header];
                const currentMapped = fieldMapping[header] || "";
                const isSkipped = currentMapped === "__skip__";

                return (
                  <div
                    key={header}
                    className={`grid grid-cols-12 gap-3 px-4 py-3 items-center text-xs transition-colors ${
                      isSkipped ? "opacity-50 bg-muted/10" : "hover:bg-muted/15"
                    }`}
                  >
                    {/* CSV Header */}
                    <div className="col-span-4 flex items-center gap-2 truncate">
                      <div className="font-semibold text-foreground truncate" title={header}>
                        {header}
                      </div>
                    </div>

                    {/* Sample Value */}
                    <div className="col-span-3 text-muted-foreground truncate font-mono text-[11px]">
                      {sampleVal !== undefined && sampleVal !== null && String(sampleVal).trim() !== "" ? (
                        String(sampleVal)
                      ) : (
                        <span className="italic opacity-50">Empty</span>
                      )}
                    </div>

                    {/* Target Selector */}
                    <div className="col-span-5 flex items-center gap-2">
                      <select
                        value={currentMapped}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                        className="flex-1 h-8 rounded-lg border border-border/80 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="__skip__">❌ Do Not Import (Skip Column)</option>

                        {STANDARD_FIELD_OPTIONS.map((grp) => (
                          <optgroup key={grp.group} label={grp.group}>
                            {grp.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}

                        {/* Existing Dynamic Schema Fields */}
                        {schemaMeta.length > 0 && (
                          <optgroup label="Custom Dynamic Attributes">
                            {schemaMeta
                              .filter(
                                (m) =>
                                  !STANDARD_FIELD_OPTIONS.some((g) =>
                                    g.options.some((o) => o.value === m.key_name)
                                  )
                              )
                              .map((m) => (
                                <option key={m.key_name} value={m.key_name}>
                                  {m.display_label} ({m.key_name})
                                </option>
                              ))}
                          </optgroup>
                        )}

                        <optgroup label="Special Options">
                          <option value={header.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")}>
                            ✨ Keep as New Attribute &quot;{header}&quot;
                          </option>
                        </optgroup>
                      </select>

                      {currentMapped && currentMapped !== "__skip__" && (
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live 5-Row Interactive Preview */}
          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-muted/30 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Live Preview: Transformed DreamDesk Lead Records (First 5 Rows)
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Updates in real-time as you modify column mappings above
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/20 text-[10px] uppercase font-bold text-muted-foreground border-b">
                  <tr>
                    <th className="px-4 py-2.5 w-12">#</th>
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5">Email</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Mapped Dynamic Attributes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {previewRows.map((r) => (
                    <tr key={r.index} className="hover:bg-muted/15">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{r.index}</td>
                      <td className="px-4 py-2.5 font-semibold text-foreground">{r.name}</td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground">{r.phone}</td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[150px]">{r.email}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(r.attributes).slice(0, 4).map(([k, v]) => (
                            <span
                              key={k}
                              className="inline-flex items-center gap-1 text-[10px] bg-muted/60 px-1.5 py-0.5 rounded border font-mono"
                            >
                              <strong className="text-foreground">{k}:</strong> {v}
                            </span>
                          ))}
                          {Object.keys(r.attributes).length > 4 && (
                            <span className="text-[10px] text-muted-foreground font-mono self-center">
                              +{Object.keys(r.attributes).length - 4} more
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ingestion Settings & Controls */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ingestion Hygiene & Campaign Settings
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Campaign Attribution */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span>Campaign Attribution</span>
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border/80 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="none">Direct / Organic (No Campaign)</option>
                  {campaigns.map((camp) => (
                    <option key={camp.id} value={camp.id}>
                      {camp.name} ({camp.channel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Default Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>Default Lead Status</span>
                </label>
                <select
                  value={defaultStatus}
                  onChange={(e) => setDefaultStatus(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border/80 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="New">New (Uncontacted)</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Interested">Interested / Qualified</option>
                  <option value="Follow-up">Follow-up Scheduled</option>
                </select>
              </div>

              {/* Source Name Tag */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Source Identifier / Batch Tag
                </label>
                <Input
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="e.g. Education Fair 2026 Batch"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Deduplication Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-foreground">
                    Intelligent Duplicate Phone Radar
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Automatically skip records whose phone number already exists in your 112,500 lead database.
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            {/* Execution Buttons */}
            <div className="pt-2 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(1)}
                className="h-9 text-xs gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to File</span>
              </Button>

              <Button
                size="sm"
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="h-9 px-6 text-xs font-bold gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Ingesting {parsedData.length.toLocaleString()} Records...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Execute Batch Ingestion ({parsedData.length.toLocaleString()} Leads)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: RESULTS & REPORT */}
      {currentStep === 3 && importResult && (
        <div className="bg-card border border-border/80 rounded-2xl p-8 text-center shadow-sm space-y-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">
              Ingestion Completed Successfully!
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Your leads have been transactionally committed to SQLite WAL and are immediately available for routing and calls.
            </p>
          </div>

          {/* Metrics Summary */}
          <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-muted/20 border text-left">
            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Successfully Added</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                +{importResult.importedCount.toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Duplicates Skipped</div>
              <div className="text-xl font-bold text-amber-500 font-mono mt-0.5">
                {importResult.skippedDuplicates.toLocaleString()}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground">New Dynamic Fields</div>
              <div className="text-xl font-bold text-primary font-mono mt-0.5">
                +{importResult.newHeadersFound.length}
              </div>
            </div>
          </div>

          {importResult.newHeadersFound.length > 0 && (
            <div className="text-left p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs">
              <span className="font-semibold text-primary">New Faceted Filter Attributes Registered:</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {importResult.newHeadersFound.map((h) => (
                  <Badge key={h} variant="secondary" className="font-mono text-[10px]">
                    {h}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-9 text-xs gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Another CSV</span>
            </Button>

            <Button
              size="sm"
              onClick={onNavigateToLeads}
              className="h-9 px-6 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-sm"
            >
              <span>Go to Leads Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
