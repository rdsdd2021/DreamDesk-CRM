import { getDatabase } from "@/lib/db/database";
import { SyncService } from "@/lib/services/syncService";
import {
  WorkTask,
  WorkTaskChecklistItem,
  WorkTaskLog,
  WorkTaskRecurrence,
  WorkTaskStatus,
  WorkTaskType,
  TaskPriority,
} from "@/types/crm";

function getTodayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getStartOfWeekStr(d: Date): string {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy.toISOString().slice(0, 10);
}

function isCompletedInCurrentCycle(
  lastCompletedAt: string | null,
  rule: WorkTaskRecurrence | null
): boolean {
  if (!lastCompletedAt || !rule) return false;
  const completed = new Date(lastCompletedAt);
  if (isNaN(completed.getTime())) return false;
  const now = new Date();

  if (rule === "daily" || rule === "weekdays") {
    return completed.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
  }
  if (rule === "weekly") {
    return getStartOfWeekStr(completed) === getStartOfWeekStr(now);
  }
  if (rule === "monthly") {
    return completed.toISOString().slice(0, 7) === now.toISOString().slice(0, 7);
  }
  return false;
}

export class WorkTasksService {
  static listWorkTasks(options: {
    userId?: string;
    canViewAll: boolean;
    taskType?: string;
    status?: string;
    includeArchived?: boolean;
  }): WorkTask[] {
    const db = getDatabase();
    const { userId, canViewAll, taskType, status, includeArchived = false } = options;

    const conditions: string[] = [];
    const params: any[] = [];

    if (!includeArchived) {
      conditions.push("wt.is_archived = 0");
    }

    if (!canViewAll && userId) {
      // Users see tasks assigned to them, created by them, or linked to their tasks
      conditions.push(
        "(wt.assigned_to = ? OR wt.created_by = ? OR wt.id IN (SELECT depends_on_task_id FROM work_tasks WHERE assigned_to = ? AND depends_on_task_id IS NOT NULL))"
      );
      params.push(userId, userId, userId);
    } else if (userId && userId !== "all") {
      conditions.push("wt.assigned_to = ?");
      params.push(userId);
    }

    if (taskType && taskType !== "all") {
      conditions.push("wt.task_type = ?");
      params.push(taskType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = db
      .prepare(
        `
        SELECT
          wt.*,
          u.name AS assigned_user_name,
          u.avatar_color AS assigned_user_color,
          cu.name AS created_by_name,
          dep.title AS dep_title,
          dep.status AS dep_status,
          dep.assigned_to AS dep_assigned_to,
          dep_u.name AS dep_assigned_user_name,
          (SELECT COUNT(*) FROM work_task_logs l WHERE l.task_id = wt.id AND l.action = 'completed') AS completion_count
        FROM work_tasks wt
        LEFT JOIN users u ON wt.assigned_to = u.id
        LEFT JOIN users cu ON wt.created_by = cu.id
        LEFT JOIN work_tasks dep ON wt.depends_on_task_id = dep.id
        LEFT JOIN users dep_u ON dep.assigned_to = dep_u.id
        ${where}
        ORDER BY
          CASE wt.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'normal' THEN 3
            ELSE 4
          END ASC,
          wt.due_at IS NULL ASC,
          wt.due_at ASC,
          wt.id DESC
      `
      )
      .all(...params) as any[];

    if (rows.length === 0) return [];

    const taskIds = rows.map((r) => r.id);
    const placeholders = taskIds.map(() => "?").join(",");
    const checklistRows = db
      .prepare(
        `SELECT * FROM work_task_checklist WHERE task_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`
      )
      .all(...taskIds) as any[];

    const checklistByTask = new Map<number, WorkTaskChecklistItem[]>();
    for (const c of checklistRows) {
      const list = checklistByTask.get(c.task_id) || [];
      list.push({
        id: c.id,
        task_id: c.task_id,
        label: c.label,
        is_done: Boolean(c.is_done),
        sort_order: c.sort_order,
      });
      checklistByTask.set(c.task_id, list);
    }

    const resetStmt = db.prepare(
      `UPDATE work_tasks SET status = 'todo', progress_pct = 0, started_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    );
    const resetChecklistStmt = db.prepare(
      `UPDATE work_task_checklist SET is_done = 0 WHERE task_id = ?`
    );

    const mapped: WorkTask[] = [];
    for (const r of rows) {
      let effectiveStatus: WorkTaskStatus = r.status;
      let effectiveProgress: number = r.progress_pct || 0;
      let checklist = checklistByTask.get(r.id) || [];

      // Automatically reset recurring task for a new cycle while keeping logs intact
      if (
        r.task_type === "recurring" &&
        r.status === "done" &&
        !isCompletedInCurrentCycle(r.last_completed_at, r.recurrence_rule)
      ) {
        effectiveStatus = "todo";
        effectiveProgress = 0;
        resetStmt.run(r.id);
        if (checklist.length > 0) {
          resetChecklistStmt.run(r.id);
          checklist = checklist.map((item) => ({ ...item, is_done: false }));
        }
      }

      if (status && status !== "all" && effectiveStatus !== status) {
        continue;
      }

      const dependsOn =
        r.depends_on_task_id && r.dep_title
          ? {
              id: r.depends_on_task_id,
              title: r.dep_title,
              status: r.dep_status as WorkTaskStatus,
              assigned_to: r.dep_assigned_to,
              assigned_user_name: r.dep_assigned_user_name,
            }
          : null;

      mapped.push({
        id: r.id,
        title: r.title,
        description: r.description,
        task_type: r.task_type as WorkTaskType,
        recurrence_rule: r.recurrence_rule as WorkTaskRecurrence | null,
        time_limit_minutes: r.time_limit_minutes,
        started_at: r.started_at,
        due_at: r.due_at,
        status: effectiveStatus,
        progress_pct: effectiveProgress,
        priority: r.priority as TaskPriority,
        assigned_to: r.assigned_to,
        assigned_user_name: r.assigned_user_name,
        assigned_user_color: r.assigned_user_color,
        created_by: r.created_by,
        created_by_name: r.created_by_name,
        depends_on_task_id: r.depends_on_task_id,
        depends_on: dependsOn,
        is_blocked: Boolean(dependsOn && dependsOn.status !== "done"),
        last_completed_at: r.last_completed_at,
        is_archived: Boolean(r.is_archived),
        checklist,
        completion_count: r.completion_count || 0,
        created_at: r.created_at,
        updated_at: r.updated_at,
      });
    }

    return mapped;
  }

  static createWorkTask(input: {
    title: string;
    description?: string | null;
    task_type: WorkTaskType;
    recurrence_rule?: WorkTaskRecurrence | null;
    time_limit_minutes?: number | null;
    due_at?: string | null;
    priority?: TaskPriority;
    assigned_to: string;
    created_by: string;
    created_by_name: string;
    depends_on_task_id?: number | null;
    checklist?: string[];
  }): WorkTask {
    const db = getDatabase();
    const todayStr = getTodayDateStr();

    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `
          INSERT INTO work_tasks (
            title, description, task_type, recurrence_rule, time_limit_minutes,
            due_at, status, progress_pct, priority, assigned_to, created_by, depends_on_task_id
          ) VALUES (
            @title, @description, @task_type, @recurrence_rule, @time_limit_minutes,
            @due_at, 'todo', 0, @priority, @assigned_to, @created_by, @depends_on_task_id
          )
        `
        )
        .run({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          task_type: input.task_type || "one_time",
          recurrence_rule:
            input.task_type === "recurring" ? input.recurrence_rule || "daily" : null,
          time_limit_minutes:
            input.task_type === "timed" && input.time_limit_minutes
              ? Math.max(1, Number(input.time_limit_minutes))
              : input.time_limit_minutes || null,
          due_at: input.due_at || null,
          priority: input.priority || "normal",
          assigned_to: input.assigned_to,
          created_by: input.created_by,
          depends_on_task_id: input.depends_on_task_id || null,
        });

      const taskId = Number(info.lastInsertRowid);

      if (input.checklist && input.checklist.length > 0) {
        const insertItem = db.prepare(
          `INSERT INTO work_task_checklist (task_id, label, is_done, sort_order) VALUES (?, ?, 0, ?)`
        );
        input.checklist.forEach((label, idx) => {
          const clean = label.trim();
          if (clean) insertItem.run(taskId, clean, idx);
        });
      }

      db.prepare(
        `
        INSERT INTO work_task_logs (task_id, user_id, user_name, action, cycle_date, progress_pct, notes)
        VALUES (?, ?, ?, 'created', ?, 0, ?)
      `
      ).run(
        taskId,
        input.created_by,
        input.created_by_name,
        todayStr,
        input.depends_on_task_id ? `Linked to task #${input.depends_on_task_id}` : null
      );

      // Notify assignee if assigned by someone else
      if (input.assigned_to !== input.created_by) {
        db.prepare(
          `
          INSERT INTO user_notifications (user_id, title, message, type, priority, metadata)
          VALUES (?, ?, ?, 'task', ?, ?)
        `
        ).run(
          input.assigned_to,
          "New Work Task Assigned",
          `${input.created_by_name} assigned you: "${input.title.trim()}"`,
          input.priority || "normal",
          JSON.stringify({ work_task_id: taskId })
        );
      }

      return taskId;
    });

    const newId = tx();
    SyncService.publish("task_updated", String(newId));

    const created = this.listWorkTasks({ canViewAll: true, includeArchived: true }).find(
      (t) => t.id === newId
    );
    return created!;
  }

  static updateWorkTask(
    taskId: number,
    actor: { id: string; name: string },
    patch: {
      status?: WorkTaskStatus;
      progress_pct?: number;
      toggle_checklist_id?: number;
      start_timer?: boolean;
      remind_dependency?: boolean;
      notes?: string;
      title?: string;
      due_at?: string | null;
      priority?: TaskPriority;
    }
  ): WorkTask | null {
    const db = getDatabase();
    const existing = db.prepare(`SELECT * FROM work_tasks WHERE id = ?`).get(taskId) as any;
    if (!existing) return null;

    const todayStr = getTodayDateStr();

    // 1-Tap Remind Upstream Task Owner
    if (patch.remind_dependency && existing.depends_on_task_id) {
      const upstream = db
        .prepare(`SELECT id, title, assigned_to FROM work_tasks WHERE id = ?`)
        .get(existing.depends_on_task_id) as any;
      if (upstream) {
        db.prepare(
          `
          INSERT INTO user_notifications (user_id, title, message, type, priority, metadata)
          VALUES (?, ?, ?, 'task', 'high', ?)
        `
        ).run(
          upstream.assigned_to,
          "Task Dependency Reminder",
          `${actor.name} is waiting on "${upstream.title}" to proceed with "${existing.title}"`,
          JSON.stringify({ work_task_id: upstream.id, downstream_task_id: existing.id })
        );

        db.prepare(
          `
          INSERT INTO work_task_logs (task_id, user_id, user_name, action, cycle_date, progress_pct, notes)
          VALUES (?, ?, ?, 'reminded', ?, ?, ?)
        `
        ).run(
          taskId,
          actor.id,
          actor.name,
          todayStr,
          existing.progress_pct,
          `Sent reminder for upstream task #${upstream.id}`
        );
      }
      SyncService.publish("notification", String(taskId));
      return (
        this.listWorkTasks({ canViewAll: true, includeArchived: true }).find(
          (t) => t.id === taskId
        ) || null
      );
    }

    const tx = db.transaction(() => {
      let nextStatus: WorkTaskStatus = patch.status || existing.status;
      let nextProgress: number =
        patch.progress_pct !== undefined ? patch.progress_pct : existing.progress_pct;
      let nextStartedAt: string | null = existing.started_at;
      let nextLastCompletedAt: string | null = existing.last_completed_at;
      let logAction = "progress";

      // Toggle a checklist sub-item and auto-recalculate progress
      if (patch.toggle_checklist_id) {
        const item = db
          .prepare(`SELECT * FROM work_task_checklist WHERE id = ? AND task_id = ?`)
          .get(patch.toggle_checklist_id, taskId) as any;
        if (item) {
          const nextDone = item.is_done ? 0 : 1;
          db.prepare(`UPDATE work_task_checklist SET is_done = ? WHERE id = ?`).run(
            nextDone,
            item.id
          );
          const counts = db
            .prepare(
              `SELECT COUNT(*) AS total, SUM(is_done) AS done_cnt FROM work_task_checklist WHERE task_id = ?`
            )
            .get(taskId) as { total: number; done_cnt: number };
          if (counts.total > 0) {
            nextProgress = Math.round(((counts.done_cnt || 0) / counts.total) * 100);
            if (nextProgress === 100) {
              nextStatus = "done";
            } else if (nextProgress > 0) {
              nextStatus = "in_progress";
            } else {
              nextStatus = "todo";
            }
          }
        }
      }

      if (patch.start_timer && !nextStartedAt) {
        nextStartedAt = new Date().toISOString();
        if (nextStatus === "todo") nextStatus = "in_progress";
        logAction = "started";
      }

      if (patch.status === "in_progress" && !nextStartedAt && existing.time_limit_minutes) {
        nextStartedAt = new Date().toISOString();
      }

      if (nextStatus === "done") {
        nextProgress = 100;
        nextLastCompletedAt = new Date().toISOString();
        logAction = "completed";
      } else if (nextStatus === "todo" && patch.status === "todo") {
        nextProgress = 0;
        nextStartedAt = null;
      } else if (nextProgress >= 100 && patch.progress_pct !== undefined) {
        nextStatus = "done";
        nextLastCompletedAt = new Date().toISOString();
        logAction = "completed";
      } else if (nextProgress > 0 && nextStatus === "todo") {
        nextStatus = "in_progress";
      }

      let durationSeconds: number | null = null;
      if (nextStatus === "done" && nextStartedAt) {
        const startMs = new Date(nextStartedAt).getTime();
        if (!isNaN(startMs)) {
          durationSeconds = Math.max(1, Math.round((Date.now() - startMs) / 1000));
        }
      }

      db.prepare(
        `
        UPDATE work_tasks
        SET
          title = COALESCE(@title, title),
          priority = COALESCE(@priority, priority),
          due_at = CASE WHEN @hasDueAt = 1 THEN @due_at ELSE due_at END,
          status = @status,
          progress_pct = @progress_pct,
          started_at = @started_at,
          last_completed_at = @last_completed_at,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `
      ).run({
        id: taskId,
        title: patch.title?.trim() || null,
        priority: patch.priority || null,
        hasDueAt: patch.due_at !== undefined ? 1 : 0,
        due_at: patch.due_at ?? null,
        status: nextStatus,
        progress_pct: nextProgress,
        started_at: nextStartedAt,
        last_completed_at: nextLastCompletedAt,
      });

      db.prepare(
        `
        INSERT INTO work_task_logs (task_id, user_id, user_name, action, cycle_date, progress_pct, duration_seconds, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        taskId,
        actor.id,
        actor.name,
        patch.notes && !patch.status && !patch.toggle_checklist_id ? "note" : logAction,
        todayStr,
        nextProgress,
        durationSeconds,
        patch.notes?.trim() || null
      );

      // Unlock / Notify downstream tasks if this task just finished
      if (nextStatus === "done" && existing.status !== "done") {
        const downstreamTasks = db
          .prepare(`SELECT id, title, assigned_to FROM work_tasks WHERE depends_on_task_id = ? AND is_archived = 0`)
          .all(taskId) as { id: number; title: string; assigned_to: string }[];

        for (const ds of downstreamTasks) {
          db.prepare(
            `
            INSERT INTO user_notifications (user_id, title, message, type, priority, metadata)
            VALUES (?, ?, ?, 'task', 'high', ?)
          `
          ).run(
            ds.assigned_to,
            "Linked Task Unblocked",
            `"${existing.title}" is complete! Your linked task "${ds.title}" is now ready.`,
            JSON.stringify({ work_task_id: ds.id, unblocked_by: taskId })
          );

          db.prepare(
            `
            INSERT INTO work_task_logs (task_id, user_id, user_name, action, cycle_date, notes)
            VALUES (?, ?, ?, 'unblocked', ?, ?)
          `
          ).run(
            ds.id,
            actor.id,
            actor.name,
            todayStr,
            `Upstream task "${existing.title}" completed by ${actor.name}`
          );
        }
      }
    });

    tx();
    SyncService.publish("task_updated", String(taskId));

    return (
      this.listWorkTasks({ canViewAll: true, includeArchived: true }).find(
        (t) => t.id === taskId
      ) || null
    );
  }

  static archiveWorkTask(taskId: number): boolean {
    const db = getDatabase();
    const res = db
      .prepare(`UPDATE work_tasks SET is_archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(taskId);
    SyncService.publish("task_updated", String(taskId));
    return res.changes > 0;
  }

  static getReport(options: {
    from?: string;
    to?: string;
    userId?: string;
    taskType?: string;
    canViewAll: boolean;
    requesterId: string;
  }): {
    summary: {
      totalLogs: number;
      totalCompletions: number;
      uniqueTasksCompleted: number;
      avgDurationMinutes: number;
    };
    logs: WorkTaskLog[];
  } {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (!options.canViewAll) {
      conditions.push("(l.user_id = ? OR wt.assigned_to = ?)");
      params.push(options.requesterId, options.requesterId);
    } else if (options.userId && options.userId !== "all") {
      conditions.push("(l.user_id = ? OR wt.assigned_to = ?)");
      params.push(options.userId, options.userId);
    }

    if (options.taskType && options.taskType !== "all") {
      conditions.push("wt.task_type = ?");
      params.push(options.taskType);
    }

    if (options.from) {
      conditions.push("date(l.created_at) >= date(?)");
      params.push(options.from);
    }
    if (options.to) {
      conditions.push("date(l.created_at) <= date(?)");
      params.push(options.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const logs = db
      .prepare(
        `
        SELECT
          l.*,
          wt.title AS task_title,
          wt.task_type AS task_type
        FROM work_task_logs l
        LEFT JOIN work_tasks wt ON l.task_id = wt.id
        ${where}
        ORDER BY l.created_at DESC, l.id DESC
        LIMIT 500
      `
      )
      .all(...params) as WorkTaskLog[];

    const completions = logs.filter((l) => l.action === "completed");
    const uniqueTaskIds = new Set(completions.map((l) => l.task_id));
    const timed = completions.filter((l) => l.duration_seconds && l.duration_seconds > 0);
    const avgSec =
      timed.length > 0
        ? timed.reduce((acc, cur) => acc + (cur.duration_seconds || 0), 0) / timed.length
        : 0;

    return {
      summary: {
        totalLogs: logs.length,
        totalCompletions: completions.length,
        uniqueTasksCompleted: uniqueTaskIds.size,
        avgDurationMinutes: Math.round((avgSec / 60) * 10) / 10,
      },
      logs,
    };
  }
}
