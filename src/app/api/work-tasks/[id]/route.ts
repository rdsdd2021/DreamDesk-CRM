import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { WorkTasksService } from "@/lib/services/workTasksService";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const { id } = await params;
    const taskId = Number(id);
    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const body = await request.json();
    const updated = WorkTasksService.updateWorkTask(
      taskId,
      { id: session.user.id, name: session.user.name },
      {
        status: body?.status,
        progress_pct: body?.progress_pct !== undefined ? Number(body.progress_pct) : undefined,
        toggle_checklist_id: body?.toggle_checklist_id
          ? Number(body.toggle_checklist_id)
          : undefined,
        start_timer: Boolean(body?.start_timer),
        remind_dependency: Boolean(body?.remind_dependency),
        notes: body?.notes,
        proof_notes: body?.proof_notes,
        title: body?.title,
        due_at: body?.due_at,
        priority: body?.priority,
      }
    );

    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, task: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const { id } = await params;
    const taskId = Number(id);
    if (!taskId || isNaN(taskId)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const ok = WorkTasksService.archiveWorkTask(taskId);
    if (!ok) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to archive task" },
      { status: 500 }
    );
  }
}
