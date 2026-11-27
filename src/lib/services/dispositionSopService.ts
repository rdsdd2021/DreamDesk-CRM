import { getDatabase } from "@/lib/db/database";
import { SyncService } from "@/lib/services/syncService";
import { WorkTasksService } from "@/lib/services/workTasksService";
import { DispositionSopRule, TaskPriority, User } from "@/types/crm";

export class DispositionSopService {
  static listRules(): DispositionSopRule[] {
    const db = getDatabase();
    const rows = db
      .prepare(
        `
        SELECT
          r.*,
          d.name AS disposition_name,
          sd.name AS sub_disposition_name,
          u.name AS specific_user_name,
          t.title AS template_title
        FROM disposition_sop_rules r
        LEFT JOIN dispositions d ON r.disposition_id = d.id
        LEFT JOIN sub_dispositions sd ON r.sub_disposition_id = sd.id
        LEFT JOIN users u ON r.specific_user_id = u.id
        LEFT JOIN work_task_templates t ON r.template_id = t.id
        WHERE r.is_active = 1
        ORDER BY r.id DESC
      `
      )
      .all() as any[];

    return rows.map((r) => ({
      ...r,
      requires_proof: Boolean(r.requires_proof),
      requires_approval: Boolean(r.requires_approval),
      is_active: Boolean(r.is_active),
    }));
  }

  static createRule(input: {
    disposition_id?: string | null;
    sub_disposition_id?: string | null;
    target_role: DispositionSopRule["target_role"];
    specific_user_id?: string | null;
    task_mode: DispositionSopRule["task_mode"];
    template_id?: number | null;
    title: string;
    description?: string | null;
    priority?: TaskPriority;
    sla_hours?: number;
    requires_proof?: boolean;
    requires_approval?: boolean;
    created_by: string;
  }): DispositionSopRule {
    const db = getDatabase();
    const info = db
      .prepare(
        `
        INSERT INTO disposition_sop_rules (
          disposition_id, sub_disposition_id, target_role, specific_user_id,
          task_mode, template_id, title, description, priority, sla_hours,
          requires_proof, requires_approval, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        input.disposition_id || null,
        input.sub_disposition_id || null,
        input.target_role || "lead_owner",
        input.specific_user_id || null,
        input.task_mode || "call_task",
        input.template_id || null,
        input.title.trim(),
        input.description?.trim() || null,
        input.priority || "high",
        Math.max(1, Number(input.sla_hours || 4)),
        input.requires_proof ? 1 : 0,
        input.requires_approval ? 1 : 0,
        input.created_by
      );

    return this.listRules().find((r) => r.id === Number(info.lastInsertRowid))!;
  }

  static deleteRule(ruleId: number): void {
    const db = getDatabase();
    db.prepare(`UPDATE disposition_sop_rules SET is_active = 0 WHERE id = ?`).run(ruleId);
  }

  private static resolveTargetUserId(
    rule: DispositionSopRule,
    lead: { assigned_to?: string | null },
    actor: User
  ): string {
    const db = getDatabase();

    if (rule.specific_user_id) {
      const activeUser = db
        .prepare(`SELECT id FROM users WHERE id = ? AND status = 'active'`)
        .get(rule.specific_user_id) as { id: string } | undefined;
      if (activeUser) return activeUser.id;
    }

    if (rule.target_role === "lead_owner") {
      return lead.assigned_to || actor.id;
    }

    if (rule.target_role === "team_lead") {
      const ownerId = lead.assigned_to || actor.id;
      const ownerRow = db
        .prepare(`SELECT team_lead_id FROM users WHERE id = ?`)
        .get(ownerId) as { team_lead_id?: string | null } | undefined;
      if (ownerRow?.team_lead_id) return ownerRow.team_lead_id;

      const anyTl = db
        .prepare(`SELECT id FROM users WHERE role = 'team_lead' AND status = 'active' LIMIT 1`)
        .get() as { id: string } | undefined;
      return anyTl?.id || "usr_admin";
    }

    // Specific role: prefer lead's current owner if they hold that role, else least-loaded active user in that role
    if (lead.assigned_to) {
      const ownerMatch = db
        .prepare(`SELECT id FROM users WHERE id = ? AND role = ? AND status = 'active'`)
        .get(lead.assigned_to, rule.target_role) as { id: string } | undefined;
      if (ownerMatch) return ownerMatch.id;
    }

    const roleUser = db
      .prepare(
        `
        SELECT u.id
        FROM users u
        LEFT JOIN leads l ON l.assigned_to = u.id
        WHERE u.role = ? AND u.status = 'active'
        GROUP BY u.id
        ORDER BY COUNT(l.id) ASC
        LIMIT 1
      `
      )
      .get(rule.target_role) as { id: string } | undefined;

    return roleUser?.id || lead.assigned_to || actor.id;
  }

  static executeTriggersForDisposition(params: {
    leadId: number;
    dispositionId: string | null;
    subDispositionId: string | null;
    actor: User;
  }): { createdCallTasks: number; createdDailyTasks: number } {
    if (!params.dispositionId && !params.subDispositionId) {
      return { createdCallTasks: 0, createdDailyTasks: 0 };
    }

    const db = getDatabase();
    const lead = db
      .prepare(`SELECT id, name, lead_code, assigned_to FROM leads WHERE id = ?`)
      .get(params.leadId) as { id: number; name: string; lead_code: string; assigned_to?: string | null } | undefined;
    if (!lead) return { createdCallTasks: 0, createdDailyTasks: 0 };

    const matchingRules = this.listRules().filter((r) => {
      const matchesSub = params.subDispositionId && r.sub_disposition_id === params.subDispositionId;
      const matchesDisp = params.dispositionId && r.disposition_id === params.dispositionId && !r.sub_disposition_id;
      return Boolean(matchesSub || matchesDisp);
    });

    if (matchingRules.length === 0) {
      return { createdCallTasks: 0, createdDailyTasks: 0 };
    }

    let createdCallTasks = 0;
    let createdDailyTasks = 0;

    for (const rule of matchingRules) {
      const targetUserId = this.resolveTargetUserId(rule, lead, params.actor);
      const dueDateIso = new Date(Date.now() + rule.sla_hours * 3600 * 1000).toISOString();
      const taskTitle = `${rule.title} — ${lead.name} (${lead.lead_code})`;

      // 1. Create Call Task (crm_tasks)
      if (rule.task_mode === "call_task" || rule.task_mode === "both") {
        db.prepare(
          `
          INSERT INTO crm_tasks (lead_id, assigned_to, title, description, priority, status, due_date, created_by, source_action)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 'disposition_sop')
        `
        ).run(
          lead.id,
          targetUserId,
          taskTitle,
          rule.description || `Triggered by disposition SOP (${rule.disposition_name || "Outcome"})`,
          rule.priority,
          dueDateIso,
          params.actor.id
        );

        db.prepare(
          `
          INSERT INTO user_notifications (user_id, title, message, type, priority, metadata)
          VALUES (?, ?, ?, 'task', ?, ?)
        `
        ).run(
          targetUserId,
          "SOP Call Task Triggered",
          `${taskTitle} (due in ${rule.sla_hours}h)`,
          rule.priority,
          JSON.stringify({ lead_id: lead.id, rule_id: rule.id })
        );
        createdCallTasks += 1;
      }

      // 2. Create Daily Work Task (work_tasks)
      if (rule.task_mode === "daily_task" || rule.task_mode === "both") {
        let checklist: string[] | undefined;
        let tplDesc: string | null = rule.description;

        if (rule.template_id) {
          const tpl = db
            .prepare(`SELECT description, checklist_json FROM work_task_templates WHERE id = ?`)
            .get(rule.template_id) as { description?: string; checklist_json?: string } | undefined;
          if (tpl) {
            if (!tplDesc && tpl.description) tplDesc = tpl.description;
            try {
              const parsed = tpl.checklist_json ? JSON.parse(tpl.checklist_json) : [];
              if (Array.isArray(parsed) && parsed.length > 0) checklist = parsed;
            } catch {}
          }
        }

        WorkTasksService.createWorkTask({
          title: taskTitle,
          description: tplDesc || `Triggered from lead ${lead.lead_code} (${lead.name})`,
          task_type: "one_time",
          due_at: dueDateIso,
          priority: rule.priority,
          assigned_to: targetUserId,
          created_by: params.actor.id,
          created_by_name: params.actor.name,
          checklist,
          requires_proof: rule.requires_proof,
          requires_approval: rule.requires_approval,
          template_id: rule.template_id,
        });
        createdDailyTasks += 1;
      }
    }

    if (createdCallTasks > 0 || createdDailyTasks > 0) {
      SyncService.publish("task_updated", String(lead.id));
    }

    return { createdCallTasks, createdDailyTasks };
  }
}
