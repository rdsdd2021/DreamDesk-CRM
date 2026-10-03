"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Command, Keyboard } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_SECTIONS = [
  {
    title: "Navigation & Search",
    shortcuts: [
      { key: "/", desc: "Focus search bar" },
      { key: "↓ / J", desc: "Select next lead row" },
      { key: "↑ / K", desc: "Select previous lead row" },
      { key: "Ctrl + K / Cmd + K", desc: "Open Command Palette" },
      { key: "Esc", desc: "Close drawer / clear focus" },
    ],
  },
  {
    title: "Lead Actions (On Highlighted Row)",
    shortcuts: [
      { key: "Enter / O", desc: "Open lead details & call drawer" },
      { key: "[ / ]", desc: "Next / Prev lead in drawer" },
      { key: "X / Space", desc: "Toggle selection checkbox" },
      { key: "C", desc: "One-click phone dial" },
      { key: "W", desc: "Open WhatsApp conversation" },
      { key: "D", desc: "Open Quick Disposition selector" },
    ],
  },
  {
    title: "Global Views & Toggles",
    shortcuts: [
      { key: "F", desc: "Toggle Filter Panel" },
      { key: "T", desc: "Open Scheduled Callbacks & Tasks" },
      { key: "1", desc: "Switch to All Leads Queue" },
      { key: "2", desc: "Switch to Urgent Callbacks Queue" },
      { key: "3", desc: "Switch to Unassigned Pool" },
      { key: "4", desc: "Switch to High Intent Leads" },
      { key: "?", desc: "Toggle this Keyboard Shortcuts cheat sheet" },
    ],
  },
];

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3 bg-muted/40 border-b">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Keyboard className="w-4 h-4" />
            <span>Power User Shortcuts</span>
          </div>
          <DialogTitle className="text-base font-bold">
            Keyboard Shortcuts Cheat Sheet
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Fly through 500+ daily student leads without ever touching your mouse.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_SECTIONS.map((sec) => (
            <div key={sec.title} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {sec.title}
              </h4>
              <div className="space-y-1.5">
                {sec.shortcuts.map((sc) => (
                  <div
                    key={sc.desc}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-foreground">{sc.desc}</span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[11px] font-semibold bg-muted/60 px-1.5 py-0.5 border-border/80 shadow-2xs"
                    >
                      {sc.key}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
