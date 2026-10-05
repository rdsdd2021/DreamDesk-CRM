"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-4 bg-muted/40 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                Keyboard Shortcuts
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Fly through hundreds of student leads quickly with hotkeys.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_SECTIONS.map((sec) => (
            <div key={sec.title} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {sec.title}
              </h4>
              <div className="space-y-1 rounded-xl border border-border/70 p-1.5 bg-muted/10">
                {sec.shortcuts.map((sc) => (
                  <div
                    key={sc.desc}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-foreground font-medium">{sc.desc}</span>
                    <kbd className="font-mono text-[11px] font-bold bg-background border border-border/80 px-2 py-0.5 rounded-md shadow-2xs text-foreground">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t border-border/60 flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Press <kbd className="font-mono bg-background border px-1 py-0.5 rounded text-[10px]">?</kbd> anywhere to reopen
          </span>
          <Button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold h-9 px-5 rounded-lg shadow-2xs bg-primary text-primary-foreground"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
