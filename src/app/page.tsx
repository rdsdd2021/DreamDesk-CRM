"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Lead,
  FacetGroup,
  SchemaMeta,
  User,
  Disposition,
  FilterParams,
  LeadsResponse,
  LeadSummaryStats,
  SavedView,
  Campaign,
} from "@/types/crm";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { CommandCenter } from "@/components/crm/CommandCenter";
import { AnalyticsDashboard } from "@/components/crm/AnalyticsDashboard";
import { PipelineKanbanView } from "@/components/crm/PipelineKanbanView";
import { CampaignsSchemaStudio } from "@/components/crm/CampaignsSchemaStudio";
import { CampaignsWorkspace } from "@/components/crm/CampaignsWorkspace";
import { DispositionsWorkspace } from "@/components/crm/DispositionsWorkspace";
import { SchemaStudioWorkspace } from "@/components/crm/SchemaStudioWorkspace";
import { WorkQueueTabs, WorkQueueId } from "@/components/crm/WorkQueueTabs";
import { KeyboardShortcutsModal } from "@/components/crm/KeyboardShortcutsModal";
import { DynamicFacetToolbar } from "@/components/crm/DynamicFacetToolbar";
import { FilterSidebar } from "@/components/crm/FilterSidebar";
import { LeadsTable } from "@/components/crm/LeadsTable";
import { CompactKpiBar } from "@/components/crm/CompactKpiBar";
import { UnifiedCommandBar } from "@/components/crm/UnifiedCommandBar";
import { SpeedDialerWorkspace } from "@/components/crm/SpeedDialerWorkspace";
import { BulkActionBar } from "@/components/crm/BulkActionBar";
import { BulkAssignModal } from "@/components/crm/BulkAssignModal";
import { BulkTagsModal } from "@/components/crm/BulkTagsModal";
import { BulkCampaignModal } from "@/components/crm/BulkCampaignModal";
import { NotificationBell } from "@/components/crm/NotificationBell";
import { EnhancedLeadDrawer } from "@/components/crm/EnhancedLeadDrawer";
import { TasksModal } from "@/components/crm/TasksModal";
import { DuplicatesModal } from "@/components/crm/DuplicatesModal";
import { WhatsAppModal } from "@/components/crm/WhatsAppModal";
import { ImportModal } from "@/components/crm/ImportModal";
import { TeamModal } from "@/components/crm/TeamModal";
import { ActivityLogsModal } from "@/components/crm/ActivityLogsModal";
import { TasksWorkspace } from "@/components/crm/TasksWorkspace";
import { TeamWorkspace } from "@/components/crm/TeamWorkspace";
import { ImportWorkspace } from "@/components/crm/ImportWorkspace";
import { ActivityWorkspace } from "@/components/crm/ActivityWorkspace";
import { PoliciesWorkspace } from "@/components/crm/PoliciesWorkspace";
import { PaginationBar } from "@/components/crm/PaginationBar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sparkles,
  Upload,
  SlidersHorizontal,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Command,
  Filter,
  Eye,
  UserCheck,
  UserX,
  Target,
  Kanban,
  LayoutDashboard,
  GraduationCap,
  Layers,
  Sun,
  Moon,
  ChevronDown,
  Clock,
  GitMerge,
  Zap,
  History,
  Tag,
  LogOut,
  PhoneCall,
  Menu,
  ShieldCheck,
} from "lucide-react";

export default function CRMPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Authenticate session on load
  const checkAuth = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!data.authenticated || !data.user) {
        router.push("/login");
        return;
      }
      setCurrentUser(data.user);
      setPermissions(data.permissions);

      // Enforce counselor perspective lock
      if (
        data.user.role === "counselor" ||
        data.user.role === "senior_counselor" ||
        data.user.role === "telecaller"
      ) {
        setRoleMode("counselor");
        setActiveCounselorId(data.user.id);
        setSelectedFacets((prev) => ({ ...prev, assigned_to: [data.user.id] }));
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      router.push("/login");
    } finally {
      setAuthLoading(false);
    }
  }, [router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Live session deactivation heartbeat:
  // Instantly kicks out deactivated users and boots them to login
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.status === 401) {
          router.push("/login?reason=deactivated");
        }
      } catch {
        // network glitch
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [currentUser, router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  };

  const handleSwitchUser = async (userToSwitch: User) => {
    try {
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userToSwitch.id, quickLogin: true }),
      });
      window.location.reload();
    } catch (err) {
      console.error("Switch user error:", err);
    }
  };

  // Navigation & View State
  const [currentView, setCurrentView] = useState<string>("leads");
  const [studioTab, setStudioTab] = useState<"fields" | "campaigns" | "dispositions" | "matrix">("fields");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);

  // Right Filter Sidebar State (persisted in localStorage after hydration)
  const [filterSidebarOpen, setFilterSidebarOpen] = useState<boolean>(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dreamdesk_filter_sidebar_open");
      if (saved !== null) {
        setFilterSidebarOpen(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  // Mobile Drawer State
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const toggleFilterSidebar = () => {
    setFilterDrawerOpen((prev) => !prev);
  };

  // Counselor Role Filter (Admin: all leads, or Counselor: my leads)
  const [roleMode, setRoleMode] = useState<"admin" | "counselor">("admin");
  const [activeCounselorId, setActiveCounselorId] = useState<string>("usr_rohit");

  const isRestrictedCounselor = currentUser
    ? (currentUser.role === "counselor" || currentUser.role === "senior_counselor" || currentUser.role === "telecaller")
    : (roleMode === "counselor");

  // Data State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalFilteredCount, setTotalFilteredCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [facets, setFacets] = useState<FacetGroup[]>([]);
  const [schemaMeta, setSchemaMeta] = useState<SchemaMeta[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<LeadSummaryStats>({
    totalLeads: 0,
    unassignedCount: 0,
    assignedCount: 0,
    statusBreakdown: {} as Record<string, number>,
    isFiltered: false,
  });
  const [globalSummary, setGlobalSummary] = useState<LeadSummaryStats>({
    totalLeads: 0,
    unassignedCount: 0,
    assignedCount: 0,
    statusBreakdown: {} as Record<string, number>,
    isFiltered: false,
  });

  // Filter & Query State
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "lead_code",
    "name",
    "phone",
    "status",
    "disposition",
    "campaign",
    "assigned_to",
    "stream",
    "school",
    "board",
    "city",
    "score",
  ]);

  // Selection State
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [isAllFilteredSelected, setIsAllFilteredSelected] = useState(false);

  // Modals & Sheets
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [isBulkTagsModalOpen, setIsBulkTagsModalOpen] = useState(false);
  const [isBulkCampaignModalOpen, setIsBulkCampaignModalOpen] = useState(false);
  const [isAutoDistributing, setIsAutoDistributing] = useState(false);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [whatsAppTargetLead, setWhatsAppTargetLead] = useState<Lead | null>(null);

  // Intuitive Productivity State
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeQueue, setActiveQueue] = useState<WorkQueueId>("all");
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [activeLeadIndex, setActiveLeadIndex] = useState<number | null>(null);
  const [claimingLeads, setClaimingLeads] = useState(false);
  const [leadsViewMode, setLeadsViewMode] = useState<"table" | "grid" | "dialer">("table");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Theme State
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("dreamdesk_theme");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
        document.documentElement.classList.add("dark");
        setIsDark(true);
      } else {
        document.documentElement.classList.remove("dark");
        setIsDark(false);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    try {
      if (nextDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("dreamdesk_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("dreamdesk_theme", "light");
      }
    } catch {
      // ignore
    }
  };

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  // Load initial Schema, Users, Dispositions & Saved Views
  const loadMetaAndUsers = useCallback(async () => {
    try {
      const [metaRes, usersRes, dispRes, viewsRes, campsRes] = await Promise.all([
        fetch("/api/schema").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/dispositions").then((r) => r.json()),
        fetch("/api/saved-views").then((r) => r.json()),
        fetch("/api/campaigns").then((r) => r.json()),
      ]);
      if (Array.isArray(metaRes)) setSchemaMeta(metaRes);
      if (Array.isArray(usersRes)) setUsers(usersRes);
      if (Array.isArray(dispRes)) setDispositions(dispRes);
      if (Array.isArray(viewsRes)) setSavedViews(viewsRes);
      if (Array.isArray(campsRes)) setCampaigns(campsRes);
    } catch (err) {
      console.error("Failed to load metadata/users/dispositions/views/campaigns:", err);
    }
  }, []);

  useEffect(() => {
    loadMetaAndUsers();
  }, [loadMetaAndUsers]);

  // Load Leads with Filters
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      // If in counselor mode, force assigned_to = activeCounselorId
      const facetsToApply = { ...selectedFacets };
      if (roleMode === "counselor") {
        facetsToApply["assigned_to"] = [activeCounselorId];
      }

      // Append Facets
      Object.entries(facetsToApply).forEach(([key, values]) => {
        if (values && values.length > 0) {
          if (key === "status") {
            params.set("status", values.join(","));
          } else if (key === "assigned_to") {
            params.set("assigned_to", values.join(","));
          } else if (key === "campaign_id") {
            params.set("campaign_id", values.join(","));
          } else if (key === "disposition_id") {
            params.set("disposition_id", values.join(","));
          } else {
            params.set(`facet_${key}`, values.join(","));
          }
        }
      });

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.status === 401) {
        router.push("/login?reason=deactivated");
        return;
      }
      const data: LeadsResponse = await res.json();

      setLeads(data.leads || []);
      setTotalFilteredCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setFacets(data.facets || []);
      if (data.summary) {
        setSummary(data.summary);
      }
      if (data.globalSummary) {
        setGlobalSummary(data.globalSummary);
        setTotalCount(data.globalSummary.totalLeads);
      } else if (data.summary && !data.summary.isFiltered) {
        setGlobalSummary(data.summary);
        setTotalCount(data.summary.totalLeads);
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
      showToast("Error retrieving leads", "error");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, selectedFacets, roleMode, activeCounselorId]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Handle Facet Toggle
  const handleFacetToggle = (key: string, value: string) => {
    setSelectedFacets((prev) => {
      const current = prev[key] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];

      if (updated.length === 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return { ...prev, [key]: updated };
    });
    setPage(1);
    setSelectedLeadIds([]);
    setIsAllFilteredSelected(false);
  };

  const handleClearAllFilters = () => {
    setActiveQueue("all");
    setSearch("");
    setDebouncedSearch("");
    setSelectedFacets({});
    setPage(1);
    setSelectedLeadIds([]);
    setIsAllFilteredSelected(false);
  };

  // Work Queue Selection
  const handleSelectQueue = (queueId: WorkQueueId) => {
    setActiveQueue(queueId);
    setPage(1);
    setSelectedLeadIds([]);
    setIsAllFilteredSelected(false);

    if (queueId === "all") {
      setSelectedFacets({});
    } else if (queueId === "callbacks") {
      const cbDispIds = dispositions.filter((d) => d.requires_callback === 1).map((d) => d.id);
      setSelectedFacets({ disposition_id: cbDispIds.length > 0 ? cbDispIds : ["disp_cb_requested", "disp_couns_booked", "disp_followup_needed"] });
    } else if (queueId === "unassigned") {
      setSelectedFacets({ assigned_to: ["unassigned"] });
    } else if (queueId === "high_intent") {
      const highIntentDispIds = dispositions.filter((d) => d.category === "positive" || d.score >= 60).map((d) => d.id);
      setSelectedFacets({ disposition_id: highIntentDispIds.length > 0 ? highIntentDispIds : ["disp_adm_filled", "disp_couns_booked", "disp_high_intent"] });
    } else if (queueId === "followups") {
      setSelectedFacets({ status: ["Follow-up"] });
    } else if (queueId === "unreached") {
      const unreachedDispIds = dispositions.filter((d) => d.category === "unreachable").map((d) => d.id);
      setSelectedFacets({ disposition_id: unreachedDispIds.length > 0 ? unreachedDispIds : ["disp_rnr", "disp_busy", "disp_switched_off"] });
    }
  };

  // 1-Click Counselor Self-Allocation
  const handleClaimLeads = async () => {
    setClaimingLeads(true);
    try {
      const res = await fetch("/api/leads/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: activeCounselorId, count: 25 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to claim leads");
      showToast(data.message, "success");
      fetchLeads();
      loadMetaAndUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to claim leads", "error");
    } finally {
      setClaimingLeads(false);
    }
  };

  // Fast In-Table Call Outcome Logging
  const handleQuickDispositionChange = async (
    leadId: number,
    dispositionId: string,
    extra?: { call_outcome?: string; callback_at?: string; notes?: string; sub_disposition_id?: string }
  ) => {
    const disp = dispositions.find((d) => d.id === dispositionId);
    try {
      const res = await fetch(`/api/leads/${leadId}/disposition`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disposition_id: dispositionId,
          call_outcome: extra?.call_outcome,
          callback_at: extra?.callback_at,
          notes: extra?.notes,
          sub_disposition_id: extra?.sub_disposition_id,
        }),
      });
      if (!res.ok) throw new Error("Failed to update disposition");
      const updatedLead = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...updatedLead } : l)));

      if (disp?.category === "unreachable" || extra?.call_outcome === "unreachable") {
        const attemptMsg = updatedLead.attempt_count ? `Attempt #${updatedLead.attempt_count}/3 logged.` : "Attempt logged.";
        showToast(`${attemptMsg} Cooldown active. Lead kept in retry queue.`, "success");
      } else {
        showToast(`Logged outcome: ${disp?.name || "Updated"}`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update disposition", "error");
      fetchLeads();
    }
  };

  // Fast Inline Cell Update Handler (Airtable-grade editing)
  const handleInlineFieldUpdate = async (leadId: number, field: string, value: any) => {
    // 1. Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id === leadId) {
          if (field === "status") {
            return { ...l, status: value };
          }
          if (field === "assigned_to") {
            const userObj = users.find((u) => u.id === value);
            return {
              ...l,
              assigned_to: value || null,
              assigned_user_name: userObj?.name || null,
              assigned_user_color: userObj?.avatar_color || null,
            };
          }
          if (field === "score") {
            return {
              ...l,
              raw_attributes: {
                ...(l.raw_attributes || {}),
                score: Number(value),
              },
            };
          }
        }
        return l;
      })
    );

    // 2. Persist in background
    try {
      const res = await fetch(`/api/leads/${leadId}/field`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      if (!res.ok) throw new Error("Failed to update field");
      showToast(`Updated ${field}`, "success");
    } catch (err: any) {
      showToast(err.message || "Update failed", "error");
      fetchLeads();
    }
  };

  // 1-Click Automated Lead Routing & Distribution Engine
  const handleAutoDistribute = async (count: number = 250) => {
    setIsAutoDistributing(true);
    try {
      const res = await fetch("/api/leads/auto-distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to auto-distribute");
      showToast(data.message, "success");
      fetchLeads();
      loadMetaAndUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to auto-distribute", "error");
    } finally {
      setIsAutoDistributing(false);
    }
  };

  // Sequential Lead Navigation (Drawer Stepper)
  const currentLeadIndex = selectedLeadForDetail
    ? leads.findIndex((l) => l.id === selectedLeadForDetail.id)
    : -1;
  const hasPrevLead = currentLeadIndex > 0;
  const hasNextLead = currentLeadIndex >= 0 && currentLeadIndex < leads.length - 1;

  const handleNextLead = useCallback(() => {
    if (hasNextLead && currentLeadIndex >= 0) {
      const nextIndex = currentLeadIndex + 1;
      setSelectedLeadForDetail(leads[nextIndex]);
      setActiveLeadIndex(nextIndex);
    }
  }, [hasNextLead, currentLeadIndex, leads]);

  const handlePrevLead = useCallback(() => {
    if (hasPrevLead && currentLeadIndex > 0) {
      const prevIndex = currentLeadIndex - 1;
      setSelectedLeadForDetail(leads[prevIndex]);
      setActiveLeadIndex(prevIndex);
    }
  }, [hasPrevLead, currentLeadIndex, leads]);

  // Saved Views Handlers
  const handleApplySavedView = (view: SavedView) => {
    setSearch(view.search_query || view.search || "");
    setSelectedFacets(view.filters || {});
    if (view.sort_by) setSortBy(view.sort_by);
    if (view.sort_order) setSortOrder(view.sort_order);
    setPage(1);
    showToast(`Applied saved view: "${view.name}"`, "success");
  };

  const handleSaveCurrentView = async (name: string) => {
    try {
      const res = await fetch("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          filters: selectedFacets,
          sort_by: sortBy,
          sort_order: sortOrder,
          search_query: search,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save view");
      setSavedViews((prev) => [data, ...prev]);
      showToast(`Saved view "${name}"`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to save view", "error");
    }
  };

  const handleDeleteSavedView = async (id: string) => {
    try {
      const res = await fetch(`/api/saved-views?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete view");
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
      showToast("Saved view removed", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to delete view", "error");
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        if (e.key === "Escape") {
          target.blur();
        }
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search leads"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      } else if (e.key === "?") {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === "1") {
        handleSelectQueue("all");
      } else if (e.key === "2") {
        handleSelectQueue("callbacks");
      } else if (e.key === "3") {
        handleSelectQueue("unassigned");
      } else if (e.key === "4") {
        handleSelectQueue("high_intent");
      } else if (e.key === "5") {
        handleSelectQueue("followups");
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setActiveLeadIndex((prev) => (prev === null ? 0 : Math.min(leads.length - 1, prev + 1)));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setActiveLeadIndex((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
      } else if (e.key === "Enter" || e.key === "o") {
        if (activeLeadIndex !== null && leads[activeLeadIndex]) {
          e.preventDefault();
          setSelectedLeadForDetail(leads[activeLeadIndex]);
        }
      } else if (e.key === "x" || e.key === " ") {
        if (activeLeadIndex !== null && leads[activeLeadIndex]) {
          e.preventDefault();
          handleToggleLeadSelection(leads[activeLeadIndex].id);
        }
      } else if (e.key.toLowerCase() === "c") {
        const targetLead = selectedLeadForDetail || (activeLeadIndex !== null ? leads[activeLeadIndex] : null);
        if (targetLead?.phone) {
          e.preventDefault();
          window.location.href = `tel:${targetLead.phone}`;
        }
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFilterSidebar();
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setIsTasksModalOpen((prev) => !prev);
      } else if (e.key === "[" || (e.altKey && e.key === "ArrowLeft")) {
        if (selectedLeadForDetail) {
          e.preventDefault();
          handlePrevLead();
        } else if (leadsViewMode === "dialer") {
          e.preventDefault();
          setActiveLeadIndex((prev) => (prev === null ? 0 : Math.max(0, prev - 1)));
        }
      } else if (e.key === "]" || (e.altKey && e.key === "ArrowRight")) {
        if (selectedLeadForDetail) {
          e.preventDefault();
          handleNextLead();
        } else if (leadsViewMode === "dialer") {
          e.preventDefault();
          setActiveLeadIndex((prev) => (prev === null ? (leads.length > 1 ? 1 : 0) : Math.min(leads.length - 1, prev + 1)));
        }
      } else if (e.key.toLowerCase() === "w") {
        const targetLead = selectedLeadForDetail || (activeLeadIndex !== null ? leads[activeLeadIndex] : null);
        if (targetLead?.phone) {
          e.preventDefault();
          const cleanPhone = targetLead.phone.replace(/[^0-9]/g, "");
          window.open(`https://wa.me/${cleanPhone}`, "_blank");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [leads, activeLeadIndex, dispositions, toggleFilterSidebar, selectedLeadForDetail, handleNextLead, handlePrevLead, leadsViewMode]);

  const handleToggleColumnVisibility = (key: string) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Selection Handlers
  const handleToggleLeadSelection = (id: number) => {
    setIsAllFilteredSelected(false);
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isAllPageSelected =
    leads.length > 0 && leads.every((l) => selectedLeadIds.includes(l.id));

  const handleToggleSelectAllPage = () => {
    const pageLeadIds = leads.map((l) => l.id);
    if (isAllPageSelected) {
      // Unselect only current page items, preserving selections from other pages!
      setSelectedLeadIds((prev) => prev.filter((id) => !pageLeadIds.includes(id)));
      setIsAllFilteredSelected(false);
    } else {
      // Merge current page items with existing selections across pages without wiping!
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...pageLeadIds])));
      setIsAllFilteredSelected(false);
    }
  };

  const handleSelectAllFiltered = () => {
    setIsAllFilteredSelected(true);
    setSelectedLeadIds(leads.map((l) => l.id));
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
    setIsAllFilteredSelected(false);
  };

  // Bulk Assignment Complete
  const handleAssignComplete = (affected: number, message: string) => {
    showToast(message, "success");
    handleClearSelection();
    fetchLeads();
    loadMetaAndUsers();
  };

  // Bulk Status Change
  const handleBulkStatusChange = async (status: string) => {
    try {
      const res = await fetch("/api/leads/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          lead_ids: isAllFilteredSelected ? undefined : selectedLeadIds,
          apply_to_all_filtered: isAllFilteredSelected,
          filter_params: isAllFilteredSelected ? getFilterParamsObject() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, "success");
      handleClearSelection();
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "error");
    }
  };

  // Bulk Campaign Change
  const handleBulkCampaignChange = async (campaignId: string | null) => {
    try {
      const res = await fetch("/api/leads/bulk-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          lead_ids: isAllFilteredSelected ? undefined : selectedLeadIds,
          apply_to_all_filtered: isAllFilteredSelected,
          filter_params: isAllFilteredSelected ? getFilterParamsObject() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update campaign");

      showToast(data.message, "success");
      handleClearSelection();
      fetchLeads();
      loadMetaAndUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to update campaign", "error");
    }
  };

  // Bulk Tags Applied Handler
  const handleBulkTagsApplied = (message: string) => {
    showToast(message, "success");
    handleClearSelection();
    fetchLeads();
    loadMetaAndUsers();
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    const count = isAllFilteredSelected ? totalFilteredCount : selectedLeadIds.length;
    if (!confirm(`Are you sure you want to permanently delete ${count.toLocaleString()} leads?`)) {
      return;
    }

    try {
      const res = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_ids: isAllFilteredSelected ? undefined : selectedLeadIds,
          apply_to_all_filtered: isAllFilteredSelected,
          filter_params: isAllFilteredSelected ? getFilterParamsObject() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, "success");
      handleClearSelection();
      fetchLeads();
      loadMetaAndUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to delete leads", "error");
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      let leadsToExport = leads;

      // If user selected all matching filtered leads or multiple items, fetch the filtered set
      if (isAllFilteredSelected || (selectedLeadIds.length > leads.length)) {
        showToast("Generating comprehensive CSV export...", "success");
        const params = new URLSearchParams();
        params.set("limit", "10000"); // export up to 10k in a batch
        params.set("page", "1");
        params.set("sortBy", sortBy);
        params.set("sortOrder", sortOrder);
        if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

        const facetsToExport = { ...selectedFacets };
        if (roleMode === "counselor") {
          facetsToExport["assigned_to"] = [activeCounselorId];
        }

        Object.entries(facetsToExport).forEach(([k, vals]) => {
          if (vals && vals.length > 0) {
            if (k === "status") params.set("status", vals.join(","));
            else if (k === "assigned_to") params.set("assigned_to", vals.join(","));
            else if (k === "campaign_id") params.set("campaign_id", vals.join(","));
            else if (k === "disposition_id") params.set("disposition_id", vals.join(","));
            else params.set(`facet_${k}`, vals.join(","));
          }
        });

        const res = await fetch(`/api/leads?${params.toString()}`);
        const data = await res.json();
        if (Array.isArray(data.leads) && data.leads.length > 0) {
          leadsToExport = data.leads;
        }
      } else if (selectedLeadIds.length > 0) {
        leadsToExport = leads.filter((l) => selectedLeadIds.includes(l.id));
      }

      if (leadsToExport.length === 0) {
        showToast("No leads to export", "error");
        return;
      }

      const headers = [
        "Lead Code",
        "Student Name",
        "Phone",
        "Email",
        "Status",
        "Call Outcome",
        "Campaign",
        "Assigned Counselor",
        "Scheduled Callback",
        "Registered Date",
      ];
      const dynamicKeys = schemaMeta.map((m) => m.key_name);
      const allHeaders = [...headers, ...schemaMeta.map((m) => m.display_label)];

      const rows = leadsToExport.map((l) => [
        l.lead_code,
        `"${(l.name || "").replace(/"/g, '""')}"`,
        `"${(l.phone || "").replace(/"/g, '""')}"`,
        `"${(l.email || "").replace(/"/g, '""')}"`,
        `"${l.status}"`,
        `"${l.disposition_name || "Uncontacted"}"`,
        `"${l.campaign_name || "Direct / Organic"}"`,
        `"${l.assigned_user_name || "Unallocated"}"`,
        `"${l.callback_at ? new Date(l.callback_at).toLocaleString() : ""}"`,
        `"${new Date(l.created_at).toLocaleDateString()}"`,
        ...dynamicKeys.map((k) => `"${String(l.raw_attributes[k] ?? "").replace(/"/g, '""')}"`),
      ]);

      const csvString = "\uFEFF" + [allHeaders.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `dreamdesk_leads_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Exported ${leadsToExport.length.toLocaleString()} leads to CSV`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to export CSV", "error");
    }
  };

  // Generate Sample Leads
  const handleGenerateSampleLeads = async (count: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(data.message, "success");
      fetchLeads();
      loadMetaAndUsers();
    } catch (err: any) {
      showToast(err.message || "Failed to generate leads", "error");
    } finally {
      setLoading(false);
    }
  };

  // Single Lead Update Handlers
  const handleUpdateLeadStatus = async (leadId: number, status: string) => {
    try {
      await fetch("/api/leads/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_ids: [leadId], status }),
      });
      showToast(`Updated status to "${status}"`, "success");
      fetchLeads();
      if (selectedLeadForDetail?.id === leadId) {
        setSelectedLeadForDetail((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err: any) {
      showToast(err.message || "Failed to update status", "error");
    }
  };

  const handleAssignSingleLead = async (leadId: number, userId: string) => {
    try {
      await fetch("/api/leads/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "single",
          lead_ids: [leadId],
          single_user_id: userId || null,
        }),
      });
      const assignedUser = users.find((u) => u.id === userId);
      showToast(
        userId ? `Assigned to ${assignedUser?.name || "Counselor"}` : "Unassigned lead",
        "success"
      );
      fetchLeads();
      loadMetaAndUsers();
      if (selectedLeadForDetail?.id === leadId) {
        setSelectedLeadForDetail((prev) =>
          prev
            ? {
                ...prev,
                assigned_to: userId || null,
                assigned_user_name: assignedUser?.name || null,
              }
            : null
        );
      }
    } catch (err: any) {
      showToast(err.message || "Failed to assign lead", "error");
    }
  };

  // Schema Meta Update
  const handleUpdateHeader = async (keyName: string, updates: Partial<SchemaMeta>) => {
    try {
      const res = await fetch("/api/schema", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_name: keyName, updates }),
      });
      if (!res.ok) throw new Error("Update failed");
      showToast(`Header configuration saved`, "success");
      loadMetaAndUsers();
      fetchLeads();
    } catch (err: any) {
      showToast(err.message || "Failed to update header", "error");
    }
  };

  const getFilterParamsObject = (): FilterParams => {
    const facetsToApply = { ...selectedFacets };
    if (roleMode === "counselor") {
      facetsToApply["assigned_to"] = [activeCounselorId];
    }

    return {
      search: debouncedSearch || undefined,
      status: facetsToApply["status"],
      assigned_to: facetsToApply["assigned_to"],
      campaign_id: facetsToApply["campaign_id"],
      disposition_id: facetsToApply["disposition_id"],
      facets: Object.fromEntries(
        Object.entries(facetsToApply).filter(
          ([k]) => !["status", "assigned_to", "campaign_id", "disposition_id"].includes(k)
        )
      ),
    };
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary animate-pulse shadow-sm">
            <GraduationCap className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-muted-foreground animate-pulse">
            Verifying staff permissions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold border ${
              toastMessage.type === "success"
                ? "bg-card text-foreground border-emerald-500/40 shadow-emerald-500/10"
                : "bg-destructive text-destructive-foreground border-destructive"
            }`}
          >
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Global Command Center (Ctrl+K) */}
      <CommandCenter
        open={isCommandCenterOpen}
        onOpenChange={setIsCommandCenterOpen}
        onSelectView={(v) => {
          if (v === "fields") {
            setStudioTab("fields");
            setCurrentView("fields");
          } else if (v === "campaigns") {
            setStudioTab("campaigns");
            setCurrentView("campaigns");
          } else if (v === "dispositions") {
            setStudioTab("dispositions");
            setCurrentView("dispositions");
          } else if (v === "studio") {
            setStudioTab("campaigns");
            setCurrentView("campaigns");
          } else {
            setCurrentView(v);
          }
        }}
        onSelectLead={(l) => setSelectedLeadForDetail(l)}
        onOpenImport={() => setCurrentView("import")}
        onOpenGenerate={() => handleGenerateSampleLeads(2500)}
      />

      {/* Modern Collapsible Sidebar */}
      <AppSidebar
        currentView={currentView}
        onSelectView={(v) => {
          if (v === "fields") {
            setStudioTab("fields");
            setCurrentView("fields");
          } else if (v === "campaigns") {
            setStudioTab("campaigns");
            setCurrentView("campaigns");
          } else if (v === "dispositions") {
            setStudioTab("dispositions");
            setCurrentView("dispositions");
          } else {
            setCurrentView(v);
          }
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        totalLeadsCount={totalCount}
        unassignedCount={globalSummary.unassignedCount || summary.unassignedCount}
        counselorsCount={users.length}
        currentUser={currentUser}
        allowedViews={permissions?.allowedViews}
        onLogout={handleLogout}
      />

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-border/80 bg-card/80 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          {/* Breadcrumb & Section Info */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Navigation Drawer Trigger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 -ml-1 mr-0.5"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </Button>

            <h1 className="text-xs sm:text-base font-bold text-foreground capitalize flex items-center gap-2 truncate">
              {currentView === "leads" && <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />}
              {currentView === "dashboard" && <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0" />}
              {currentView === "pipeline" && <Kanban className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500 shrink-0" />}
              {currentView === "campaigns" && <Target className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />}
              {currentView === "dispositions" && <Tag className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 shrink-0" />}
              {currentView === "fields" && <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />}
              {currentView === "tasks" && <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />}
              {currentView === "team" && <Users className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />}
              {currentView === "import" && <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0" />}
              {currentView === "activity" && <History className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 shrink-0" />}
              {currentView === "policies" && <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />}
              <span className="truncate max-w-[130px] sm:max-w-none">
                {currentView === "leads" && "Leads Workspace"}
                {currentView === "dashboard" && "Dashboard & Analytics"}
                {currentView === "pipeline" && "Pipeline & Kanban"}
                {currentView === "campaigns" && "Campaigns & Marketing Outreach"}
                {currentView === "dispositions" && "Call Dispositions & Outcomes"}
                {currentView === "fields" && "Dynamic Schema & Fields Studio"}
                {currentView === "tasks" && "Scheduled Tasks & Callbacks"}
                {currentView === "team" && "Counselors & Team Directory"}
                {currentView === "import" && "Batch CSV Ingestion & Field Mapping Studio"}
                {currentView === "activity" && "Compliance & Activity Audit Trail"}
                {currentView === "policies" && "Governance & CRM Policies"}
              </span>
            </h1>

            {/* Quick Command Launcher Button */}
            <button
              onClick={() => setIsCommandCenterOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/40 hover:bg-muted text-xs text-muted-foreground transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search or jump to...</span>
              <kbd className="ml-2 font-mono text-[10px] bg-background border px-1.5 py-0.5 rounded shadow-2xs">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            {/* Notification Bell Dropdown */}
            <NotificationBell
              currentUser={currentUser}
              onNavigateToTasks={() => setCurrentView("tasks")}
            />

            {/* Staff Identity & Role Switcher */}
            {currentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-9 text-xs gap-2 font-medium cursor-pointer border-border/80 bg-card hover:bg-muted/50 rounded-xl px-2.5 shadow-2xs"
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xs shrink-0"
                    style={{ backgroundColor: currentUser.avatar_color || "#3b82f6" }}
                  >
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-foreground truncate max-w-[120px]">
                    {currentUser.name}
                  </span>
                  <Badge variant="outline" className="text-[10px] py-0.5 px-1.5 border-primary/30 text-primary capitalize font-medium rounded-md">
                    {currentUser.role.replace("_", " ")}
                  </Badge>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-1.5 text-xs rounded-xl shadow-xl">
                  <div className="flex items-center gap-2.5 p-2 bg-muted/40 rounded-lg mb-1 border border-border/60">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs"
                      style={{ backgroundColor: currentUser.avatar_color || "#3b82f6" }}
                    >
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-foreground truncate text-xs">{currentUser.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{currentUser.email}</div>
                    </div>
                  </div>

                  {/* Mobile Perspective Toggle in User Dropdown */}
                  {permissions?.canViewAllLeads && (
                    <div className="md:hidden px-1 py-1.5 border-b border-border/60 mb-1">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                        Workspace Perspective
                      </div>
                      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/60">
                        <button
                          onClick={() => setRoleMode("admin")}
                          className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            roleMode === "admin"
                              ? "bg-background text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          All Leads
                        </button>
                        <button
                          onClick={() => setRoleMode("counselor")}
                          className={`flex-1 py-1 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                            roleMode === "counselor"
                              ? "bg-background text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Counselor Desk
                        </button>
                      </div>
                    </div>
                  )}

                  <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                    Quick Role Switcher (Test)
                  </DropdownMenuLabel>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {users.map((u) => (
                      <DropdownMenuItem
                        key={u.id}
                        onClick={() => handleSwitchUser(u)}
                        className={`gap-2 cursor-pointer text-xs rounded-lg px-2 py-1.5 ${
                          currentUser.id === u.id ? "bg-primary/10 font-semibold text-primary" : ""
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: u.avatar_color }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate flex-1 font-medium">{u.name}</span>
                        <span className="text-[10px] capitalize text-muted-foreground font-mono">
                          {u.role.replace("_", " ")}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                  <DropdownMenuSeparator className="my-1" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="gap-2 cursor-pointer text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20 rounded-lg py-1.5 px-2"
                  >
                    <LogOut className="w-4 h-4 text-rose-600" />
                    <span className="font-semibold">Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Perspective Selector (Admins & Team Leads Only - Desktop) */}
            {permissions?.canViewAllLeads ? (
              <div className="hidden md:flex items-center p-0.5 rounded-xl border border-border/80 bg-muted/40 text-xs shrink-0">
                <button
                  onClick={() => setRoleMode("admin")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    roleMode === "admin"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Leads
                </button>
                <button
                  onClick={() => setRoleMode("counselor")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    roleMode === "counselor"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Counselor View
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-primary/5 border-primary/20 text-xs shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-primary">Private Desk</span>
              </div>
            )}

            {/* Active Counselor Switcher (Visible in Counselor Mode for Supervisory Roles - Desktop) */}
            {roleMode === "counselor" && permissions?.canViewAllLeads && (
              <div className="hidden lg:block shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "h-9 text-xs gap-2 font-medium cursor-pointer border-primary/30 bg-primary/5 rounded-xl px-2.5 shadow-2xs"
                    )}
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-2xs shrink-0"
                      style={{
                        backgroundColor:
                          users.find((u) => u.id === activeCounselorId)?.avatar_color || "#3b82f6",
                      }}
                    >
                      {(users.find((u) => u.id === activeCounselorId)?.name || "C").charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-foreground truncate max-w-[110px]">
                      {users.find((u) => u.id === activeCounselorId)?.name || "Select Counselor"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60 p-1.5 text-xs rounded-xl shadow-xl">
                    <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">
                      Switch Active Counselor
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="my-1" />
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {users.map((u) => (
                        <DropdownMenuItem
                          key={u.id}
                          onClick={() => setActiveCounselorId(u.id)}
                          className={`gap-2 cursor-pointer text-xs rounded-lg px-2 py-1.5 ${
                            activeCounselorId === u.id ? "bg-primary/10 font-semibold text-primary" : ""
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                            style={{ backgroundColor: u.avatar_color }}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate flex-1 font-medium">{u.name}</span>
                          <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                            {u.assigned_count || 0} leads
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}


            {/* Dark / Light Theme Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg bg-card"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
            </Button>
          </div>
        </header>

        {/* View Routing Body with Slide-Over Filter Drawer */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Slide-over Filter Sheet for Leads Workspace */}
          {currentView === "leads" && (
            <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
              <SheetContent side="right" className="p-0 sm:max-w-md w-full border-l border-border/80 shadow-2xl flex flex-col">
                <SheetTitle className="sr-only">Filter Leads</SheetTitle>
                <SheetDescription className="sr-only">Configure facets and lead filters</SheetDescription>
                <FilterSidebar
                  collapsed={false}
                  onToggleCollapse={() => setFilterDrawerOpen(false)}
                  facets={facets}
                  selectedFacets={selectedFacets}
                  onFacetToggle={handleFacetToggle}
                  onClearAllFilters={handleClearAllFilters}
                  schemaMeta={schemaMeta}
                  totalFilteredCount={totalFilteredCount}
                  totalCount={totalCount}
                  users={users}
                  isRestrictedCounselor={isRestrictedCounselor}
                  isMobileDrawer={true}
                  onCloseMobile={() => setFilterDrawerOpen(false)}
                />
              </SheetContent>
            </Sheet>
          )}

          <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-24 md:pb-6 min-w-0">
          {/* VIEW 1: LEADS WORKSPACE */}
          {currentView === "leads" && (
            <div className="space-y-3.5 max-w-[1600px] mx-auto">
              {/* Ultra-Clean Compact KPI Bar */}
              <CompactKpiBar
                summary={summary}
                globalSummary={globalSummary}
                totalCount={totalCount}
                users={users}
                isRestrictedCounselor={isRestrictedCounselor}
                onFilterStatus={(st) => setSelectedFacets((prev) => ({ ...prev, status: [st] }))}
                onFilterUnassigned={() => setSelectedFacets((prev) => ({ ...prev, assigned_to: ["unassigned"] }))}
                onManageTeam={() => setIsTeamModalOpen(true)}
              />

              {/* Single Consolidated Command Bar */}
              <UnifiedCommandBar
                activeQueue={activeQueue}
                onSelectQueue={handleSelectQueue}
                unassignedCount={globalSummary.unassignedCount || summary.unassignedCount}
                callbacksCount={globalSummary.statusBreakdown["Follow-up"] || summary.statusBreakdown["Follow-up"] || 0}
                myLeadsCount={globalSummary.totalLeads || summary.totalLeads}
                roleMode={isRestrictedCounselor ? "counselor" : roleMode}
                search={search}
                onSearchChange={setSearch}
                viewMode={leadsViewMode}
                onToggleViewMode={setLeadsViewMode}
                filterDrawerOpen={filterDrawerOpen}
                onToggleFilterDrawer={() => setFilterDrawerOpen((prev) => !prev)}
                selectedFacets={selectedFacets}
                onFacetToggle={handleFacetToggle}
                onClearAllFilters={handleClearAllFilters}
                facets={facets}
                density={density}
                onToggleDensity={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}
                visibleColumns={visibleColumns}
                onToggleColumnVisibility={handleToggleColumnVisibility}
                schemaMeta={schemaMeta}
                savedViews={savedViews}
                onApplySavedView={handleApplySavedView}
                onSaveCurrentView={handleSaveCurrentView}
                onDeleteSavedView={handleDeleteSavedView}
                onClaimLeads={handleClaimLeads}
                claimingLeads={claimingLeads}
                onAutoDistribute={() => handleAutoDistribute(250)}
                isAutoDistributing={isAutoDistributing}
                onOpenImport={() => setCurrentView("import")}
                onOpenDuplicates={() => setIsDuplicatesModalOpen(true)}
                onGenerateTestData={permissions?.canManageSchema ? () => handleGenerateSampleLeads(500) : undefined}
                onOpenShortcuts={() => setIsShortcutsOpen(true)}
                canManageTeam={permissions?.canManageTeam}
              />

              {/* Dual View Rendering: Speed Dialer Desk vs Leads Table */}
              {leadsViewMode === "dialer" ? (
                <SpeedDialerWorkspace
                  leads={leads}
                  activeLead={activeLeadIndex !== null && leads[activeLeadIndex] ? leads[activeLeadIndex] : (leads[0] || null)}
                  onSelectLead={(lead) => {
                    const idx = leads.findIndex((l) => l.id === lead.id);
                    if (idx !== -1) setActiveLeadIndex(idx);
                  }}
                  dispositions={dispositions}
                  users={users}
                  schemaMeta={schemaMeta}
                  onQuickDispositionChange={handleQuickDispositionChange}
                  onOpenWhatsApp={(lead) => setWhatsAppTargetLead(lead)}
                  onNextLead={() => {
                    setActiveLeadIndex((prev) => {
                      const curr = prev === null ? 0 : prev;
                      return curr < leads.length - 1 ? curr + 1 : curr;
                    });
                  }}
                  onPrevLead={() => {
                    setActiveLeadIndex((prev) => {
                      const curr = prev === null ? 0 : prev;
                      return curr > 0 ? curr - 1 : 0;
                    });
                  }}
                  hasNextLead={activeLeadIndex === null ? leads.length > 1 : activeLeadIndex < leads.length - 1}
                  hasPrevLead={activeLeadIndex !== null && activeLeadIndex > 0}
                  onLeadUpdated={() => {
                    fetchLeads();
                  }}
                />
              ) : (
                <>
                  <LeadsTable
                    leads={leads}
                    schemaMeta={schemaMeta}
                    visibleColumns={visibleColumns}
                    selectedLeadIds={selectedLeadIds}
                    onToggleLeadSelection={handleToggleLeadSelection}
                    onToggleSelectAllPage={handleToggleSelectAllPage}
                    isAllPageSelected={isAllPageSelected}
                    totalFilteredCount={totalFilteredCount}
                    isAllFilteredSelected={isAllFilteredSelected}
                    onSelectAllFiltered={handleSelectAllFiltered}
                    onClearSelection={handleClearSelection}
                    onViewLeadDetails={(lead) => setSelectedLeadForDetail(lead)}
                    onQuickAssignLead={(lead) => {
                      setSelectedLeadIds([lead.id]);
                      setIsAssignModalOpen(true);
                    }}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSortChange={(col) => {
                      if (sortBy === col) {
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                      } else {
                        setSortBy(col);
                        setSortOrder("desc");
                      }
                    }}
                    users={users}
                    loading={loading}
                    dispositions={dispositions}
                    onQuickDispositionChange={handleQuickDispositionChange}
                    density={density}
                    activeLeadId={activeLeadIndex !== null && leads[activeLeadIndex] ? leads[activeLeadIndex].id : null}
                    onInlineUpdate={handleInlineFieldUpdate}
                    viewMode={leadsViewMode === "grid" ? "grid" : "table"}
                    onViewModeChange={(m) => setLeadsViewMode(m === "cards" || m === "grid" ? "grid" : "table")}
                  />

                  <PaginationBar
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalFilteredCount}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(newSize) => {
                      setPageSize(newSize);
                      setPage(1);
                    }}
                  />
                </>
              )}
            </div>
          )}

          {/* VIEW 2: DASHBOARD & INSIGHTS */}
          {currentView === "dashboard" && (
            <div className="max-w-7xl mx-auto">
              <AnalyticsDashboard
                totalCount={totalCount}
                unassignedCount={summary.unassignedCount}
                assignedCount={summary.assignedCount}
                users={users}
                facets={facets}
                campaigns={campaigns}
                dispositions={dispositions}
                statusBreakdown={summary.statusBreakdown}
                onNavigateToFilter={(key, val) => {
                  setSelectedFacets({ [key]: [val] });
                  setCurrentView("leads");
                }}
                currentUser={currentUser}
              />
            </div>
          )}

          {/* VIEW 3: PIPELINE & KANBAN */}
          {currentView === "pipeline" && (
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">
                  Interactive stage board. Move leads forward as counseling conversations progress.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentView("leads")}
                  className="h-7 text-xs"
                >
                  Switch to Table View
                </Button>
              </div>

              <PipelineKanbanView
                leads={leads}
                onViewLeadDetails={(lead) => setSelectedLeadForDetail(lead)}
                onUpdateLeadStatus={handleUpdateLeadStatus}
              />
            </div>
          )}

          {/* VIEW 4A: DEDICATED CAMPAIGNS & SOURCES WORKSPACE */}
          {currentView === "campaigns" && (
            <div className="max-w-7xl mx-auto">
              <CampaignsWorkspace
                onFilterByCampaign={(campaignId, campaignName) => {
                  setSelectedFacets({ campaign_id: [campaignId] });
                  setCurrentView("leads");
                }}
                totalLeadsCount={totalCount}
              />
            </div>
          )}

          {/* VIEW 4B: DEDICATED CALL DISPOSITIONS & OUTCOMES WORKSPACE */}
          {currentView === "dispositions" && (
            <div className="max-w-7xl mx-auto">
              <DispositionsWorkspace
                onFilterByDisposition={(dispName) => {
                  setSelectedFacets({ disposition: [dispName] });
                  setCurrentView("leads");
                }}
              />
            </div>
          )}

          {/* VIEW 4C: DEDICATED DYNAMIC SCHEMA & FIELDS STUDIO */}
          {currentView === "fields" && (
            <div className="max-w-7xl mx-auto">
              <SchemaStudioWorkspace
                schemaMeta={schemaMeta}
                onSchemaChange={() => {
                  loadMetaAndUsers();
                  fetchLeads();
                }}
                totalLeadsCount={totalCount}
              />
            </div>
          )}

          {/* VIEW 4D: ARCHITECTURE LINKAGE STUDIO (FALLBACK/CROSS-MATRIX) */}
          {currentView === "studio" && (
            <div className="max-w-7xl mx-auto">
              <CampaignsSchemaStudio
                initialTab={studioTab}
                schemaMeta={schemaMeta}
                onSchemaChange={() => {
                  loadMetaAndUsers();
                  fetchLeads();
                }}
                onFilterByCampaign={(campaignId, campaignName) => {
                  setSelectedFacets({ campaign_id: [campaignId] });
                  setCurrentView("leads");
                }}
                totalLeadsCount={totalCount}
              />
            </div>
          )}

          {/* VIEW 5: DEDICATED TASKS & SCHEDULED CALLBACKS WORKSPACE */}
          {currentView === "tasks" && (
            <div className="max-w-7xl mx-auto">
              <TasksWorkspace
                roleMode={roleMode}
                activeCounselorId={activeCounselorId}
                users={users}
                onSelectLeadById={async (leadId) => {
                  const found = leads.find((l) => l.id === leadId);
                  if (found) {
                    setSelectedLeadForDetail(found);
                  } else {
                    try {
                      const res = await fetch(`/api/leads?search=${leadId}&limit=1`);
                      const data = await res.json();
                      if (data.leads && data.leads.length > 0) {
                        setSelectedLeadForDetail(data.leads[0]);
                      }
                    } catch (e) {
                      console.error("Failed to load lead by id:", e);
                    }
                  }
                }}
                onOpenWhatsApp={(lead) => setWhatsAppTargetLead(lead)}
              />
            </div>
          )}

          {/* VIEW 6: DEDICATED COUNSELORS & TEAM WORKLOAD WORKSPACE */}
          {currentView === "team" && (
            <div className="max-w-7xl mx-auto">
              <TeamWorkspace
                users={users}
                totalCount={totalCount}
                unassignedCount={summary.unassignedCount}
                assignedCount={summary.assignedCount}
                currentUser={currentUser}
                canManageTeam={permissions?.canManageTeam}
                onUserAdded={() => {
                  loadMetaAndUsers();
                  showToast("Counselor added to roster", "success");
                }}
                onUserUpdated={() => {
                  loadMetaAndUsers();
                }}
                onFilterByCounselor={(counselorId) => {
                  setSelectedFacets({ assigned_to: [counselorId] });
                  setCurrentView("leads");
                }}
                onAutoDistribute={() => handleAutoDistribute(250)}
                isAutoDistributing={isAutoDistributing}
              />
            </div>
          )}

          {/* VIEW 7: DEDICATED BATCH CSV INGESTION & FIELD MAPPING STUDIO */}
          {currentView === "import" && (
            <div className="max-w-7xl mx-auto">
              <ImportWorkspace
                campaigns={campaigns}
                schemaMeta={schemaMeta}
                onImportComplete={(count, newHeaders) => {
                  showToast(
                    `Imported ${count.toLocaleString()} leads! ${
                      newHeaders.length > 0 ? `Registered new fields: ${newHeaders.join(", ")}` : ""
                    }`,
                    "success"
                  );
                  fetchLeads();
                  loadMetaAndUsers();
                }}
                onNavigateToLeads={() => setCurrentView("leads")}
              />
            </div>
          )}

          {/* VIEW 8: DEDICATED AUDIT & ACTIVITY LOGS WORKSPACE */}
          {currentView === "activity" && (
            <div className="max-w-7xl mx-auto">
              <ActivityWorkspace />
            </div>
          )}

          {/* VIEW 9: DEDICATED GOVERNANCE & CRM POLICIES WORKSPACE */}
          {currentView === "policies" && (
            <div className="max-w-7xl mx-auto">
              <PoliciesWorkspace />
            </div>
          )}
        </main>
      </div>
    </div>

      {/* Floating Sticky Bulk Actions Bar */}
      <BulkActionBar
        selectedCount={selectedLeadIds.length}
        totalFilteredCount={totalFilteredCount}
        isAllFilteredSelected={isAllFilteredSelected}
        onSelectAllFiltered={handleSelectAllFiltered}
        onClearSelection={handleClearSelection}
        onOpenAssignModal={permissions?.canAssignLeads ? () => setIsAssignModalOpen(true) : undefined}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkDelete={permissions?.canDeleteLeads ? handleBulkDelete : undefined}
        onExportCsv={permissions?.canExportLeads ? handleExportCsv : undefined}
        campaigns={campaigns}
        onBulkCampaignChange={handleBulkCampaignChange}
        onOpenBulkCampaignModal={() => setIsBulkCampaignModalOpen(true)}
        onOpenBulkTagsModal={() => setIsBulkTagsModalOpen(true)}
      />

      {/* Bulk Assignment Modal */}
      <BulkAssignModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        users={users}
        selectedLeadIds={selectedLeadIds}
        totalFilteredCount={totalFilteredCount}
        isAllFilteredSelected={isAllFilteredSelected}
        currentFilterParams={getFilterParamsObject()}
        currentUser={currentUser}
        onAssignComplete={handleAssignComplete}
      />

      {/* Bulk Tags Modal */}
      <BulkTagsModal
        isOpen={isBulkTagsModalOpen}
        onClose={() => setIsBulkTagsModalOpen(false)}
        selectedLeadIds={selectedLeadIds}
        totalFilteredCount={totalFilteredCount}
        isAllFilteredSelected={isAllFilteredSelected}
        currentFilterParams={getFilterParamsObject()}
        onTagsApplied={handleBulkTagsApplied}
      />

      {/* Bulk Campaign Re-attribution Modal */}
      <BulkCampaignModal
        isOpen={isBulkCampaignModalOpen}
        onClose={() => setIsBulkCampaignModalOpen(false)}
        campaigns={campaigns}
        selectedLeadIds={selectedLeadIds}
        totalFilteredCount={totalFilteredCount}
        isAllFilteredSelected={isAllFilteredSelected}
        currentFilterParams={getFilterParamsObject()}
        onCampaignApplied={(msg) => {
          showToast(msg, "success");
          handleClearSelection();
          fetchLeads();
          loadMetaAndUsers();
        }}
      />

      {/* Enhanced Multi-Tab Lead Drawer */}
      <EnhancedLeadDrawer
        key={selectedLeadForDetail?.id ?? "closed"}
        lead={selectedLeadForDetail}
        isOpen={Boolean(selectedLeadForDetail)}
        onClose={() => setSelectedLeadForDetail(null)}
        users={users}
        schemaMeta={schemaMeta}
        campaigns={campaigns}
        currentUser={currentUser}
        onUpdateLeadStatus={handleUpdateLeadStatus}
        onAssignLead={handleAssignSingleLead}
        onLeadUpdated={(updatedLead) => {
          setSelectedLeadForDetail(updatedLead);
          setLeads((prev) =>
            prev.map((l) => (l.id === updatedLead.id ? updatedLead : l))
          );
          fetchLeads();
        }}
        onNextLead={handleNextLead}
        onPrevLead={handlePrevLead}
        hasPrevLead={hasPrevLead}
        hasNextLead={hasNextLead}
        leadIndex={currentLeadIndex >= 0 ? currentLeadIndex : undefined}
        totalLeadsCount={leads.length}
      />

      {/* Scheduled Tasks & Callbacks Modal */}
      <TasksModal
        isOpen={isTasksModalOpen}
        onClose={() => setIsTasksModalOpen(false)}
        roleMode={roleMode}
        activeCounselorId={activeCounselorId}
        onSelectLeadById={async (leadId) => {
          const found = leads.find((l) => l.id === leadId);
          if (found) {
            setSelectedLeadForDetail(found);
          } else {
            try {
              const res = await fetch(`/api/leads?search=${leadId}&limit=1`);
              const data = await res.json();
              if (data.leads && data.leads.length > 0) {
                setSelectedLeadForDetail(data.leads[0]);
              }
            } catch (e) {
              console.error("Failed to load lead by id:", e);
            }
          }
          setIsTasksModalOpen(false);
        }}
      />

      {/* CSV Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={(count, newHeaders) => {
          showToast(
            `Imported ${count.toLocaleString()} leads! ${
              newHeaders.length > 0
                ? `Discovered new headers: ${newHeaders.join(", ")}`
                : ""
            }`,
            "success"
          );
          fetchLeads();
          loadMetaAndUsers();
        }}
      />

      {/* Team Modal */}
      <TeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        users={users}
        totalAssignedLeads={summary.assignedCount}
        currentUser={currentUser}
        canManageTeam={permissions?.canManageTeam}
        onUserAdded={() => {
          loadMetaAndUsers();
          showToast("Counselor added to team successfully", "success");
        }}
        onUserUpdated={() => {
          loadMetaAndUsers();
        }}
      />

      {/* Activity Logs Modal */}
      <ActivityLogsModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
      />

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Duplicates Radar & Merge Modal */}
      <DuplicatesModal
        isOpen={isDuplicatesModalOpen}
        onClose={() => setIsDuplicatesModalOpen(false)}
        onMergeComplete={(mergedCount) => {
          showToast(`Successfully merged ${mergedCount} duplicate record${mergedCount === 1 ? "" : "s"}`, "success");
          fetchLeads();
          loadMetaAndUsers();
        }}
      />

      {/* Shared WhatsApp Template Messenger Modal */}
      <WhatsAppModal
        isOpen={whatsAppTargetLead !== null}
        onClose={() => setWhatsAppTargetLead(null)}
        lead={whatsAppTargetLead}
        currentUser={users.find((u) => u.id === activeCounselorId) || null}
      />

      {/* Mobile Navigation Drawer Sheet */}
      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetContent side="left" className="p-0 w-72 sm:w-80 border-r border-border/80" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Main CRM navigation and workspace switcher</SheetDescription>
          <AppSidebar
            currentView={currentView}
            onSelectView={(v) => {
              if (v === "fields") {
                setStudioTab("fields");
                setCurrentView("fields");
              } else if (v === "campaigns") {
                setStudioTab("campaigns");
                setCurrentView("campaigns");
              } else if (v === "dispositions") {
                setStudioTab("dispositions");
                setCurrentView("dispositions");
              } else {
                setCurrentView(v);
              }
              setIsMobileNavOpen(false);
            }}
            collapsed={false}
            onToggleCollapse={() => {}}
            totalLeadsCount={totalCount}
            unassignedCount={globalSummary.unassignedCount || summary.unassignedCount}
            counselorsCount={users.length}
            currentUser={currentUser}
            allowedViews={permissions?.allowedViews}
            onLogout={handleLogout}
            isMobileDrawer={true}
            onCloseMobileDrawer={() => setIsMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>


      {/* Ergonomic Mobile Bottom Navigation Bar (Visible only on mobile screens) */}
      <MobileBottomNav
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        onOpenSearch={() => setIsCommandCenterOpen(true)}
        onOpenMobileMenu={() => setIsMobileNavOpen(true)}
        pendingTasksCount={summary.statusBreakdown["Follow-up"] || 0}
        myLeadsCount={summary.totalLeads}
      />
    </div>
  );
}
