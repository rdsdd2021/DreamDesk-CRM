"use client";

import React from "react";
import {
  GraduationCap,
  Clock,
  Kanban,
  Search,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  currentView: string;
  onSelectView: (view: string) => void;
  onOpenSearch: () => void;
  onOpenMobileMenu: () => void;
  pendingTasksCount?: number;
  myLeadsCount?: number;
}

export function MobileBottomNav({
  currentView,
  onSelectView,
  onOpenSearch,
  onOpenMobileMenu,
  pendingTasksCount = 0,
  myLeadsCount,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: "leads",
      label: "Leads",
      icon: GraduationCap,
      badge: myLeadsCount !== undefined && myLeadsCount > 0 ? (myLeadsCount > 999 ? "999+" : myLeadsCount) : null,
      badgeColor: "bg-primary text-primary-foreground",
    },
    {
      id: "tasks",
      label: "Callbacks",
      icon: Clock,
      badge: pendingTasksCount > 0 ? (pendingTasksCount > 99 ? "99+" : pendingTasksCount) : null,
      badgeColor: "bg-amber-500 text-white",
    },
    {
      id: "pipeline",
      label: "Pipeline",
      icon: Kanban,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/80 flex md:hidden items-center justify-around h-16 px-1 safe-area-bottom shadow-lg select-none"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectView(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-1.5 px-1 relative transition-colors duration-150 active:scale-95",
              isActive
                ? "text-primary font-bold"
                : "text-muted-foreground hover:text-foreground font-medium"
            )}
          >
            <div className="relative">
              <Icon className={cn("w-5 h-5", isActive ? "stroke-[2.5]" : "stroke-[1.8]")} />
              {tab.badge && (
                <span
                  className={cn(
                    "absolute -top-1.5 -right-3 text-[9px] font-mono font-bold px-1 py-0 rounded-full min-w-4 text-center leading-tight shadow-xs",
                    tab.badgeColor
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-1">{tab.label}</span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
            )}
          </button>
        );
      })}

      {/* Global Command Center / Search Trigger */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 text-muted-foreground hover:text-foreground active:scale-95 transition-colors"
      >
        <Search className="w-5 h-5 stroke-[1.8]" />
        <span className="text-[10px] tracking-tight mt-1 font-medium">Search</span>
      </button>

      {/* Full Menu Drawer Trigger */}
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className={cn(
          "flex-1 flex flex-col items-center justify-center py-1.5 px-1 transition-colors active:scale-95",
          ["dashboard", "campaigns", "dispositions", "fields", "team", "import", "activity"].includes(currentView)
            ? "text-primary font-bold"
            : "text-muted-foreground hover:text-foreground font-medium"
        )}
      >
        <Menu className="w-5 h-5 stroke-[1.8]" />
        <span className="text-[10px] tracking-tight mt-1 font-medium">More</span>
        {["dashboard", "campaigns", "dispositions", "fields", "team", "import", "activity"].includes(currentView) && (
          <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />
        )}
      </button>
    </nav>
  );
}
