import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { DailyOpsService } from "@/lib/services/dailyOpsService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (session.user.role !== "admin" && session.user.role !== "team_lead") {
    return NextResponse.json({ error: "Only Admin or Team Lead can view Team Floor" }, { status: 403 });
  }

  try {
    const teamLeadId = request.nextUrl.searchParams.get("team_lead_id") || undefined;
    const members = DailyOpsService.getTeamFloorSnapshot(
      { userId: session.user.id, role: session.user.role },
      teamLeadId
    );
    return NextResponse.json({ members });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load team floor snapshot" },
      { status: 500 }
    );
  }
}
