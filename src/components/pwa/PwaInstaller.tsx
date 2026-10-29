"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Download, X, Smartphone, WifiOff, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showOnlineToast, setShowOnlineToast] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // 1. Service Worker Registration
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check standalone mode (PWA running as native app)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Check if dismissed previously within 3 days
    try {
      const dismissedUntil = localStorage.getItem("dreamdesk_pwa_dismissed");
      if (dismissedUntil && parseInt(dismissedUntil, 10) > Date.now()) {
        setIsDismissed(true);
      }
    } catch {}

    // Register Service Worker in production
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // New content is available, could show update toast
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn("ServiceWorker registration failed:", err);
        });
    }

    // 2. Listen for BeforeInstallPrompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 3. Listen for successful App Install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
      try {
        localStorage.removeItem("dreamdesk_pwa_dismissed");
      } catch {}
    };

    // 4. Custom trigger listener so other buttons can trigger install
    const handleCustomTrigger = () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === "accepted") {
            setDeferredPrompt(null);
          }
        });
      } else {
        // Fallback instructions for Chrome Android
        alert(
          "To install DreamDesk CRM on Android:\n1. Tap the three dots (⋮) in Chrome\n2. Select 'Install app' or 'Add to Home screen'"
        );
      }
    };

    // 5. Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineToast(true);
      setTimeout(() => setShowOnlineToast(false), 3500);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("trigger-pwa-install", handleCustomTrigger);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("trigger-pwa-install", handleCustomTrigger);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [deferredPrompt]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) {
      alert(
        "To install DreamDesk CRM on Android:\n1. Tap the Chrome menu (⋮)\n2. Tap 'Install app' or 'Add to Home screen'"
      );
      return;
    }

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      // Dismiss for 3 days
      localStorage.setItem("dreamdesk_pwa_dismissed", String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    } catch {}
  }, []);

  return (
    <>
      {/* Offline Ribbon */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-600 text-white px-3 py-1.5 text-xs font-medium flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-3.5 h-3.5 shrink-0 animate-pulse" />
          <span>You are offline. Leads and dispositions will sync once connection returns.</span>
        </div>
      )}

      {/* Back Online Reconnect Toast */}
      {showOnlineToast && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Online · Realtime Sync Connected</span>
        </div>
      )}

      {/* Standalone mode check: if already installed and running standalone, do not show prompt */}
      {!isStandalone && !isDismissed && (deferredPrompt || true) && (
        <div className="fixed bottom-16 md:bottom-4 left-3 right-3 md:left-auto md:right-4 z-40 max-w-sm bg-card border border-blue-500/30 shadow-xl rounded-xl p-3 flex items-center gap-3 backdrop-blur-none animate-in fade-in slide-in-from-bottom-2">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-inner">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
              <span>Install DreamDesk App</span>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 font-mono px-1 py-0.2 rounded">Lightweight</span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
              High speed, zero browser tab closing, instant sync
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleInstallClick}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-medium px-2.5 py-1.5 rounded-md flex items-center gap-1 transition-transform"
              title="Install App"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
