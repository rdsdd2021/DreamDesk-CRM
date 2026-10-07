import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { TasksService } from "@/lib/services/tasksService";
import { AuthService } from "@/lib/services/authService";
import { getDatabase } from "@/lib/db/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    let currentUser = null;
    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session) currentUser = session.user;
    }

    let counselorId = request.nextUrl.searchParams.get("counselor_id") || undefined;
    const priority = request.nextUrl.searchParams.get("priority") || undefined;
    const status = request.nextUrl.searchParams.get("status") || undefined;
    const search = request.nextUrl.searchParams.get("search") || undefined;

    // Counselors only see their own tasks
    if (
      currentUser &&
      (currentUser.role === "counselor" ||
        currentUser.role === "senior_counselor" ||
        currentUser.role === "telecaller")
    ) {
      counselorId = currentUser.id;
    }

    // 1. Get structured CRM tasks
    const crmTasksData = TasksService.getTasks({
      counselorId,
      priority,
      status,
      search,
    });

    // 2. Get callbacks
    const callbacksData = LeadsService.getScheduledCallbacks(counselorId);

    // Filter callbacks by search if provided
    let filteredCallbacksToday = callbacksData.today;
    let filteredCallbacksOverdue = callbacksData.overdue;
    let filteredCallbacksUpcoming = callbacksData.upcoming;

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const match = (c: any) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.lead_code || "").toLowerCase().includes(q) ||
        (c.notes || "").toLowerCase().includes(q);
      filteredCallbacksToday = filteredCallbacksToday.filter(match);
      filteredCallbacksOverdue = filteredCallbacksOverdue.filter(match);
      filteredCallbacksUpcoming = filteredCallbacksUpcoming.filter(match);
    }

    // Map callbacks to task-compatible shapes with high priority
    const mapCallbackToTask = (c: any, isOverdue: boolean) => ({
      id: -(c.lead_id), // negative id flags callback vs crm_task
      lead_id: c.lead_id,
      lead_code: c.lead_code,
      lead_name: c.name || "Student Lead",
      name: c.name || "Student Lead",
      lead_phone: c.phone,
      phone: c.phone,
      lead_status: c.status || "Follow-up",
      status: "pending" as const,
      assigned_to: c.assigned_to,
      assigned_user_name: c.assigned_user_name,
      title: c.notes ? `Scheduled Callback: ${c.notes}` : "Scheduled Callback",
      description: c.notes || `Callback scheduled at ${new Date(c.callback_at).toLocaleString()}`,
      notes: c.notes,
      priority: (isOverdue ? "urgent" : "high") as any,
      due_date: c.callback_at,
      callback_at: c.callback_at,
      created_by: "System Callback Scheduler",
      source_action: "callback",
      is_callback: true,
      created_at: c.callback_at,
      updated_at: c.callback_at,
    });

    // Unified lists (merging CRM tasks with callbacks without duplicating if already completed)
    const unifiedOverdue = [
      ...crmTasksData.overdue,
      ...filteredCallbacksOverdue.map((c) => mapCallbackToTask(c, true)),
    ];

    const unifiedToday = [
      ...crmTasksData.today,
      ...filteredCallbacksToday.map((c) => mapCallbackToTask(c, false)),
    ];

    const unifiedUpcoming = [
      ...crmTasksData.upcoming,
      ...filteredCallbacksUpcoming.map((c) => mapCallbackToTask(c, false)),
    ];

    const unifiedCompleted = crmTasksData.completed;

    return NextResponse.json({
      overdue: unifiedOverdue,
      today: unifiedToday,
      upcoming: unifiedUpcoming,
      completed: unifiedCompleted,
      all: [...unifiedOverdue, ...unifiedToday, ...unifiedUpcoming, ...unifiedCompleted],
      totalCount:
        unifiedOverdue.length +
        unifiedToday.length +
        unifiedUpcoming.length +
        unifiedCompleted.length,
      crmSummary: crmTasksData.summary,
      rawCrmTasks: crmTasksData,
      rawCallbacks: callbacksData,
    });
  } catch (error: any) {
    console.error("Failed to fetch scheduled tasks:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch scheduled tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    let performedByName = "Admin";
    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session?.user?.name) performedByName = session.user.name;
    }

    const body = await request.json();
    const { lead_id, assigned_to, title, description, priority, due_date } = body;

    if (!lead_id || !assigned_to || !title) {
      return NextResponse.json(
        { error: "lead_id, assigned_to, and title are required" },
        { status: 400 }
      );
    }

    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO crm_tasks (
        lead_id, assigned_to, title, description, priority, due_date, status, created_by, source_action
      ) VALUES (
        @lead_id, @assigned_to, @title, @description, @priority, @due_date, 'pending', @created_by, 'manual'
      )
    `).run({
      lead_id,
      assigned_to,
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "normal",
      due_date: due_date || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      created_by: performedByName,
    });

    // Notify assigned counselor
    db.prepare(`
      INSERT INTO user_notifications (user_id, title, message, type, priority, metadata)
      VALUES (?, ?, ?, 'task', ?, ?)
    `).run(
      assigned_to,
      `New Task Assigned: ${title}`,
      `${performedByName} assigned you a follow-up task: "${title}"`,
      priority || "normal",
      JSON.stringify({ task_id: result.lastInsertRowid, lead_id, priority })
    );

    return NextResponse.json({
      success: true,
      taskId: result.lastInsertRowid,
      message: "Task created and notification dispatched successfully",
    });
  } catch (error: any) {
    console.error("Failed to create task:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create task" },
      { status: 500 }
    );
  }
}
