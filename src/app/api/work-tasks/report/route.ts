import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { WorkTasksService } from "@/lib/services/workTasksService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const canViewAll = session.user.role === "admin" || session.user.role === "team_lead";
    const from = request.nextUrl.searchParams.get("from") || undefined;
    const to = request.nextUrl.searchParams.get("to") || undefined;
    const userId = request.nextUrl.searchParams.get("user_id") || undefined;
    const taskType = request.nextUrl.searchParams.get("task_type") || undefined;

    const report = WorkTasksService.getReport({
      from,
      to,
      userId,
      taskType,
      canViewAll,
      requesterId: session.user.id,
    });

    return NextResponse.json(report);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}
