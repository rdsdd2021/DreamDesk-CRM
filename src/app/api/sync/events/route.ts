// DreamDesk CRM - Real-time Sync & Server-Sent Events (SSE) Endpoint
import { NextRequest, NextResponse } from "next/server";
import { SyncService, SyncEvent } from "@/lib/services/syncService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");
  const since = searchParams.get("since");
  const acceptHeader = request.headers.get("accept") || "";

  // 1. Lightweight JSON Polling / Delta Sync Mode
  if (mode === "poll" || (since && !acceptHeader.includes("text/event-stream") && mode !== "stream")) {
    const sinceTimestamp = parseInt(since || "0", 10);
    const events = SyncService.getEventsSince(sinceTimestamp);
    return NextResponse.json({
      events,
      version: SyncService.getVersion(),
      activeConnections: SyncService.getActiveSubscriberCount(),
      serverTime: Date.now(),
    });
  }

  // 2. Server-Sent Events (SSE) Streaming Mode
  const encoder = new TextEncoder();
  let cleanupSubscriber: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection handshake
      const initialMessage = `event: connected\ndata: ${JSON.stringify({
        status: "connected",
        version: SyncService.getVersion(),
        timestamp: Date.now(),
      })}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));

      // Subscribe to real-time events published by backend services
      cleanupSubscriber = SyncService.subscribe((event: SyncEvent) => {
        try {
          const message = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          console.warn("SSE stream push error:", err);
        }
      });

      // 25-second keepalive ping to prevent mobile cellular timeout
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {"time":${Date.now()}}\n\n`));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 25000);
    },
    cancel() {
      if (cleanupSubscriber) cleanupSubscriber();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// POST endpoint to trigger manual or test sync broadcasts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = "system", action = "MANUAL_SYNC", details = {} } = body;

    const event = SyncService.publish(type, action, details);
    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to broadcast sync event" },
      { status: 500 }
    );
  }
}
