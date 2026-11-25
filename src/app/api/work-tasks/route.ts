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
    const requestedUser = request.nextUrl.searchParams.get("user_id") || undefined;
    const taskType = request.nextUrl.searchParams.get("task_type") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;

    const tasks = WorkTasksService.listWorkTasks({
      userId: canViewAll ? requestedUser : session.user.id,
      canViewAll,
      taskType,
      status,
    });

    return NextResponse.json({ tasks });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load work tasks" },
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
    const title = String(body?.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    const canAssignOthers = session.user.role === "admin" || session.user.role === "team_lead";
    const assignedTo =
      canAssignOthers && body?.assigned_to ? String(body.assigned_to) : session.user.id;

    const task = WorkTasksService.createWorkTask({
      title,
      description: body?.description,
      task_type: body?.task_type || "one_time",
      recurrence_rule: body?.recurrence_rule || null,
      time_limit_minutes: body?.time_limit_minutes ? Number(body.time_limit_minutes) : null,
      due_at: body?.due_at || null,
      priority: body?.priority || "normal",
      assigned_to: assignedTo,
      created_by: session.user.id,
      created_by_name: session.user.name,
      depends_on_task_id: body?.depends_on_task_id ? Number(body.depends_on_task_id) : null,
      checklist: Array.isArray(body?.checklist) ? body.checklist : undefined,
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create work task" },
      { status: 500 }
    );
  }
}
