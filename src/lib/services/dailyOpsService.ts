import { getDatabase } from "@/lib/db/database";
import { SyncService } from "@/lib/services/syncService";
import { WorkTasksService } from "@/lib/services/workTasksService";
import {
  DailyAutoStats,
  DailyCheckin,
  DailyTarget,
  PresenceStatus,
  TaskPriority,
  TeamFloorMember,
  User,
  WorkTaskRecurrence,
  WorkTaskTemplate,
  WorkTaskType,
} from "@/types/crm";

function getTodayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DEFAULT_TARGET: DailyTarget = {
  user_id: null,
  calls_target: 50,
  connected_target: 15,
  whatsapp_target: 15,
  tasks_target: 5,
  conversions_target: 1,
  is_override: false,
};

export class DailyOpsService {
  static getTodayAutoStats(userId: string, dateStr = getTodayDateStr()): DailyAutoStats {
    const db = getDatabase();

    const actRows = db
      .prepare(
        `
        SELECT activity_type, COUNT(*) AS cnt
        FROM lead_activities
        WHERE performed_by_id = ? AND date(created_at, 'localtime') = ?
        GROUP BY activity_type
      `
      )
      .all(userId, dateStr) as { activity_type: string; cnt: number }[];

    let callsMade = 0;
    let whatsappSent = 0;
    for (const r of actRows) {
      if (r.activity_type === "call" || r.activity_type === "call_outcome") {
        callsMade += r.cnt;
      } else if (r.activity_type === "whatsapp") {
        whatsappSent += r.cnt;
      }
    }

    const connectedRow = db
      .prepare(
        `
        SELECT COUNT(*) AS cnt
        FROM leads
        WHERE assigned_to = ?
          AND date(last_attempt_at, 'localtime') = ?
          AND call_outcome = 'connected'
      `
      )
      .get(userId, dateStr) as { cnt: number } | undefined;

    const convRow = db
      .prepare(
        `
        SELECT COUNT(*) AS cnt
        FROM leads
        WHERE assigned_to = ?
          AND status = 'Converted'
          AND date(updated_at, 'localtime') = ?
      `
      )
      .get(userId, dateStr) as { cnt: number } | undefined;

    const taskRow = db
      .prepare(
        `
        SELECT COUNT(DISTINCT task_id) AS cnt
        FROM work_task_logs
        WHERE user_id = ? AND action = 'completed' AND cycle_date = ?
      `
      )
      .get(userId, dateStr) as { cnt: number } | undefined;

    return {
      callsMade,
      connectedCalls: connectedRow?.cnt || 0,
      whatsappSent,
      tasksCompleted: taskRow?.cnt || 0,
      conversions: convRow?.cnt || 0,
    };
  }

  static getEffectiveTarget(userId: string): DailyTarget {
    const db = getDatabase();
    const override = db
      .prepare(`SELECT * FROM daily_targets WHERE user_id = ?`)
      .get(userId) as any;
    if (override) {
      return {
        id: override.id,
        user_id: override.user_id,
        calls_target: override.calls_target,
        connected_target: override.connected_target,
        whatsapp_target: override.whatsapp_target,
        tasks_target: override.tasks_target,
        conversions_target: override.conversions_target,
        is_override: true,
      };
    }

    const teamDefault = db
      .prepare(`SELECT * FROM daily_targets WHERE user_id IS NULL`)
      .get() as any;
    if (teamDefault) {
      return {
        id: teamDefault.id,
        user_id: null,
        calls_target: teamDefault.calls_target,
        connected_target: teamDefault.connected_target,
        whatsapp_target: teamDefault.whatsapp_target,
        tasks_target: teamDefault.tasks_target,
        conversions_target: teamDefault.conversions_target,
        is_override: false,
      };
    }
    return { ...DEFAULT_TARGET };
  }

  static getMyDailyOps(userId: string): {
    checkin: DailyCheckin | null;
    autoStats: DailyAutoStats;
    target: DailyTarget;
  } {
    const db = getDatabase();
    const today = getTodayDateStr();
    const row = db
      .prepare(`SELECT * FROM daily_checkins WHERE user_id = ? AND checkin_date = ?`)
      .get(userId, today) as any;

    const checkin: DailyCheckin | null = row
      ? {
          ...row,
          eod_auto_stats: row.eod_auto_stats ? JSON.parse(row.eod_auto_stats) : null,
        }
      : null;

    return {
      checkin,
      autoStats: this.getTodayAutoStats(userId, today),
      target: this.getEffectiveTarget(userId),
    };
  }

  static checkIn(userId: string, morningFocus: string, presence: PresenceStatus = "available"): DailyCheckin {
    const db = getDatabase();
    const today = getTodayDateStr();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO daily_checkins (user_id, checkin_date, presence_status, morning_focus, checked_in_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, checkin_date) DO UPDATE SET
        presence_status = excluded.presence_status,
        morning_focus = COALESCE(NULLIF(excluded.morning_focus, ''), daily_checkins.morning_focus),
        checked_in_at = COALESCE(daily_checkins.checked_in_at, excluded.checked_in_at),
        updated_at = excluded.updated_at
    `
    ).run(userId, today, presence, morningFocus.trim() || null, now, now);

    SyncService.publish("system", userId);
    return this.getMyDailyOps(userId).checkin!;
  }

  static updatePresence(userId: string, presence: PresenceStatus): DailyCheckin {
    const db = getDatabase();
    const today = getTodayDateStr();
    const now = new Date().toISOString();

    db.prepare(
      `
      INSERT INTO daily_checkins (user_id, checkin_date, presence_status, checked_in_at, updated_at)
      VALUES (?, ?, ?, NULL, ?)
      ON CONFLICT(user_id, checkin_date) DO UPDATE SET
        presence_status = excluded.presence_status,
        updated_at = excluded.updated_at
    `
    ).run(userId, today, presence, now);

    SyncService.publish("system", userId);
    return this.getMyDailyOps(userId).checkin!;
  }

  static submitEod(userId: string, notes: string, blockers: string): DailyCheckin {
    const db = getDatabase();
    const today = getTodayDateStr();
    const now = new Date().toISOString();
    const stats = this.getTodayAutoStats(userId, today);

    db.prepare(
      `
      INSERT INTO daily_checkins (
        user_id, checkin_date, presence_status, checked_in_at,
        eod_submitted_at, eod_notes, eod_blockers, eod_auto_stats, updated_at
      )
      VALUES (?, ?, 'wrap_up', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, checkin_date) DO UPDATE SET
        presence_status = 'wrap_up',
        eod_submitted_at = excluded.eod_submitted_at,
        eod_notes = excluded.eod_notes,
        eod_blockers = excluded.eod_blockers,
        eod_auto_stats = excluded.eod_auto_stats,
        updated_at = excluded.updated_at
    `
    ).run(
      userId,
      today,
      now,
      now,
      notes.trim() || null,
      blockers.trim() || null,
      JSON.stringify(stats),
      now
    );

    SyncService.publish("system", userId);
    return this.getMyDailyOps(userId).checkin!;
  }

  static listTargets(): { defaultTarget: DailyTarget; overrides: DailyTarget[] } {
    const db = getDatabase();
    const rows = db.prepare(`SELECT * FROM daily_targets`).all() as any[];
    let defaultTarget: DailyTarget = { ...DEFAULT_TARGET };
    const overrides: DailyTarget[] = [];

    for (const r of rows) {
      const mapped: DailyTarget = {
        id: r.id,
        user_id: r.user_id,
        calls_target: r.calls_target,
        connected_target: r.connected_target,
        whatsapp_target: r.whatsapp_target,
        tasks_target: r.tasks_target,
        conversions_target: r.conversions_target,
        is_override: Boolean(r.user_id),
      };
      if (!r.user_id) {
        defaultTarget = mapped;
      } else {
        overrides.push(mapped);
      }
    }
    return { defaultTarget, overrides };
  }

  static upsertTarget(
    input: {
      user_id?: string | null;
      calls_target: number;
      connected_target: number;
      whatsapp_target: number;
      tasks_target: number;
      conversions_target: number;
    },
    updatedBy: string
  ): DailyTarget {
    const db = getDatabase();
    const userId = input.user_id ? String(input.user_id).trim() : null;
    const now = new Date().toISOString();

    if (!userId) {
      const existing = db.prepare(`SELECT id FROM daily_targets WHERE user_id IS NULL`).get() as any;
      if (existing) {
        db.prepare(
          `UPDATE daily_targets SET calls_target = ?, connected_target = ?, whatsapp_target = ?, tasks_target = ?, conversions_target = ?, updated_by = ?, updated_at = ? WHERE id = ?`
        ).run(
          Math.max(1, input.calls_target),
          Math.max(0, input.connected_target),
          Math.max(0, input.whatsapp_target),
          Math.max(1, input.tasks_target),
          Math.max(0, input.conversions_target),
          updatedBy,
          now,
          existing.id
        );
      } else {
        db.prepare(
          `INSERT INTO daily_targets (user_id, calls_target, connected_target, whatsapp_target, tasks_target, conversions_target, updated_by, updated_at) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          Math.max(1, input.calls_target),
          Math.max(0, input.connected_target),
          Math.max(0, input.whatsapp_target),
          Math.max(1, input.tasks_target),
          Math.max(0, input.conversions_target),
          updatedBy,
          now
        );
      }
      return this.listTargets().defaultTarget;
    }

    const existing = db.prepare(`SELECT id FROM daily_targets WHERE user_id = ?`).get(userId) as any;
    if (existing) {
      db.prepare(
        `UPDATE daily_targets SET calls_target = ?, connected_target = ?, whatsapp_target = ?, tasks_target = ?, conversions_target = ?, updated_by = ?, updated_at = ? WHERE id = ?`
      ).run(
        Math.max(1, input.calls_target),
        Math.max(0, input.connected_target),
        Math.max(0, input.whatsapp_target),
        Math.max(1, input.tasks_target),
        Math.max(0, input.conversions_target),
        updatedBy,
        now,
        existing.id
      );
    } else {
      db.prepare(
        `INSERT INTO daily_targets (user_id, calls_target, connected_target, whatsapp_target, tasks_target, conversions_target, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        userId,
        Math.max(1, input.calls_target),
        Math.max(0, input.connected_target),
        Math.max(0, input.whatsapp_target),
        Math.max(1, input.tasks_target),
        Math.max(0, input.conversions_target),
        updatedBy,
        now
      );
    }

    SyncService.publish("system", userId);
    return this.getEffectiveTarget(userId);
  }

  static getTeamFloorSnapshot(viewer: { userId: string; role: string }, filterTeamLeadId?: string): TeamFloorMember[] {
    const db = getDatabase();
    const today = getTodayDateStr();
    const nowMs = Date.now();

    const users = db
      .prepare(
        `
        SELECT u.*, tl.name AS team_lead_name, COUNT(l.id) AS assigned_count
        FROM users u
        LEFT JOIN users tl ON u.team_lead_id = tl.id
        LEFT JOIN leads l ON u.id = l.assigned_to
        WHERE u.status = 'active'
        GROUP BY u.id
        ORDER BY u.name ASC
      `
      )
      .all() as User[];

    const scopedUsers = users.filter((u) => {
      if (u.role === "admin") return false;
      if (viewer.role === "team_lead") {
        // Team lead sees their own pod + themselves
        return u.team_lead_id === viewer.userId || u.id === viewer.userId;
      }
      if (filterTeamLeadId && filterTeamLeadId !== "all") {
        if (filterTeamLeadId === "__unassigned__") {
          return !u.team_lead_id && u.role !== "team_lead";
        }
        return u.team_lead_id === filterTeamLeadId || u.id === filterTeamLeadId;
      }
      return true;
    });

    const checkins = db
      .prepare(`SELECT * FROM daily_checkins WHERE checkin_date = ?`)
      .all(today) as any[];
    const checkinMap = new Map<string, DailyCheckin>();
    for (const c of checkins) {
      checkinMap.set(c.user_id, {
        ...c,
        eod_auto_stats: c.eod_auto_stats ? JSON.parse(c.eod_auto_stats) : null,
      });
    }

    const allTasks = WorkTasksService.listWorkTasks({ canViewAll: true, includeArchived: false });

    const freshRows = db
      .prepare(
        `SELECT assigned_to, COUNT(*) AS cnt FROM leads WHERE status = 'New' AND assigned_to IS NOT NULL GROUP BY assigned_to`
      )
      .all() as { assigned_to: string; cnt: number }[];
    const freshMap = new Map(freshRows.map((r) => [r.assigned_to, r.cnt]));

    return scopedUsers.map((user) => {
      const checkin = checkinMap.get(user.id) || null;
      const autoStats = this.getTodayAutoStats(user.id, today);
      const target = this.getEffectiveTarget(user.id);
      const userTasks = allTasks.filter((t) => t.assigned_to === user.id);

      let todo = 0;
      let inProgress = 0;
      let overdue = 0;
      let pendingReview = 0;
      let nudged = 0;
      let completedToday = 0;

      for (const t of userTasks) {
        if (t.status === "todo") todo += 1;
        if (t.status === "in_progress") inProgress += 1;
        if (t.approval_status === "pending_review") pendingReview += 1;
        if ((t.nudge_count || 0) > 0 && t.status !== "done") nudged += 1;
        if (t.status === "done" && t.last_completed_at && t.last_completed_at.slice(0, 10) === today) {
          completedToday += 1;
        }
        if (t.status !== "done" && t.due_at) {
          const dueMs = new Date(t.due_at).getTime();
          if (!isNaN(dueMs) && dueMs < nowMs) {
            overdue += 1;
          }
        }
      }

      const freshLeadsRemaining = freshMap.get(user.id) || 0;
      const bottlenecks: string[] = [];
      if (overdue > 0) bottlenecks.push(`${overdue} Overdue Task${overdue > 1 ? "s" : ""}`);
      if (pendingReview > 0) bottlenecks.push(`${pendingReview} Pending Sign-off`);
      if (freshLeadsRemaining === 0 && (user.assigned_count || 0) > 0) bottlenecks.push("0 Fresh Leads");
      if (!checkin?.checked_in_at) bottlenecks.push("Not Checked In");

      return {
        user,
        checkin,
        autoStats,
        target,
        tasks: {
          todo,
          inProgress,
          overdue,
          pendingReview,
          completedToday,
          nudged,
        },
        freshLeadsRemaining,
        bottlenecks,
      };
    });
  }

  static listTemplates(): WorkTaskTemplate[] {
    const db = getDatabase();
    let rows = db
      .prepare(`SELECT * FROM work_task_templates WHERE is_active = 1 ORDER BY playbook_slot ASC, id ASC`)
      .all() as any[];

    if (rows.length === 0) {
      const seedTemplates = [
        {
          title: "Morning Dialer & Callback Check",
          description: "Review overdue callbacks, check fresh assigned leads, and verify calling setup.",
          task_type: "recurring",
          recurrence_rule: "daily",
          time_limit_minutes: 20,
          priority: "high",
          requires_proof: 0,
          requires_approval: 0,
          playbook_slot: "morning",
          checklist: ["Clear overdue callbacks", "Claim or review fresh leads", "Set Morning Check-in focus"],
        },
        {
          title: "Midday Warm Prospect Follow-up",
          description: "Call back morning interested leads and send WhatsApp brochure details.",
          task_type: "one_time",
          recurrence_rule: null,
          time_limit_minutes: 45,
          priority: "normal",
          requires_proof: 1,
          requires_approval: 0,
          playbook_slot: "midday",
          checklist: ["Follow up warm callbacks", "Send WhatsApp brochure to interested parents"],
        },
        {
          title: "Evening Pipeline Hygiene & EOD",
          description: "Update all pending call outcomes, clean tomorrow's callbacks, and submit EOD.",
          task_type: "recurring",
          recurrence_rule: "daily",
          time_limit_minutes: 20,
          priority: "high",
          requires_proof: 1,
          requires_approval: 1,
          playbook_slot: "evening",
          checklist: ["Update pending dispositions", "Schedule tomorrow's callbacks", "Submit EOD summary"],
        },
      ];

      const ins = db.prepare(
        `
        INSERT INTO work_task_templates (
          title, description, task_type, recurrence_rule, time_limit_minutes,
          priority, requires_proof, requires_approval, playbook_slot, checklist_json, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'system')
      `
      );
      for (const s of seedTemplates) {
        ins.run(
          s.title,
          s.description,
          s.task_type,
          s.recurrence_rule,
          s.time_limit_minutes,
          s.priority,
          s.requires_proof,
          s.requires_approval,
          s.playbook_slot,
          JSON.stringify(s.checklist)
        );
      }
      rows = db
        .prepare(`SELECT * FROM work_task_templates WHERE is_active = 1 ORDER BY playbook_slot ASC, id ASC`)
        .all() as any[];
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      task_type: r.task_type as WorkTaskType,
      recurrence_rule: r.recurrence_rule as WorkTaskRecurrence | null,
      time_limit_minutes: r.time_limit_minutes,
      priority: r.priority as TaskPriority,
      requires_proof: Boolean(r.requires_proof),
      requires_approval: Boolean(r.requires_approval),
      playbook_slot: r.playbook_slot,
      checklist: r.checklist_json ? JSON.parse(r.checklist_json) : [],
      is_active: Boolean(r.is_active),
      created_by: r.created_by,
      created_at: r.created_at,
    }));
  }

  static createTemplate(input: {
    title: string;
    description?: string | null;
    task_type?: WorkTaskType;
    recurrence_rule?: WorkTaskRecurrence | null;
    time_limit_minutes?: number | null;
    priority?: TaskPriority;
    requires_proof?: boolean;
    requires_approval?: boolean;
    playbook_slot?: "morning" | "midday" | "evening" | "custom";
    checklist?: string[];
    created_by: string;
  }): WorkTaskTemplate {
    const db = getDatabase();
    const info = db
      .prepare(
        `
        INSERT INTO work_task_templates (
          title, description, task_type, recurrence_rule, time_limit_minutes,
          priority, requires_proof, requires_approval, playbook_slot, checklist_json, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        input.title.trim(),
        input.description?.trim() || null,
        input.task_type || "one_time",
        input.task_type === "recurring" ? input.recurrence_rule || "daily" : null,
        input.time_limit_minutes || null,
        input.priority || "normal",
        input.requires_proof ? 1 : 0,
        input.requires_approval ? 1 : 0,
        input.playbook_slot || "custom",
        JSON.stringify((input.checklist || []).map((c) => c.trim()).filter(Boolean)),
        input.created_by
      );

    const created = this.listTemplates().find((t) => t.id === Number(info.lastInsertRowid));
    return created!;
  }

  static deleteTemplate(templateId: number): void {
    const db = getDatabase();
    db.prepare(`UPDATE work_task_templates SET is_active = 0 WHERE id = ?`).run(templateId);
  }

  static deployPlaybook(input: {
    templateIds: number[];
    targetUserIds: string[];
    assignedBy: { id: string; name: string };
  }): { createdCount: number; skippedDuplicates: number } {
    const db = getDatabase();
    const today = getTodayDateStr();
    const templates = this.listTemplates().filter((t) => input.templateIds.includes(t.id));
    let createdCount = 0;
    let skippedDuplicates = 0;

    for (const tpl of templates) {
      for (const userId of input.targetUserIds) {
        // Avoid duplicating same template for same user on the same day
        const dup = db
          .prepare(
            `
            SELECT id FROM work_tasks
            WHERE template_id = ? AND assigned_to = ? AND is_archived = 0
              AND (date(created_at, 'localtime') = ? OR status != 'done')
            LIMIT 1
          `
          )
          .get(tpl.id, userId, today);

        if (dup) {
          skippedDuplicates += 1;
          continue;
        }

        WorkTasksService.createWorkTask({
          title: tpl.title,
          description: tpl.description,
          task_type: tpl.task_type,
          recurrence_rule: tpl.recurrence_rule,
          time_limit_minutes: tpl.time_limit_minutes,
          priority: tpl.priority,
          assigned_to: userId,
          created_by: input.assignedBy.id,
          created_by_name: input.assignedBy.name,
          checklist: tpl.checklist,
          requires_proof: tpl.requires_proof,
          requires_approval: tpl.requires_approval,
          template_id: tpl.id,
        });
        createdCount += 1;
      }
    }

    return { createdCount, skippedDuplicates };
  }
}
