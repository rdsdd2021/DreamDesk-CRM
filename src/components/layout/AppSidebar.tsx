"use client";

import React from "react";
import {
  GraduationCap,
  LayoutDashboard,
  Kanban,
  Target,
  Users,
  SlidersHorizontal,
  Upload,
  History,
  ChevronLeft,
  ChevronRight,
  Database,
  ShieldCheck,
  Activity,
  Layers,
  Clock,
  Tag,
  Sparkles,
  LogOut,
  MessageSquare,
  Smartphone,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { User } from "@/types/crm";

interface AppSidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  totalLeadsCount: number;
  unassignedCount: number;
  counselorsCount: number;
  currentUser?: User | null;
  allowedViews?: string[];
  onLogout?: () => void;
  onOpenDiagnostics?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

export function AppSidebar({
  currentView,
  onSelectView,
  collapsed,
  onToggleCollapse,
  totalLeadsCount,
  unassignedCount,
  counselorsCount,
  currentUser,
  allowedViews,
  onLogout,
  onOpenDiagnostics,
  isMobileDrawer = false,
  onCloseMobileDrawer,
}: AppSidebarProps) {
  const isCollapsed = isMobileDrawer ? false : collapsed;

  const handleItemClick = (id: string) => {
    onSelectView(id);
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };
  const navItems = [
    {
      id: "leads",
      label: "Leads Workspace",
      icon: GraduationCap,
      badge: totalLeadsCount > 0 ? totalLeadsCount.toLocaleString() : undefined,
    },
    {
      id: "tasks",
      label: "Scheduled Tasks",
      icon: Clock,
    },
    {
      id: "dashboard",
      label: "Dashboard & Analytics",
      icon: LayoutDashboard,
    },
    {
      id: "pipeline",
      label: "Pipeline & Kanban",
      icon: Kanban,
    },
    {
      id: "campaigns",
      label: "Campaigns & Sources",
      icon: Target,
    },
    {
      id: "dispositions",
      label: "Admissions Playbook",
      icon: Sparkles,
    },
    {
      id: "whatsapp",
      label: "WhatsApp Templates",
      icon: MessageSquare,
    },
    {
      id: "fields",
      label: "Dynamic Schema Studio",
      icon: SlidersHorizontal,
    },
    {
      id: "team",
      label: "Counselors & Team",
      icon: Users,
      badge: counselorsCount > 0 ? String(counselorsCount) : undefined,
    },
    {
      id: "import",
      label: "Batch CSV Import",
      icon: Upload,
    },
    {
      id: "activity",
      label: "Audit & Activity Log",
      icon: History,
    },
    {
      id: "policies",
      label: "Governance & Policies",
      icon: ShieldCheck,
    },
  ];

  return (
    <aside
      className={
        isMobileDrawer
          ? "w-full h-full bg-sidebar flex flex-col justify-between select-none"
          : `hidden md:flex border-r border-border/80 bg-sidebar flex-col justify-between transition-all duration-200 shrink-0 z-20 select-none ${
              isCollapsed ? "w-16" : "w-60"
            }`
      }
    >
      {/* Top Branding */}
      <div>
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between h-14">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shadow-blue-500/25 shrink-0 ring-1 ring-white/20">
                <GraduationCap className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="truncate flex items-center gap-1.5">
                <span className="font-bold text-xs tracking-tight text-foreground truncate">
                  DreamDesk
                </span>
                <span className="text-[9px] font-mono font-bold tracking-widest px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                  CRM
                </span>
                <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-muted/80 text-muted-foreground border border-border/60">
                  v1.1.0
                </span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mx-auto shadow-xs">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          )}

          {!isMobileDrawer ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0 hidden md:flex rounded-md"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
            </Button>
          ) : (
            onCloseMobileDrawer && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCloseMobileDrawer}
                className="h-7 text-xs text-muted-foreground hover:text-foreground rounded-md px-2"
              >
                Close
              </Button>
            )
          )}
        </div>

        {/* Navigation List */}
        <nav className="p-2 space-y-0.5">
          {!isCollapsed && (
            <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Workspace
            </div>
          )}

          {navItems
            .filter((item) => !allowedViews || allowedViews.length === 0 || allowedViews.includes(item.id))
            .map((item) => {
            const isActive = currentView === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 ${isMobileDrawer ? "py-2.5 h-10" : "py-1.5"} rounded-lg text-xs transition-all relative ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold border border-primary/20 shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium"
                } ${isCollapsed ? "justify-center px-0 h-9" : isMobileDrawer ? "h-10" : "h-8"}`}
                title={isCollapsed ? item.label : undefined}
              >
                {isActive && !isCollapsed && (
                  <span className="w-1 h-3.5 rounded-full bg-primary absolute -left-1" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground/80"
                  }`}
                />
                {!isCollapsed && (
                  <>
                    <span className="truncate flex-1 text-left tracking-tight">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-md font-semibold shrink-0 border ${
                          isActive
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/80 text-muted-foreground border-border/60"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Install Android App Quick Action */}
        <div className="px-2 pt-1 border-t border-border/40">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("trigger-pwa-install"));
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-900/60 transition-colors ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
            title="Install DreamDesk Mobile App on Android"
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            {!isCollapsed && <span>Install Android App</span>}
          </button>
        </div>
      </div>

      {/* Bottom User Profile & Performance Widget */}
      <div className="p-3 border-t border-border/60 bg-muted/20 space-y-2">
        {currentUser && (
          !isCollapsed ? (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-card border border-border/70">
              <div className="flex items-center gap-2 overflow-hidden min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-2xs"
                  style={{ backgroundColor: currentUser.avatar_color || "#3b82f6" }}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <div className="truncate flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground capitalize font-medium truncate">
                    {currentUser.role.replace("_", " ")}
                  </div>
                </div>
              </div>

              {onLogout && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onLogout}
                  className="h-6 w-6 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 shrink-0"
                  title="Sign Out"
                >
                  <LogOut className="w-3 h-3" />
                </Button>
              )}
            </div>
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white mx-auto shadow-2xs cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
              style={{ backgroundColor: currentUser.avatar_color || "#3b82f6" }}
              title={`${currentUser.name} (${currentUser.role}) • Click to Sign Out`}
              onClick={onLogout}
            >
              {currentUser.name.charAt(0)}
            </div>
          )
        )}

        {!isCollapsed ? (
          <a
            href="/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/40 transition-colors"
            title="Download Android APK for low-end phones"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-blue-500" />
              <span>Android App</span>
            </span>
            <span className="text-[10px] font-mono font-semibold px-1 py-0.2 bg-blue-500/10 text-blue-500 rounded">
              APK
            </span>
          </a>
        ) : (
          <a
            href="/download"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Download Android App (APK)"
          >
            <Smartphone className="w-3.5 h-3.5 text-blue-500" />
          </a>
        )}

        {!isCollapsed ? (
          <div
            onClick={onOpenDiagnostics}
            className="space-y-1.5 cursor-pointer p-1 -m-1 rounded-xl hover:bg-muted/40 transition-colors"
            title="Click to open Server Health & Error Diagnostics"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hover:text-foreground transition-colors">SQLite Engine Health</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground font-bold">
                64MB RAM
              </span>
            </div>

            <div className="p-2 rounded-lg bg-card border border-border/70 text-[10px] space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Leads In DB</span>
                <span className="font-mono font-bold text-foreground tabular-nums">
                  {totalLeadsCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Unallocated</span>
                <span className="font-mono font-bold text-amber-600 tabular-nums">
                  {unassignedCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={onOpenDiagnostics}
            className="flex flex-col items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-muted/40"
            title="SQLite WAL Online • Click for Diagnostics"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <Database className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
    </aside>
  );
}
