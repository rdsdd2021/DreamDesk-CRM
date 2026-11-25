"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  Table as TableIcon,
  Terminal,
  Layers,
  Play,
  Search,
  Download,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Key,
  Clock,
  Loader2,
  Link2,
  Eye,
  X,
  Globe,
  Copy,
  Check,
  Pencil,
  Save,
  ArrowRight,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { API_CATALOG, TABLE_TO_API_MAP, ApiEndpointSpec } from "./apiCatalog";

interface TableSummary {
  name: string;
  type: string;
  rowCount: number;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
}

interface ForeignKeyInfo {
  id: number;
  table: string;
  from: string;
  to: string;
}

interface ReferencedByInfo {
  table: string;
  from: string;
  to: string;
}

interface NavHistoryEntry {
  table: string;
  filterCol?: string;
  filterVal?: string;
}

export default function DbAdminPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Database state
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [journalMode, setJournalMode] = useState("wal");
  const [tableFilter, setTableFilter] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"browse" | "sql" | "structure" | "api">("browse");

  // Filter & History state for FK jumping
  const [activeFilter, setActiveFilter] = useState<{ col: string; val: string } | null>(null);
  const [navHistory, setNavHistory] = useState<NavHistoryEntry[]>([]);

  // Table browser state
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyInfo[]>([]);
  const [referencedBy, setReferencedBy] = useState<ReferencedByInfo[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowSearch, setRowSearch] = useState("");
  const [loadingRows, setLoadingRows] = useState(false);

  // Row Inspector Modal state
  const [inspectedRow, setInspectedRow] = useState<Record<string, any> | null>(null);
  const [relatedCounts, setRelatedCounts] = useState<
    { table: string; from: string; to: string; count: number }[]
  >([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState<string>("");
  const [savingCell, setSavingCell] = useState(false);
  const [cellEditError, setCellEditError] = useState<string | null>(null);

  // SQL Runner state
  const [sqlText, setSqlText] = useState(
    "SELECT id, lead_code, name, phone, status, created_at\nFROM leads\nORDER BY id DESC\nLIMIT 50;"
  );
  const [allowWrite, setAllowWrite] = useState(false);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlResult, setSqlResult] = useState<{
    isReadOnly: boolean;
    columns?: string[];
    rows?: Record<string, any>[];
    totalReturned?: number;
    truncated?: boolean;
    changes?: number;
    durationMs: number;
  } | null>(null);

  // API Explorer state
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpointSpec>(API_CATALOG[0]);
  const [apiMethod, setApiMethod] = useState<"GET" | "POST" | "PATCH" | "DELETE">(API_CATALOG[0].method);
  const [apiPath, setApiPath] = useState(API_CATALOG[0].path);
  const [apiBody, setApiBody] = useState(API_CATALOG[0].defaultBody || "");
  const [apiLoading, setApiLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<{
    status: number;
    ok: boolean;
    durationMs: number;
    bodyText: string;
  } | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // 1. Verify admin auth
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          router.replace("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data?.authenticated) {
          router.replace("/login");
          return;
        }
        setIsAdmin(data.user?.role === "admin");
        setAuthChecking(false);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  // 2. Load tables list
  const loadTables = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/db?action=tables");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.tables)) {
        setTables(data.tables);
        if (data.journalMode) setJournalMode(data.journalMode);
        setSelectedTable((prev) =>
          prev && data.tables.some((t: TableSummary) => t.name === prev)
            ? prev
            : data.tables.find((t: TableSummary) => t.name === "leads")?.name ||
              data.tables[0]?.name ||
              ""
        );
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadTables();
    }
  }, [isAdmin, loadTables]);

  // 3. Load rows & structure for selected table
  const loadTableData = useCallback(
    async (
      tableName: string,
      targetPage: number,
      searchStr: string,
      filter: { col: string; val: string } | null
    ) => {
      if (!tableName) return;
      try {
        setLoadingRows(true);
        const params = new URLSearchParams({
          action: "rows",
          table: tableName,
          page: String(targetPage),
          limit: "50",
        });
        if (searchStr.trim()) params.set("search", searchStr.trim());
        if (filter) {
          params.set("filterCol", filter.col);
          params.set("filterVal", filter.val);
        }

        const res = await fetch(`/api/admin/db?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        setColumns(data.columns || []);
        setIndexes(data.indexes || []);
        setForeignKeys(data.foreignKeys || []);
        setReferencedBy(data.referencedBy || []);
        setRows(data.rows || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } finally {
        setLoadingRows(false);
      }
    },
    []
  );

  useEffect(() => {
    if (isAdmin && selectedTable) {
      loadTableData(selectedTable, page, rowSearch, activeFilter);
    }
  }, [isAdmin, selectedTable, page, rowSearch, activeFilter, loadTableData]);

  // Map column name -> FK target for quick lookup in table cells
  const fkByColumn = useMemo(() => {
    const map: Record<string, ForeignKeyInfo> = {};
    for (const fk of foreignKeys) {
      map[fk.from] = fk;
    }
    return map;
  }, [foreignKeys]);

  const pkColumnName = useMemo(() => {
    return columns.find((c) => c.pk > 0)?.name || "id";
  }, [columns]);

  // Jump to a linked table & record
  const jumpToTable = (targetTable: string, filterCol?: string, filterVal?: string) => {
    setNavHistory((prev) => [
      ...prev.slice(-9),
      {
        table: selectedTable,
        filterCol: activeFilter?.col,
        filterVal: activeFilter?.val,
      },
    ]);
    setSelectedTable(targetTable);
    setPage(1);
    setRowSearch("");
    setActiveFilter(filterCol && filterVal !== undefined ? { col: filterCol, val: filterVal } : null);
    setInspectedRow(null);
    setActiveTab("browse");
  };

  const handleGoBackHistory = () => {
    if (navHistory.length === 0) return;
    const prev = navHistory[navHistory.length - 1];
    setNavHistory((h) => h.slice(0, -1));
    setSelectedTable(prev.table);
    setPage(1);
    setRowSearch("");
    setActiveFilter(
      prev.filterCol && prev.filterVal !== undefined
        ? { col: prev.filterCol, val: prev.filterVal }
        : null
    );
    setInspectedRow(null);
  };

  // Open Row Inspector & fetch incoming related counts
  const openRowInspector = async (row: Record<string, any>) => {
    setInspectedRow(row);
    setEditingCol(null);
    setCellEditError(null);
    setRelatedCounts([]);

    const pkVal = row[pkColumnName];
    if (pkVal !== undefined && pkVal !== null && referencedBy.length > 0) {
      try {
        setLoadingRelated(true);
        const res = await fetch(
          `/api/admin/db?action=related_counts&table=${encodeURIComponent(
            selectedTable
          )}&pkVal=${encodeURIComponent(String(pkVal))}`
        );
        if (res.ok) {
          const data = await res.json();
          setRelatedCounts(data.related || []);
        }
      } finally {
        setLoadingRelated(false);
      }
    }
  };

  // Save inline cell edit from Row Inspector
  const handleSaveCellEdit = async (colName: string) => {
    if (!inspectedRow) return;
    const pkVal = inspectedRow[pkColumnName];
    try {
      setSavingCell(true);
      setCellEditError(null);
      const res = await fetch("/api/admin/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_cell",
          allowWrite,
          table: selectedTable,
          pkCol: pkColumnName,
          pkVal,
          col: colName,
          value: editingVal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCellEditError(data.error || "Update failed");
        return;
      }
      const nextVal = editingVal === "" ? null : editingVal;
      setInspectedRow((prev) => (prev ? { ...prev, [colName]: nextVal } : null));
      setEditingCol(null);
      loadTableData(selectedTable, page, rowSearch, activeFilter);
    } catch (err: any) {
      setCellEditError(err?.message || "Failed to update cell");
    } finally {
      setSavingCell(false);
    }
  };

  // Execute SQL Query
  const handleRunSql = async () => {
    if (!sqlText.trim()) return;
    try {
      setSqlRunning(true);
      setSqlError(null);
      const res = await fetch("/api/admin/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlText, allowWrite }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSqlError(data.error || "Query failed");
        setSqlResult(null);
        return;
      }
      setSqlResult(data);
      if (!data.isReadOnly) {
        loadTables();
        if (selectedTable) loadTableData(selectedTable, page, rowSearch, activeFilter);
      }
    } catch (err: any) {
      setSqlError(err?.message || "Failed to execute query");
    } finally {
      setSqlRunning(false);
    }
  };

  // Execute API Request in API Explorer
  const handleRunApi = async (overrideMethod?: "GET" | "POST" | "PATCH" | "DELETE", overridePath?: string, overrideBody?: string) => {
    const method = overrideMethod || apiMethod;
    const path = (overridePath || apiPath).trim();
    const bodyStr = overrideBody !== undefined ? overrideBody : apiBody;
    if (!path) return;

    try {
      setApiLoading(true);
      const start = performance.now();
      const opts: RequestInit = { method };
      if (method !== "GET" && method !== "DELETE" && bodyStr.trim()) {
        opts.headers = { "Content-Type": "application/json" };
        opts.body = bodyStr;
      }
      const res = await fetch(path, opts);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      const rawText = await res.text();
      let formatted = rawText;
      try {
        formatted = JSON.stringify(JSON.parse(rawText), null, 2);
      } catch {
        // leave raw text
      }
      setApiResponse({
        status: res.status,
        ok: res.ok,
        durationMs,
        bodyText: formatted,
      });
    } catch (err: any) {
      setApiResponse({
        status: 0,
        ok: false,
        durationMs: 0,
        bodyText: err?.message || "Network error",
      });
    } finally {
      setApiLoading(false);
    }
  };

  const openInApiExplorer = (specId: string, customPath?: string) => {
    const spec = API_CATALOG.find((e) => e.id === specId) || API_CATALOG[0];
    const targetPath = customPath || spec.path;
    setSelectedEndpoint(spec);
    setApiMethod(spec.method);
    setApiPath(targetPath);
    setApiBody(spec.defaultBody || "");
    setInspectedRow(null);
    setActiveTab("api");
    if (spec.method === "GET") {
      handleRunApi("GET", targetPath, "");
    }
  };

  const handleCopyCurl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const fullUrl = apiPath.startsWith("http") ? apiPath : `${origin}${apiPath}`;
    let curl = `curl -X ${apiMethod} "${fullUrl}"`;
    if (apiMethod !== "GET" && apiMethod !== "DELETE" && apiBody.trim()) {
      curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${apiBody.replace(/'/g, "'\\''")}'`;
    }
    navigator.clipboard?.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  // Export CSV
  const exportToCsv = (cols: string[], dataRows: Record<string, any>[], filename: string) => {
    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const header = cols.map(escapeCell).join(",");
    const lines = dataRows.map((r) => cols.map((c) => escapeCell(r[c])).join(","));
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tryPrettyJson = (val: any): string | null => {
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return null;
    }
  };

  const formatCell = (val: any, colName: string) => {
    if (val === null || val === undefined) {
      return <span className="text-muted-foreground/50 italic">NULL</span>;
    }
    const fk = fkByColumn[colName];
    const str = String(val);
    if (fk) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            jumpToTable(fk.table, fk.to, str);
          }}
          title={`Jump to ${fk.table}.${fk.to} = ${str}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-mono text-[11px] cursor-pointer transition-colors"
        >
          <Link2 className="w-2.5 h-2.5 shrink-0" />
          <span className="truncate max-w-[180px]">{str}</span>
        </button>
      );
    }
    return (
      <span className="truncate block max-w-[240px]" title={str}>
        {str}
      </span>
    );
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>Verifying Administrator Session...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-4 shadow-lg">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold">Administrator Access Required</h1>
          <p className="text-xs text-muted-foreground">
            The Live Database & API Studio is restricted to Administrators only.
          </p>
          <Link href="/">
            <Button size="sm" className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to CRM
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(tableFilter.toLowerCase())
  );
  const matchingApiId = TABLE_TO_API_MAP[selectedTable];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="h-14 border-b border-border/80 bg-card px-4 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to CRM</span>
            </Button>
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold truncate">Developer Database & API Studio</h1>
                <Badge variant="outline" className="text-[10px] font-mono uppercase">
                  {journalMode} mode
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                data/crm.db • Foreign-Key Linking & Live REST Tester
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadTables();
              if (selectedTable) loadTableData(selectedTable, page, rowSearch, activeFilter);
            }}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Main Split Body */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left Tables Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border/80 bg-muted/20 flex flex-col shrink-0">
          <div className="p-3 border-b border-border/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              <Input
                placeholder="Filter tables..."
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="p-2 space-y-0.5 max-h-48 md:max-h-[calc(100vh-8rem)] overflow-y-auto">
            {filteredTables.map((t) => {
              const isSelected = selectedTable === t.name && activeTab !== "api";
              return (
                <button
                  key={t.name}
                  onClick={() => {
                    setSelectedTable(t.name);
                    setPage(1);
                    setRowSearch("");
                    setActiveFilter(null);
                    if (activeTab === "api") setActiveTab("browse");
                    if (activeTab === "sql") {
                      setSqlText(`SELECT * FROM "${t.name}" LIMIT 50;`);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <TableIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-mono">{t.name}</span>
                  </span>
                  <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-background/80 border border-border/60">
                    {t.rowCount.toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Workspace */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Workspace Tabs */}
          <div className="px-4 pt-3 border-b border-border/80 bg-card/40 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab("browse")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === "browse"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Browse Data</span>
              </button>
              <button
                onClick={() => setActiveTab("sql")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === "sql"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>SQL Query Editor</span>
              </button>
              <button
                onClick={() => setActiveTab("structure")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === "structure"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Structure & Links</span>
              </button>
              <button
                onClick={() => setActiveTab("api")}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === "api"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>API Explorer</span>
              </button>
            </div>

            {selectedTable && activeTab !== "api" && (
              <div className="flex items-center gap-2 pb-2">
                <span className="text-xs text-muted-foreground font-mono">
                  <strong className="text-foreground">{selectedTable}</strong> ({totalCount.toLocaleString()})
                </span>
                {matchingApiId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openInApiExplorer(matchingApiId)}
                    className="h-6 px-2 text-[10px] font-mono gap-1 text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Test API</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* TAB 1: BROWSE DATA */}
          {activeTab === "browse" && (
            <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3">
              {/* Filter / Navigation Bar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  {navHistory.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGoBackHistory}
                      className="h-8 text-xs gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to {navHistory[navHistory.length - 1].table}</span>
                    </Button>
                  )}

                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                    <Input
                      placeholder={`Search across ${selectedTable || "table"}...`}
                      value={rowSearch}
                      onChange={(e) => {
                        setRowSearch(e.target.value);
                        setPage(1);
                      }}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>

                  {activeFilter && (
                    <Badge
                      variant="secondary"
                      className="h-8 px-2.5 gap-1.5 font-mono text-[11px] bg-primary/10 text-primary border border-primary/20"
                    >
                      <span>
                        {activeFilter.col} = {activeFilter.val}
                      </span>
                      <button
                        onClick={() => {
                          setActiveFilter(null);
                          setPage(1);
                        }}
                        className="hover:text-foreground cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={rows.length === 0}
                  onClick={() =>
                    exportToCsv(
                      columns.map((c) => c.name),
                      rows,
                      `${selectedTable}_page${page}.csv`
                    )
                  }
                  className="h-8 text-xs gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </Button>
              </div>

              <div className="flex-1 border border-border/80 rounded-xl overflow-auto bg-card">
                {loadingRows ? (
                  <div className="h-48 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Loading rows...</span>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
                    No rows found.
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-muted/80 sticky top-0 border-b border-border z-10">
                      <tr>
                        <th className="px-2.5 py-2 w-10 text-center border-r border-border/40 text-[10px] text-muted-foreground">
                          Row
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col.name}
                            className="px-3 py-2 font-mono font-semibold text-[11px] whitespace-nowrap border-r border-border/40 last:border-r-0"
                          >
                            <div className="flex items-center gap-1">
                              {col.pk > 0 && <Key className="w-3 h-3 text-amber-500" />}
                              {fkByColumn[col.name] && (
                                <Link2
                                  className="w-3 h-3 text-primary"
                                  aria-label={`Foreign key -> ${fkByColumn[col.name].table}`}
                                />
                              )}
                              <span>{col.name}</span>
                              <span className="text-[9px] text-muted-foreground font-normal">
                                {col.type || "ANY"}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono text-[11px]">
                      {rows.map((r, idx) => (
                        <tr
                          key={idx}
                          onClick={() => openRowInspector(r)}
                          className="hover:bg-muted/40 cursor-pointer transition-colors"
                          title="Click row to inspect JSON, related records, or edit"
                        >
                          <td className="px-2.5 py-2 text-center border-r border-border/30">
                            <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-primary mx-auto" />
                          </td>
                          {columns.map((col) => (
                            <td
                              key={col.name}
                              className="px-3 py-2 whitespace-nowrap border-r border-border/30 last:border-r-0"
                            >
                              {formatCell(r[col.name], col.name)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Page <strong className="text-foreground">{page}</strong> of{" "}
                  <strong className="text-foreground">{totalPages}</strong> (
                  {totalCount.toLocaleString()} total rows)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-7 px-2"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SQL QUERY EDITOR */}
          {activeTab === "sql" && (
            <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-semibold text-muted-foreground mr-1">
                  Quick Queries:
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] font-mono"
                  onClick={() =>
                    setSqlText(
                      "SELECT status, COUNT(*) AS count\nFROM leads\nGROUP BY status\nORDER BY count DESC;"
                    )
                  }
                >
                  Lead Counts by Stage
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] font-mono"
                  onClick={() =>
                    setSqlText(
                      "SELECT l.id, l.lead_code, l.name, u.name AS counselor, c.name AS campaign\nFROM leads l\nLEFT JOIN users u ON l.assigned_to = u.id\nLEFT JOIN campaigns c ON l.campaign_id = c.id\nORDER BY l.id DESC\nLIMIT 50;"
                    )
                  }
                >
                  Leads + Counselor + Campaign JOIN
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] font-mono"
                  onClick={() =>
                    setSqlText(
                      "SELECT id, lead_code, name, json_extract(raw_attributes, '$.school') AS school, json_extract(raw_attributes, '$.stream') AS stream\nFROM leads\nLIMIT 50;"
                    )
                  }
                >
                  Dynamic JSON Fields
                </Button>
              </div>

              <div className="border border-border rounded-xl bg-card overflow-hidden">
                <textarea
                  value={sqlText}
                  onChange={(e) => setSqlText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleRunSql();
                    }
                  }}
                  rows={5}
                  spellCheck={false}
                  className="w-full p-3 bg-transparent font-mono text-xs focus:outline-none resize-y"
                  placeholder="Write SQL query here... (Ctrl + Enter to run)"
                />
                <div className="px-3 py-2 bg-muted/40 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowWrite}
                      onChange={(e) => setAllowWrite(e.target.checked)}
                      className="rounded border-border"
                    />
                    {allowWrite ? (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <Unlock className="w-3.5 h-3.5" />
                        Allow Write Queries (INSERT / UPDATE / DELETE)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Lock className="w-3.5 h-3.5" />
                        Read-Only Mode (Safe)
                      </span>
                    )}
                  </label>

                  <Button
                    size="sm"
                    onClick={handleRunSql}
                    disabled={sqlRunning}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {sqlRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Run Query (Ctrl+Enter)</span>
                  </Button>
                </div>
              </div>

              {sqlError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2 font-mono">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{sqlError}</span>
                </div>
              )}

              {sqlResult && (
                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      {sqlResult.isReadOnly ? (
                        <span>
                          Returned <strong>{sqlResult.totalReturned}</strong> row(s)
                          {sqlResult.truncated ? " (showing first 1,000)" : ""}
                        </span>
                      ) : (
                        <span>
                          Query executed — <strong>{sqlResult.changes}</strong> row(s) affected
                        </span>
                      )}
                      <span className="text-muted-foreground font-mono flex items-center gap-1 ml-2">
                        <Clock className="w-3 h-3" />
                        {sqlResult.durationMs} ms
                      </span>
                    </div>

                    {sqlResult.isReadOnly &&
                      sqlResult.rows &&
                      sqlResult.rows.length > 0 &&
                      sqlResult.columns && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            exportToCsv(sqlResult.columns!, sqlResult.rows!, "query_result.csv")
                          }
                          className="h-7 text-xs gap-1.5"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export CSV</span>
                        </Button>
                      )}
                  </div>

                  {sqlResult.isReadOnly && sqlResult.columns && (
                    <div className="flex-1 border border-border/80 rounded-xl overflow-auto bg-card">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-muted/80 sticky top-0 border-b border-border">
                          <tr>
                            {sqlResult.columns.map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2 font-mono font-semibold text-[11px] whitespace-nowrap border-r border-border/40 last:border-r-0"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 font-mono text-[11px]">
                          {(sqlResult.rows || []).map((r, idx) => (
                            <tr key={idx} className="hover:bg-muted/30">
                              {sqlResult.columns!.map((col) => (
                                <td
                                  key={col}
                                  className="px-3 py-2 whitespace-nowrap border-r border-border/30 last:border-r-0"
                                >
                                  <span
                                    className="truncate block max-w-[260px]"
                                    title={r[col] !== null && r[col] !== undefined ? String(r[col]) : "NULL"}
                                  >
                                    {r[col] === null || r[col] === undefined ? (
                                      <span className="text-muted-foreground/50 italic">NULL</span>
                                    ) : (
                                      String(r[col])
                                    )}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STRUCTURE & RELATIONSHIPS */}
          {activeTab === "structure" && (
            <div className="flex-1 overflow-auto p-4 space-y-5">
              {/* Relationships Map */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-border/80 rounded-xl p-4 bg-card space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-primary" />
                    <span>Outgoing Foreign Keys ({foreignKeys.length})</span>
                  </div>
                  {foreignKeys.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No outgoing foreign keys.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {foreignKeys.map((fk, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/60 text-xs font-mono"
                        >
                          <span>
                            {selectedTable}.<strong>{fk.from}</strong>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <button
                            onClick={() => jumpToTable(fk.table)}
                            className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>
                              {fk.table}.{fk.to}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-border/80 rounded-xl p-4 bg-card space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Referenced By ({referencedBy.length})</span>
                  </div>
                  {referencedBy.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No other tables reference this table.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {referencedBy.map((ref, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/60 text-xs font-mono"
                        >
                          <button
                            onClick={() => jumpToTable(ref.table)}
                            className="text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>
                              {ref.table}.{ref.from}
                            </span>
                          </button>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>
                            {selectedTable}.<strong>{ref.to}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Columns ({columns.length})
                </h2>
                <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-muted/80 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 font-semibold">#</th>
                        <th className="px-3 py-2 font-semibold">Column Name</th>
                        <th className="px-3 py-2 font-semibold">Type</th>
                        <th className="px-3 py-2 font-semibold">Null</th>
                        <th className="px-3 py-2 font-semibold">Default</th>
                        <th className="px-3 py-2 font-semibold">Key / Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono text-[11px]">
                      {columns.map((c) => {
                        const fk = fkByColumn[c.name];
                        return (
                          <tr key={c.cid} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-muted-foreground">{c.cid}</td>
                            <td className="px-3 py-2 font-semibold">{c.name}</td>
                            <td className="px-3 py-2 text-primary">{c.type || "ANY"}</td>
                            <td className="px-3 py-2">{c.notnull ? "NO" : "YES"}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {c.dflt_value !== null ? String(c.dflt_value) : "NULL"}
                            </td>
                            <td className="px-3 py-2 flex items-center gap-1.5">
                              {c.pk > 0 && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                                  PK
                                </Badge>
                              )}
                              {fk && (
                                <button
                                  onClick={() => jumpToTable(fk.table)}
                                  className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <Link2 className="w-3 h-3" />
                                  <span>
                                    → {fk.table}.{fk.to}
                                  </span>
                                </button>
                              )}
                              {!c.pk && !fk && "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Indexes ({indexes.length})
                </h2>
                <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-muted/80 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Index Name</th>
                        <th className="px-3 py-2 font-semibold">Unique</th>
                        <th className="px-3 py-2 font-semibold">Origin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 font-mono text-[11px]">
                      {indexes.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                            No secondary indexes.
                          </td>
                        </tr>
                      ) : (
                        indexes.map((ix) => (
                          <tr key={ix.name} className="hover:bg-muted/30">
                            <td className="px-3 py-2 font-semibold">{ix.name}</td>
                            <td className="px-3 py-2">{ix.unique ? "YES" : "NO"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{ix.origin}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE API EXPLORER */}
          {activeTab === "api" && (
            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
              {/* Endpoint List */}
              <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-border/80 bg-muted/10 p-3 overflow-y-auto max-h-56 lg:max-h-none space-y-4 shrink-0">
                {(["Leads", "Tasks & Calls", "Metadata & Users", "Analytics & System", "Database"] as const).map(
                  (grp) => {
                    const items = API_CATALOG.filter((e) => e.group === grp);
                    return (
                      <div key={grp} className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">
                          {grp}
                        </div>
                        {items.map((ep) => {
                          const isSel = selectedEndpoint.id === ep.id;
                          return (
                            <button
                              key={ep.id}
                              onClick={() => {
                                setSelectedEndpoint(ep);
                                setApiMethod(ep.method);
                                setApiPath(ep.path);
                                setApiBody(ep.defaultBody || "");
                                setApiResponse(null);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-2 ${
                                isSel
                                  ? "bg-primary/15 text-primary font-semibold"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              }`}
                            >
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                  ep.method === "GET"
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : ep.method === "POST"
                                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {ep.method}
                              </span>
                              <span className="truncate">{ep.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                )}
              </div>

              {/* Request & Response Builder */}
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3 overflow-y-auto">
                <div>
                  <h2 className="text-sm font-bold">{selectedEndpoint.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedEndpoint.description}
                  </p>
                </div>

                {/* Method + URL Bar */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={apiMethod}
                    onChange={(e) => setApiMethod(e.target.value as any)}
                    className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-mono font-bold"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>

                  <Input
                    value={apiPath}
                    onChange={(e) => setApiPath(e.target.value)}
                    className="flex-1 min-w-[200px] h-9 font-mono text-xs"
                    placeholder="/api/leads?page=1&limit=20"
                  />

                  <Button
                    size="sm"
                    onClick={() => handleRunApi()}
                    disabled={apiLoading}
                    className="h-9 gap-1.5 text-xs"
                  >
                    {apiLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>Send</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCurl}
                    className="h-9 gap-1.5 text-xs"
                  >
                    {copiedCurl ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCurl ? "Copied cURL" : "Copy cURL"}</span>
                  </Button>
                </div>

                {/* Request JSON Body */}
                {apiMethod !== "GET" && apiMethod !== "DELETE" && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Request JSON Body
                    </label>
                    <textarea
                      value={apiBody}
                      onChange={(e) => setApiBody(e.target.value)}
                      rows={5}
                      spellCheck={false}
                      className="w-full p-3 rounded-xl border border-border bg-card font-mono text-xs focus:outline-none resize-y"
                      placeholder='{ "key": "value" }'
                    />
                  </div>
                )}

                {/* Response Viewer */}
                {apiResponse && (
                  <div className="flex-1 flex flex-col min-h-[240px] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`font-mono text-[11px] ${
                            apiResponse.ok
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }`}
                        >
                          HTTP {apiResponse.status}
                        </Badge>
                        <span className="text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {apiResponse.durationMs} ms
                        </span>
                      </div>
                    </div>

                    <pre className="flex-1 p-3.5 rounded-xl border border-border bg-card font-mono text-[11px] overflow-auto max-h-[420px] leading-relaxed">
                      {apiResponse.bodyText}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ROW INSPECTOR MODAL (JSON Formatter, Related Records, Inline Cell Edit, API Jump) */}
      {inspectedRow && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectedRow(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between gap-3 bg-muted/30">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <span>Row Inspector</span>
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {selectedTable}.{pkColumnName} = {String(inspectedRow[pkColumnName])}
                  </Badge>
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Click foreign keys to jump to linked tables, or enable Write Mode to edit cells.
                </p>
              </div>
              <button
                onClick={() => setInspectedRow(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Quick Actions: Write Mode Toggle + Jump to API */}
              <div className="flex items-center justify-between gap-2 flex-wrap p-2.5 rounded-xl bg-muted/30 border border-border/60">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowWrite}
                    onChange={(e) => setAllowWrite(e.target.checked)}
                    className="rounded border-border"
                  />
                  {allowWrite ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                      <Unlock className="w-3.5 h-3.5" />
                      Write Mode Enabled (Can Edit Values)
                    </span>
                  ) : (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" />
                      Read-Only View
                    </span>
                  )}
                </label>

                {selectedTable === "leads" && inspectedRow.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openInApiExplorer("leads-get-one", `/api/leads/${inspectedRow.id}`)}
                    className="h-7 text-[11px] font-mono gap-1 text-primary border-primary/30"
                  >
                    <Globe className="w-3 h-3" />
                    <span>Fetch GET /api/leads/{inspectedRow.id}</span>
                  </Button>
                )}
              </div>

              {cellEditError && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  {cellEditError}
                </div>
              )}

              {/* Related Records Section */}
              {referencedBy.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Linked Child Records
                  </div>
                  {loadingRelated ? (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Checking related tables...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {relatedCounts.map((rel) => (
                        <Button
                          key={`${rel.table}.${rel.from}`}
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            jumpToTable(rel.table, rel.from, String(inspectedRow[pkColumnName]))
                          }
                          className="h-7 text-xs font-mono gap-1.5"
                        >
                          <Link2 className="w-3 h-3 text-primary" />
                          <span>
                            {rel.table} ({rel.count})
                          </span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Column Values */}
              <div className="border border-border/80 rounded-xl divide-y divide-border/60">
                {columns.map((col) => {
                  const val = inspectedRow[col.name];
                  const fk = fkByColumn[col.name];
                  const prettyJson = tryPrettyJson(val);
                  const isEditingThis = editingCol === col.name;

                  return (
                    <div key={col.name} className="p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono">
                          {col.pk > 0 && <Key className="w-3 h-3 text-amber-500" />}
                          <span className="font-semibold text-foreground">{col.name}</span>
                          <span className="text-[10px] text-muted-foreground">{col.type}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {fk && val !== null && val !== undefined && (
                            <button
                              onClick={() => jumpToTable(fk.table, fk.to, String(val))}
                              className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Link2 className="w-3 h-3" />
                              <span>
                                Open {fk.table} ({String(val)})
                              </span>
                            </button>
                          )}

                          {allowWrite && !col.pk && !isEditingThis && (
                            <button
                              onClick={() => {
                                setEditingCol(col.name);
                                setEditingVal(val === null || val === undefined ? "" : String(val));
                              }}
                              className="text-muted-foreground hover:text-primary cursor-pointer p-1"
                              title="Edit cell value"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditingThis ? (
                        <div className="flex items-center gap-2 pt-1">
                          <Input
                            value={editingVal}
                            onChange={(e) => setEditingVal(e.target.value)}
                            className="h-8 font-mono text-xs flex-1"
                          />
                          <Button
                            size="sm"
                            disabled={savingCell}
                            onClick={() => handleSaveCellEdit(col.name)}
                            className="h-8 gap-1 text-xs"
                          >
                            {savingCell ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            <span>Save</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingCol(null)}
                            className="h-8 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : prettyJson ? (
                        <pre className="p-2.5 rounded-lg bg-muted/40 border border-border/60 font-mono text-[11px] overflow-x-auto">
                          {prettyJson}
                        </pre>
                      ) : (
                        <div className="font-mono text-[11px] text-muted-foreground break-all">
                          {val === null || val === undefined ? (
                            <span className="italic opacity-60">NULL</span>
                          ) : (
                            String(val)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
