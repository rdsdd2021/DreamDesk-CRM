"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface SyncEventPayload {
  id: string;
  type: "lead_updated" | "leads_bulk_updated" | "task_updated" | "notification" | "campaign" | "system";
  action: string;
  entityId?: string | number;
  userId?: string;
  timestamp: number;
  data?: any;
}

interface UseRealtimeSyncOptions {
  onLeadChange?: (event: SyncEventPayload) => void;
  onTaskChange?: (event: SyncEventPayload) => void;
  onNotification?: (event: SyncEventPayload) => void;
  onSync?: (event: SyncEventPayload) => void;
  enabled?: boolean;
}

export function useRealtimeSync(options: UseRealtimeSyncOptions = {}) {
  const { onLeadChange, onTaskChange, onNotification, onSync, enabled = true } = options;

  const [status, setStatus] = useState<"connected" | "connecting" | "offline">("connecting");
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [eventCount, setEventCount] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastTimestampRef = useRef<number>(Date.now());
  const reconnectTimeoutRef = useRef<any>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleIncomingEvent = useCallback((event: SyncEventPayload) => {
    lastTimestampRef.current = Math.max(lastTimestampRef.current, event.timestamp);
    setLastSyncTime(event.timestamp);
    setEventCount((prev) => prev + 1);

    // Call individual handlers
    if (
      (event.type === "lead_updated" || event.type === "leads_bulk_updated") &&
      optionsRef.current.onLeadChange
    ) {
      optionsRef.current.onLeadChange(event);
    }

    if (event.type === "task_updated" && optionsRef.current.onTaskChange) {
      optionsRef.current.onTaskChange(event);
    }

    if (event.type === "notification" && optionsRef.current.onNotification) {
      optionsRef.current.onNotification(event);
    }

    if (optionsRef.current.onSync) {
      optionsRef.current.onSync(event);
    }
  }, []);

  // Poll fallback for missed events after reconnection or wake-up from background phone calls
  const fetchMissedEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/sync/events?mode=poll&since=${lastTimestampRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.events) && data.events.length > 0) {
        data.events.forEach((evt: SyncEventPayload) => {
          handleIncomingEvent(evt);
        });
      }
    } catch (e) {
      // Ignore background fetch error
    }
  }, [handleIncomingEvent]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let isMounted = true;

    function connectSSE() {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      try {
        setStatus("connecting");
        const es = new EventSource("/api/sync/events");
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isMounted) return;
          setStatus("connected");
          fetchMissedEvents();
        };

        es.addEventListener("connected", () => {
          if (!isMounted) return;
          setStatus("connected");
        });

        es.addEventListener("lead_updated", (e: MessageEvent) => {
          try {
            const data: SyncEventPayload = JSON.parse(e.data);
            handleIncomingEvent(data);
          } catch {}
        });

        es.addEventListener("leads_bulk_updated", (e: MessageEvent) => {
          try {
            const data: SyncEventPayload = JSON.parse(e.data);
            handleIncomingEvent(data);
          } catch {}
        });

        es.addEventListener("task_updated", (e: MessageEvent) => {
          try {
            const data: SyncEventPayload = JSON.parse(e.data);
            handleIncomingEvent(data);
          } catch {}
        });

        es.addEventListener("notification", (e: MessageEvent) => {
          try {
            const data: SyncEventPayload = JSON.parse(e.data);
            handleIncomingEvent(data);
          } catch {}
        });

        es.addEventListener("ping", () => {
          setLastSyncTime(Date.now());
        });

        es.onerror = () => {
          if (!isMounted) return;
          setStatus("offline");
          es.close();
          eventSourceRef.current = null;

          // Exponential reconnect with jitter
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) connectSSE();
          }, 4000);
        };
      } catch {
        setStatus("offline");
      }
    }

    connectSSE();

    // Re-sync immediately when phone screen unlocks or user returns to tab after phone call
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchMissedEvents();
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }
    }

    function handleOnline() {
      setStatus("connecting");
      connectSSE();
      fetchMissedEvents();
    }

    function handleOffline() {
      setStatus("offline");
    }

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMounted = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [enabled, fetchMissedEvents, handleIncomingEvent]);

  return {
    status,
    lastSyncTime,
    eventCount,
    refetchMissed: fetchMissedEvents,
  };
}
