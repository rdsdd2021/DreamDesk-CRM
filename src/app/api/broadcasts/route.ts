import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { BroadcastService } from "@/lib/services/broadcastService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (!["admin", "team_lead"].includes(session.user.role)) {
    return NextResponse.json({ error: "Only Admins and Team Leads can access broadcasts." }, { status: 403 });
  }

  try {
    const broadcasts = BroadcastService.listBroadcasts(session.user);
    const eligibleRecipients = BroadcastService.getEligibleRecipients(session.user);
    return NextResponse.json({ broadcasts, eligibleRecipients });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load broadcasts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (!["admin", "team_lead"].includes(session.user.role)) {
    return NextResponse.json({ error: "Only Admins and Team Leads can send broadcasts." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const broadcast = BroadcastService.sendBroadcast(session.user, {
      title: body?.title,
      message: body?.message,
      priority: body?.priority,
      target_type: body?.target_type,
      target_values: body?.target_values,
      action_buttons: body?.action_buttons,
      require_ack: body?.require_ack,
    });
    return NextResponse.json({ success: true, broadcast });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send broadcast" },
      { status: 400 }
    );
  }
}
