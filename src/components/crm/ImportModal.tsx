"use client";

import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { Campaign } from "@/types/crm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Target,
  ShieldCheck,
} from "lucide-react";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (count: number, newHeaders: string[]) => void;
}

export function ImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/campaigns")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setCampaigns(data);
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError("Failed to parse CSV file. Please verify file format.");
          return;
        }

        const data = results.data as any[];
        setParsedData(data);
        if (data.length > 0) {
          setDetectedHeaders(Object.keys(data[0]));
        }
      },
      error: (err) => {
        setError(err.message || "Failed to parse CSV file.");
      },
    });
  };

  const handleExecuteImport = async () => {
    if (!parsedData || parsedData.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: parsedData,
          sourceName: file?.name || "CSV Upload",
          campaignId: selectedCampaignId === "none" ? undefined : selectedCampaignId,
          skipDuplicates,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      onImportComplete(data.importedCount, data.newHeadersFound || []);
      onClose();
      resetState();
    } catch (err: any) {
      setError(err.message || "Failed to import leads");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setDetectedHeaders([]);
    setSelectedCampaignId("none");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!loading && !open) {
          onClose();
          resetState();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 bg-muted/40 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                Import Student Leads
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Upload any CSV spreadsheet. Columns will be automatically mapped to your faceted filters.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* File Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-accent/30"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <FileSpreadsheet className="w-10 h-10 text-primary/70 mx-auto mb-2" />
            <div className="text-sm font-semibold text-foreground">
              {file ? file.name : "Click or drag CSV file to upload"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Supports 50k+ rows. Flexible headers (School, Stream, Board, City, etc.)
            </p>
          </div>

          {/* Ingestion Attribution & Hygiene Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/20">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-primary" />
                <span>Link to Campaign</span>
              </label>
              <Select
                value={selectedCampaignId}
                onValueChange={(val) => {
                  if (val) setSelectedCampaignId(val);
                }}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Select campaign..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">
                    Direct / Organic (No Campaign)
                  </SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Duplicate Prevention</span>
              </label>
              <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg border bg-background hover:bg-accent/40 cursor-pointer text-xs transition-colors">
                <Checkbox
                  checked={skipDuplicates}
                  onCheckedChange={(checked) => setSkipDuplicates(Boolean(checked))}
                />
                <span className="font-medium text-foreground text-[11px] truncate">
                  Skip existing phone numbers
                </span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Parsed Preview */}
          {parsedData.length > 0 && (
            <div className="space-y-3 bg-muted/20 border rounded-lg p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Found {parsedData.length.toLocaleString()} rows</span>
                </span>
                <span className="text-muted-foreground text-[11px]">
                  {detectedHeaders.length} headers detected
                </span>
              </div>

              {/* Detected Headers Pills */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>Discovered Headers:</span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {detectedHeaders.map((header) => (
                    <Badge
                      key={header}
                      variant="secondary"
                      className="text-[11px] font-mono font-medium px-2 py-0.5"
                    >
                      {header}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              resetState();
            }}
            disabled={loading}
            className="text-xs font-medium h-9 px-4 rounded-lg"
          >
            Cancel
          </Button>

          <Button
            size="sm"
            onClick={handleExecuteImport}
            disabled={loading || parsedData.length === 0}
            className="text-xs gap-2 font-semibold h-9 px-5 rounded-lg shadow-2xs bg-primary text-primary-foreground"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Ingesting {parsedData.length.toLocaleString()} rows...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>
                  Import {parsedData.length > 0 ? `${parsedData.length.toLocaleString()} Leads` : "CSV"}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
