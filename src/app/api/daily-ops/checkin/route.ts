import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { DailyOpsService } from "@/lib/services/dailyOpsService";
import { PresenceStatus } from "@/types/crm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const data = DailyOpsService.getMyDailyOps(session.user.id);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load daily ops status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "checkin") {
      const focus = String(body?.morning_focus || "");
      const presence = (body?.presence_status || "available") as PresenceStatus;
      const checkin = DailyOpsService.checkIn(session.user.id, focus, presence);
      return NextResponse.json({ success: true, checkin });
    }

    if (action === "presence") {
      const presence = body?.presence_status as PresenceStatus;
      if (!["available", "on_calls", "busy", "break", "wrap_up", "offline"].includes(presence)) {
        return NextResponse.json({ error: "Invalid presence status" }, { status: 400 });
      }
      const checkin = DailyOpsService.updatePresence(session.user.id, presence);
      return NextResponse.json({ success: true, checkin });
    }

    if (action === "eod") {
      const notes = String(body?.eod_notes || "");
      const blockers = String(body?.eod_blockers || "");
      const checkin = DailyOpsService.submitEod(session.user.id, notes, blockers);
      return NextResponse.json({ success: true, checkin });
    }

    return NextResponse.json({ error: "Unsupported daily ops action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update daily ops" },
      { status: 500 }
    );
  }
}
