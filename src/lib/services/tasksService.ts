import { getDatabase } from "@/lib/db/database";
import {
  CrmTask,
  TaskPriority,
  TaskStatus,
  BulkTaskConfig,
  UserNotification,
  CallbackTask,
} from "@/types/crm";

export class TasksService {
  /**
   * Generates actionable CRM tasks for assigned leads resulting from a bulk action,
   * creates audit entries, and dispatches in-app notifications to assigned callers.
   */
  static createBulkTasksForLeads(options: {
    leadIds: number[];
    taskConfig: BulkTaskConfig;
    createdBy?: string;
    sourceAction: "bulk_assign" | "bulk_campaign" | "bulk_tags" | "manual";
  }): {
    tasksCreated: number;
    counselorCount: number;
    counselorsNotified: string[];
  } {
    const { leadIds, taskConfig, createdBy = "Admin", sourceAction } = options;
    if (!taskConfig.create_task || !leadIds || leadIds.length === 0) {
      return { tasksCreated: 0, counselorCount: 0, counselorsNotified: [] };
    }

    const db = getDatabase();

    // Calculate due date
    let dueDateIso: string;
    if (taskConfig.due_date && taskConfig.due_date.trim()) {
      dueDateIso = new Date(taskConfig.due_date).toISOString();
    } else if (taskConfig.due_in_hours && taskConfig.due_in_hours > 0) {
      dueDateIso = new Date(Date.now() + taskConfig.due_in_hours * 3600 * 1000).toISOString();
    } else if (taskConfig.priority === "urgent") {
      // Urgent defaults to 4 hours
      dueDateIso = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    } else {
      // Default to 24 hours
      dueDateIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    }

    const priority: TaskPriority = taskConfig.priority || "normal";
    const title = taskConfig.title.trim() || "Follow-up with student applicant";
    const description = taskConfig.description?.trim() || null;

    // Fetch leads with their current assignment
    const placeholders = leadIds.map(() => "?").join(",");
    const rows = db.prepare(`
      SELECT leads.id, leads.lead_code, leads.name, leads.assigned_to, users.name as counselor_name
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      WHERE leads.id IN (${placeholders}) AND leads.assigned_to IS NOT NULL
    `).all(...leadIds) as {
      id: number;
      lead_code: string;
      name: string | null;
      assigned_to: string;
      counselor_name: string | null;
    }[];

    if (rows.length === 0) {
      return { tasksCreated: 0, counselorCount: 0, counselorsNotified: [] };
    }

    const insertTaskStmt = db.prepare(`
      INSERT INTO crm_tasks (
        lead_id, assigned_to, title, description, priority, due_date, status, created_by, source_action
      ) VALUES (
        @lead_id, @assigned_to, @title, @description, @priority, @due_date, 'pending', @created_by, @source_action
      )
    `);

    const insertLeadActStmt = db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, new_value, metadata, performed_by_name)
      VALUES (?, 'note', ?, ?, ?, ?, ?)
    `);

    const insertNotificationStmt = db.prepare(`
      INSERT INTO user_notifications (user_id, title, message, type, priority, metadata)
      VALUES (@user_id, @title, @message, 'task', @priority, @metadata)
    `);

    const counselorTaskCounts = new Map<string, { count: number; name: string }>();
    let tasksCreated = 0;

    const tx = db.transaction(() => {
      for (const lead of rows) {
        insertTaskStmt.run({
          lead_id: lead.id,
          assigned_to: lead.assigned_to,
          title,
          description,
          priority,
          due_date: dueDateIso,
          created_by: createdBy,
          source_action: sourceAction,
        });

        // Record on lead timeline
        insertLeadActStmt.run(
          lead.id,
          `Task Scheduled: ${title} [${priority.toUpperCase()}]`,
          description
            ? `${description}. Due: ${new Date(dueDateIso).toLocaleString()}`
            : `Priority follow-up scheduled by ${createdBy}. Due: ${new Date(dueDateIso).toLocaleString()}`,
          priority.toUpperCase(),
          JSON.stringify({ priority, due_date: dueDateIso, source: sourceAction }),
          createdBy
        );

        tasksCreated++;

        const current = counselorTaskCounts.get(lead.assigned_to) || {
          count: 0,
          name: lead.counselor_name || "Counselor",
        };
        current.count += 1;
        counselorTaskCounts.set(lead.assigned_to, current);
      }

      // Dispatch notification to each affected caller
      for (const [userId, info] of counselorTaskCounts.entries()) {
        const priorityLabel = priority.toUpperCase();
        insertNotificationStmt.run({
          user_id: userId,
          title: `New ${priorityLabel} Tasks Assigned (${info.count})`,
          message: `${createdBy} assigned you ${info.count} follow-up task(s) for your leads: "${title}"`,
          priority,
          metadata: JSON.stringify({
            task_title: title,
            count: info.count,
            priority,
            due_date: dueDateIso,
            source_action: sourceAction,
          }),
        });
      }
    });

    tx();

    return {
      tasksCreated,
      counselorCount: counselorTaskCounts.size,
      counselorsNotified: Array.from(counselorTaskCounts.values()).map((v) => v.name),
    };
  }

  /**
   * Retrieves all actionable tasks (CRM tasks and callback schedules),
   * sorted by priority and urgency.
   */
  static getTasks(options?: {
    counselorId?: string;
    priority?: string;
    status?: string;
    search?: string;
  }): {
    overdue: CrmTask[];
    today: CrmTask[];
    upcoming: CrmTask[];
    completed: CrmTask[];
    all: CrmTask[];
    summary: {
      total: number;
      urgentCount: number;
      highCount: number;
      normalCount: number;
      lowCount: number;
      pendingCount: number;
      completedCount: number;
      overdueCount: number;
    };
  } {
    const db = getDatabase();
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (options?.counselorId && options.counselorId !== "all") {
      whereConditions.push("crm_tasks.assigned_to = ?");
      params.push(options.counselorId);
    }

    if (options?.priority && options.priority !== "all") {
      whereConditions.push("crm_tasks.priority = ?");
      params.push(options.priority);
    }

    if (options?.status && options.status !== "all") {
      whereConditions.push("crm_tasks.status = ?");
      params.push(options.status);
    }

    if (options?.search && options.search.trim()) {
      whereConditions.push("(crm_tasks.title LIKE ? OR leads.name LIKE ? OR leads.lead_code LIKE ?)");
      const term = `%${options.search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        crm_tasks.*,
        leads.lead_code,
        leads.name as lead_name,
        leads.phone as lead_phone,
        leads.status as lead_status,
        users.name as assigned_user_name,
        users.avatar_color as assigned_user_color
      FROM crm_tasks
      JOIN leads ON crm_tasks.lead_id = leads.id
      JOIN users ON crm_tasks.assigned_to = users.id
      ${whereClause}
      ORDER BY 
        CASE crm_tasks.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'normal' THEN 3 
          WHEN 'low' THEN 4 
          ELSE 5 
        END ASC,
        crm_tasks.due_date ASC
    `;

    const taskRows = db.prepare(sql).all(...params) as any[];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const overdue: CrmTask[] = [];
    const today: CrmTask[] = [];
    const upcoming: CrmTask[] = [];
    const completed: CrmTask[] = [];

    let urgentCount = 0;
    let highCount = 0;
    let normalCount = 0;
    let lowCount = 0;

    for (const r of taskRows) {
      const task: CrmTask = {
        id: r.id,
        lead_id: r.lead_id,
        lead_code: r.lead_code,
        lead_name: r.lead_name,
        lead_phone: r.lead_phone,
        lead_status: r.lead_status,
        assigned_to: r.assigned_to,
        assigned_user_name: r.assigned_user_name,
        assigned_user_color: r.assigned_user_color || "#3b82f6",
        title: r.title,
        description: r.description,
        priority: r.priority,
        due_date: r.due_date,
        status: r.status,
        created_by: r.created_by,
        source_action: r.source_action,
        completed_at: r.completed_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };

      if (task.priority === "urgent") urgentCount++;
      else if (task.priority === "high") highCount++;
      else if (task.priority === "normal") normalCount++;
      else if (task.priority === "low") lowCount++;

      if (task.status === "completed") {
        completed.push(task);
        continue;
      }

      const dueDate = new Date(task.due_date);
      if (dueDate < startOfToday) {
        overdue.push(task);
      } else if (dueDate <= endOfToday) {
        today.push(task);
      } else {
        upcoming.push(task);
      }
    }

    return {
      overdue,
      today,
      upcoming,
      completed,
      all: taskRows as CrmTask[],
      summary: {
        total: taskRows.length,
        urgentCount,
        highCount,
        normalCount,
        lowCount,
        pendingCount: overdue.length + today.length + upcoming.length,
        completedCount: completed.length,
        overdueCount: overdue.length,
      },
    };
  }

  /**
   * Marks a task as completed and logs the action in the lead activity history.
   */
  static completeTask(taskId: number, performedByName: string = "Counselor"): { success: boolean; task: CrmTask } {
    const db = getDatabase();
    const task = db.prepare(`
      SELECT crm_tasks.*, leads.lead_code, leads.name as lead_name
      FROM crm_tasks
      JOIN leads ON crm_tasks.lead_id = leads.id
      WHERE crm_tasks.id = ?
    `).get(taskId) as any;

    if (!task) throw new Error(`Task ${taskId} not found`);

    // Idempotency guard: prevent duplicate completion updates and duplicate activity log spam
    if (task.status === "completed") {
      return {
        success: true,
        task: {
          ...task,
          status: "completed",
        },
      };
    }

    db.prepare(`
      UPDATE crm_tasks
      SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(taskId);

    db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, new_value, performed_by_name)
      VALUES (?, 'note', ?, ?, 'Completed', ?)
    `).run(
      task.lead_id,
      `Task Completed: ${task.title}`,
      `Task finished by ${performedByName}`,
      performedByName
    );

    return {
      success: true,
      task: {
        ...task,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
    };
  }

  /**
   * Fetches unread & recent notifications for a user.
   */
  static getNotifications(userId: string, limit: number = 25): {
    notifications: UserNotification[];
    unreadCount: number;
  } {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM user_notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, limit) as any[];

    const unreadCount = (
      db.prepare(`
        SELECT COUNT(*) as count FROM user_notifications
        WHERE user_id = ? AND is_read = 0
      `).get(userId) as any
    )?.count || 0;

    const notifications: UserNotification[] = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      title: r.title,
      message: r.message,
      type: r.type,
      priority: r.priority,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
      is_read: Boolean(r.is_read),
      created_at: r.created_at,
    }));

    return { notifications, unreadCount };
  }

  /**
   * Marks a single notification as read.
   */
  static markNotificationRead(notificationId: number, userId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?
    `).run(notificationId, userId);
  }

  /**
   * Marks all notifications as read for a given user.
   */
  static markAllNotificationsRead(userId: string): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE user_notifications SET is_read = 1 WHERE user_id = ?
    `).run(userId);
  }
}
