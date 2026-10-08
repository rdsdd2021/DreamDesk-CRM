import { NextRequest, NextResponse } from "next/server";
import { TasksService } from "@/lib/services/tasksService";
import { AuthService } from "@/lib/services/authService";
import { getDatabase } from "@/lib/db/database";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(request);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const { id } = await params;
    const taskIdNum = parseInt(id, 10);
    if (isNaN(taskIdNum)) {
      return NextResponse.json({ error: "Invalid task ID" }, { status: 400 });
    }

    const performedByName = session.user.name || "Counselor";
    const body = await request.json().catch(() => ({}));
    const { status = "completed" } = body;

    const db = getDatabase();

    // If ID is negative, it represents a callback on lead (id = -lead_id)
    if (taskIdNum < 0) {
      const leadId = Math.abs(taskIdNum);
      const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as any;
      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      // Counselor ownership check
      if (!session.permissions.canViewAllLeads && lead.assigned_to !== session.user.id) {
        return NextResponse.json(
          { error: "Access denied. You can only resolve callbacks for your assigned leads." },
          { status: 403 }
        );
      }

      db.prepare(`
        UPDATE leads
        SET callback_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(leadId);

      db.prepare(`
        INSERT INTO lead_activities (lead_id, activity_type, title, description, new_value, performed_by_id, performed_by_name)
        VALUES (?, 'call', 'Scheduled Callback Completed', 'Counselor attended to scheduled callback follow-up', 'Completed', ?, ?)
      `).run(leadId, session.user.id, performedByName);

      return NextResponse.json({
        success: true,
        message: "Callback marked as completed",
        taskId: taskIdNum,
      });
    }

    // Verify task existence and ownership
    const task = db.prepare("SELECT * FROM crm_tasks WHERE id = ?").get(taskIdNum) as any;
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (!session.permissions.canViewAllLeads && task.assigned_to !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied. You cannot modify tasks assigned to another counselor." },
        { status: 403 }
      );
    }

    if (status === "completed") {
      const result = TasksService.completeTask(taskIdNum, performedByName);
      return NextResponse.json(result);
    } else {
      db.prepare(`
        UPDATE crm_tasks
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, taskIdNum);

      return NextResponse.json({
        success: true,
        message: `Task status updated to ${status}`,
        taskId: taskIdNum,
      });
    }
  } catch (error: any) {
    console.error("Failed to update task:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update task" },
      { status: 500 }
    );
  }
}
