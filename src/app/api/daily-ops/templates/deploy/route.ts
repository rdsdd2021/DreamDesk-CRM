import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { DailyOpsService } from "@/lib/services/dailyOpsService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (session.user.role !== "admin" && session.user.role !== "team_lead") {
    return NextResponse.json({ error: "Only Admin or Team Lead can deploy playbooks" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const templateIds = Array.isArray(body?.templateIds)
      ? body.templateIds.map((id: any) => Number(id)).filter((n: number) => !isNaN(n))
      : [];
    const targetUserIds = Array.isArray(body?.targetUserIds)
      ? body.targetUserIds.map((id: any) => String(id)).filter(Boolean)
      : [];

    if (templateIds.length === 0 || targetUserIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one SOP template and one caller" },
        { status: 400 }
      );
    }

    const result = DailyOpsService.deployPlaybook({
      templateIds,
      targetUserIds,
      assignedBy: { id: session.user.id, name: session.user.name },
    });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to deploy playbook" },
      { status: 500 }
    );
  }
}
