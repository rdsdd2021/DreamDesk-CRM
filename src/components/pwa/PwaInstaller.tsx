"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, CheckCircle2 } from "lucide-react";

export function PwaInstaller() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOnlineToast, setShowOnlineToast] = useState(false);

  // Register Service Worker & Network status listeners
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => {
          console.warn("ServiceWorker registration failed:", err);
        });
    }

    const handleOnline = () => {
      setIsOnline(true);
      setShowOnlineToast(true);
      setTimeout(() => setShowOnlineToast(false), 3500);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
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
    </>
  );
}
