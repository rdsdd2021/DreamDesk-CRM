import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { BroadcastService } from "@/lib/services/broadcastService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const { id } = await params;
    const broadcastId = Number(id);
    if (!broadcastId || Number.isNaN(broadcastId)) {
      return NextResponse.json({ error: "Invalid broadcast ID" }, { status: 400 });
    }

    const body = await request.json();
    const actionId = String(body?.action_id || "").trim();
    if (!actionId) {
      return NextResponse.json({ error: "action_id is required" }, { status: 400 });
    }

    const result = BroadcastService.respondToBroadcast(
      broadcastId,
      session.user.id,
      actionId,
      body?.note
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to record response" },
      { status: 400 }
    );
  }
}
