"use client";

import React, { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Lead } from "@/types/crm";
import {
  Search,
  LayoutDashboard,
  Users,
  SlidersHorizontal,
  Upload,
  History,
  Kanban,
  Target,
  Sparkles,
  Phone,
  GraduationCap,
  MessageSquare,
} from "lucide-react";

interface CommandCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectView: (view: string) => void;
  onSelectLead: (lead: Lead) => void;
  onOpenImport: () => void;
  onOpenGenerate?: () => void;
  allowedViews?: string[];
  canImportLeads?: boolean;
}

export function CommandCenter({
  open,
  onOpenChange,
  onSelectView,
  onSelectLead,
  onOpenImport,
  onOpenGenerate,
  allowedViews = ["leads"],
  canImportLeads = false,
}: CommandCenterProps) {
  const canView = (view: string) => allowedViews.includes(view);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/leads?search=${encodeURIComponent(query.trim())}&limit=5&include_facets=0`
        );
        const data = await res.json();
        setSearchResults(data.leads || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [query]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Type a student name, school, phone, or command..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[360px]">
        <CommandEmpty>No results found for &quot;{query}&quot;.</CommandEmpty>

        {/* Lead Search Results */}
        {searchResults.length > 0 && (
          <CommandGroup heading="Matching Student Leads">
            {searchResults.map((lead) => (
              <CommandItem
                key={lead.id}
                onSelect={() => {
                  onSelectLead(lead);
                  onOpenChange(false);
                }}
                className="flex items-center justify-between text-xs cursor-pointer py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
                    {(lead.name || "S").charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold">{lead.name || "Unnamed"}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <span className="font-mono">{lead.lead_code}</span>
                      {lead.phone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {lead.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-medium">
                  {lead.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Navigation Views (Strictly filtered by role allowedViews) */}
        {allowedViews.length > 0 && (
          <CommandGroup heading="Navigation">
            {canView("leads") && (
              <CommandItem
                onSelect={() => {
                  onSelectView("leads");
                  onOpenChange(false);
                }}
                className="text-xs cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 mr-2 text-primary" />
                <span>Leads Workspace</span>
              </CommandItem>
            )}

            {canView("tasks") && (
              <CommandItem
                onSelect={() => {
                  onSelectView("tasks");
                  onOpenChange(false);
                }}
                className="text-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                <span>Tasks & Callbacks</span>
              </CommandItem>
            )}

            {canView("dashboard") && (
              <CommandItem
                onSelect={() => {
                  onSelectView("dashboard");
                  onOpenChange(false);
                }}
                className="text-xs cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 mr-2 text-blue-500" />
                <span>Dashboard & Analytics</span>
              </CommandItem>
            )}

            {canView("campaigns") && (
              <CommandItem
                onSelect={() => {
                  onSelectView("campaigns");
                  onOpenChange(false);
                }}
                className="text-xs cursor-pointer"
              >
                <Target className="w-4 h-4 mr-2 text-amber-500" />
                <span>Campaigns & Sources</span>
              </CommandItem>
            )}

            {canView("dispositions") && (
              <CommandItem
                onSelect={() => {
                  onSelectView("dispositions");
                  onOpenChange(false);
                }}
                className="text-xs cursor-pointer"
              >
                <Phone className="w-4 h-4 mr-2 text-rose-500" />
                <span>Call Outcomes & Dispositions</span>
              </CommandItem>
            )}

            {canView("whatsapp") && (
              <CommandItem
                onSelect={() => {
                  onSelectView("whatsapp");
                  onOpenChange(false);
                }}
                className="text-xs cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 mr-2 text-emerald-500" />
                <span>WhatsApp Inbox</span>
              </CommandItem>
            )}

            {canView("fields") && (
              <CommandItem
                onSelect={() => {
                  onSelectView("fields");
                  onOpenChange(false);
                }}
                className="text-xs cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2 text-emerald-500" />
                <span>Dynamic Schema & Fields Builder</span>
              </CommandItem>
            )}

            {canView("team") && (
              <CommandItem
                onSelect={() => {
                  onSelectView("team");
                  onOpenChange(false);
                }}
                className="text-xs cursor-pointer"
              >
                <Users className="w-4 h-4 mr-2 text-indigo-500" />
                <span>Counselors & Team Workload</span>
              </CommandItem>
            )}
          </CommandGroup>
        )}

        {(canImportLeads || onOpenGenerate) && (
          <>
            <CommandSeparator />

            {/* Quick Operations */}
            <CommandGroup heading="Quick Operations">
              {canImportLeads && canView("import") && (
                <CommandItem
                  onSelect={() => {
                    onOpenImport();
                    onOpenChange(false);
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2 text-emerald-500" />
                  <span>Import Student Leads from CSV</span>
                </CommandItem>
              )}

              {onOpenGenerate && (
                <CommandItem
                  onSelect={() => {
                    onOpenGenerate();
                    onOpenChange(false);
                  }}
                  className="text-xs cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 mr-2 text-primary" />
                  <span>Generate Synthetic Test Data</span>
                </CommandItem>
              )}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
