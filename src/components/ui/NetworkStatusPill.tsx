"use client";

import React, { useState, useEffect } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";

export function NetworkStatusPill() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showRestored, setShowRestored] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) {
    return null;
  }

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-3 duration-200">
      {!isOnline ? (
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500 text-white font-semibold text-xs shadow-lg border border-amber-600/30">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Network connection lost. Retrying...</span>
          <RefreshCw className="w-3 h-3 animate-spin ml-0.5 opacity-80" />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-600 text-white font-semibold text-xs shadow-lg border border-emerald-700/30 animate-in fade-in">
          <Wifi className="w-3.5 h-3.5" />
          <span>Connection restored</span>
        </div>
      )}
    </div>
  );
}
