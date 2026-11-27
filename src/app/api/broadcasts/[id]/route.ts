import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { BroadcastService } from "@/lib/services/broadcastService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (!["admin", "team_lead"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const broadcastId = Number(id);
    if (!broadcastId || Number.isNaN(broadcastId)) {
      return NextResponse.json({ error: "Invalid broadcast ID" }, { status: 400 });
    }

    const detail = BroadcastService.getBroadcastDetail(broadcastId, session.user);
    if (!detail) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load broadcast detail" },
      { status: 500 }
    );
  }
}
