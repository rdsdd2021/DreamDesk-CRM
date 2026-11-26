import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { DailyOpsService } from "@/lib/services/dailyOpsService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const data = DailyOpsService.listTargets();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load daily targets" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (session.user.role !== "admin" && session.user.role !== "team_lead") {
    return NextResponse.json({ error: "Only Admin or Team Lead can configure daily targets" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const saved = DailyOpsService.upsertTarget(
      {
        user_id: body?.user_id || null,
        calls_target: Number(body?.calls_target || 50),
        connected_target: Number(body?.connected_target || 15),
        whatsapp_target: Number(body?.whatsapp_target || 15),
        tasks_target: Number(body?.tasks_target || 5),
        conversions_target: Number(body?.conversions_target || 1),
      },
      session.user.id
    );
    return NextResponse.json({ success: true, target: saved });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to save daily targets" },
      { status: 500 }
    );
  }
}
