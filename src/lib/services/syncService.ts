// DreamDesk CRM - Lightweight Real-time Sync Service
import { getDatabase } from "@/lib/db/database";

export interface SyncEvent {
  id: string;
  type: "lead_updated" | "leads_bulk_updated" | "task_updated" | "notification" | "campaign" | "system";
  action: string;
  entityId?: string | number;
  userId?: string;
  timestamp: number;
  data?: any;
}

class SyncEventBus {
  private listeners: Set<(event: SyncEvent) => void> = new Set();
  private eventHistory: SyncEvent[] = [];
  private readonly maxHistory = 100;
  private currentVersion: number = Date.now();

  /**
   * Broadcast an event to all connected clients (SSE) and record in ring buffer.
   */
  publish(
    type: SyncEvent["type"],
    action: string,
    details?: { entityId?: string | number; userId?: string; data?: any }
  ): SyncEvent {
    const event: SyncEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      action,
      entityId: details?.entityId,
      userId: details?.userId,
      timestamp: Date.now(),
      data: details?.data,
    };

    this.currentVersion = event.timestamp;
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Notify all active SSE streams
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.warn("Failed to dispatch sync event to listener:", err);
      }
    });

    return event;
  }

  /**
   * Subscribes a listener function (used by SSE response stream).
   * Returns an unsubscribe function.
   */
  subscribe(listener: (event: SyncEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Gets events that occurred after a given timestamp.
   */
  getEventsSince(sinceTimestamp: number): SyncEvent[] {
    const recent = this.eventHistory.filter((e) => e.timestamp > sinceTimestamp);
    if (recent.length > 0) return recent;

    // If memory buffer didn't have events or was empty, check SQLite activity_logs
    try {
      const db = getDatabase();
      const rows = db
        .prepare(
          `SELECT id, action_type, description, affected_count, created_at, performed_by
           FROM activity_logs 
           WHERE strftime('%s', created_at) * 1000 > ?
           ORDER BY created_at ASC LIMIT 50`
        )
        .all(sinceTimestamp) as any[];

      return rows.map((r) => ({
        id: `db-${r.id}`,
        type: "lead_updated",
        action: r.action_type,
        userId: r.performed_by,
        timestamp: new Date(r.created_at).getTime(),
        data: { description: r.description, count: r.affected_count },
      }));
    } catch {
      return [];
    }
  }

  /**
   * Returns current sync version timestamp.
   */
  getVersion(): number {
    return this.currentVersion;
  }

  /**
   * Returns current active listener count.
   */
  getActiveSubscriberCount(): number {
    return this.listeners.size;
  }
}

// Global singleton instance
const globalForSync = globalThis as unknown as { syncService?: SyncEventBus };
export const SyncService = globalForSync.syncService ?? new SyncEventBus();
if (process.env.NODE_ENV !== "production") {
  globalForSync.syncService = SyncService;
}
