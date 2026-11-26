import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { WorkTasksService } from "@/lib/services/workTasksService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (session.user.role !== "admin" && session.user.role !== "team_lead") {
    return NextResponse.json({ error: "Only Admin or Team Lead can review tasks" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const taskId = Number(id);
    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const body = await request.json();
    const decision = body?.decision;
    if (decision !== "approved" && decision !== "revision_requested") {
      return NextResponse.json({ error: "Decision must be 'approved' or 'revision_requested'" }, { status: 400 });
    }

    const task = WorkTasksService.reviewWorkTask(
      taskId,
      { id: session.user.id, name: session.user.name, role: session.user.role },
      decision,
      body?.feedback
    );

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, task });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to review task" },
      { status: 500 }
    );
  }
}
