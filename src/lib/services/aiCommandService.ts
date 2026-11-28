import { getDatabase } from "@/lib/db/database";
import { AiCopilotService } from "@/lib/services/aiCopilotService";
import { DailyOpsService } from "@/lib/services/dailyOpsService";
import { LeadsService } from "@/lib/services/leadsService";
import {
  AiCommandResponse,
  AiProposedAction,
  FilterParams,
  PresenceStatus,
  User,
} from "@/types/crm";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function isOpsRole(user: User): boolean {
  return ["admin", "team_lead"].includes(user.role);
}

function buildFilterParams(raw: any, user: User): FilterParams {
  const fp: FilterParams = {};
  if (raw?.search) fp.search = String(raw.search).trim();
  if (Array.isArray(raw?.status) && raw.status.length > 0) {
    fp.status = raw.status.map(String);
  }
  if (Array.isArray(raw?.campaign) && raw.campaign.length > 0) {
    fp.facets = { ...(fp.facets || {}), campaign: raw.campaign.map(String) };
  }
  if (Array.isArray(raw?.campaign_id) && raw.campaign_id.length > 0) {
    fp.campaign_id = raw.campaign_id.map(String);
  }
  if (Array.isArray(raw?.assigned_to) && raw.assigned_to.length > 0) {
    fp.assigned_to = raw.assigned_to.map(String);
  }
  // Counselors are always scoped to their own leads
  if (!isOpsRole(user)) {
    fp.assigned_to = [user.id];
  }
  return fp;
}

async function callGeminiJson(systemPrompt: string, userPrompt: string): Promise<any> {
  const cfg = AiCopilotService.getRawSettings();
  if (!cfg.is_enabled) {
    throw new Error("AI Copilot is disabled in Admin Settings.");
  }
  if (!cfg.raw_api_key) {
    throw new Error(
      "Gemini API Key is not configured yet. Ask an Admin to add it in WhatsApp → Kapso Setup."
    );
  }

  const res = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(cfg.model || "gemini-2.5-flash")}:generateContent?key=${encodeURIComponent(cfg.raw_api_key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.25,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Gemini API error (HTTP ${res.status})`);
  }

  const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("Gemini returned an empty response.");

  try {
    return JSON.parse(rawText);
  } catch {
    const cleaned = String(rawText)
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned);
  }
}

function getScopedMetrics(user: User) {
  const db = getDatabase();
  const ops = isOpsRole(user);
  const todayStr = new Date().toISOString().slice(0, 10);

  const myLeadsCount = (
    db
      .prepare(
        ops
          ? `SELECT COUNT(*) as c FROM leads`
          : `SELECT COUNT(*) as c FROM leads WHERE assigned_to = ?`
      )
      .get(...(ops ? [] : [user.id])) as { c: number }
  ).c;

  const statusBreakdown = db
    .prepare(
      ops
        ? `SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC LIMIT 12`
        : `SELECT status, COUNT(*) as count FROM leads WHERE assigned_to = ? GROUP BY status ORDER BY count DESC LIMIT 12`
    )
    .all(...(ops ? [] : [user.id])) as { status: string; count: number }[];

  const pendingTasks = (
    db
      .prepare(
        ops
          ? `SELECT COUNT(*) as c FROM crm_tasks WHERE status = 'pending'`
          : `SELECT COUNT(*) as c FROM crm_tasks WHERE status = 'pending' AND assigned_to = ?`
      )
      .get(...(ops ? [] : [user.id])) as { c: number }
  ).c;

  const overdueTasks = (
    db
      .prepare(
        ops
          ? `SELECT COUNT(*) as c FROM crm_tasks WHERE status = 'pending' AND due_date < ?`
          : `SELECT COUNT(*) as c FROM crm_tasks WHERE status = 'pending' AND assigned_to = ? AND due_date < ?`
      )
      .get(...(ops ? [new Date().toISOString()] : [user.id, new Date().toISOString()])) as {
      c: number;
    }
  ).c;

  const openWaThreads = (
    db
      .prepare(
        ops
          ? `SELECT COUNT(*) as c FROM whatsapp_conversations WHERE status = 'open'`
          : `SELECT COUNT(*) as c FROM whatsapp_conversations WHERE status = 'open' AND assigned_to = ?`
      )
      .get(...(ops ? [] : [user.id])) as { c: number }
  ).c;

  const unreadWaThreads = (
    db
      .prepare(
        ops
          ? `SELECT COUNT(*) as c FROM whatsapp_conversations WHERE unread_count > 0`
          : `SELECT COUNT(*) as c FROM whatsapp_conversations WHERE unread_count > 0 AND assigned_to = ?`
      )
      .get(...(ops ? [] : [user.id])) as { c: number }
  ).c;

  const myCheckin = db
    .prepare(`SELECT presence_status, checked_in_at, morning_focus FROM daily_checkins WHERE user_id = ? AND checkin_date = ?`)
    .get(user.id, todayStr) as any;

  let opsExtra: any = {};
  if (ops) {
    const unassignedCount = (
      db.prepare(`SELECT COUNT(*) as c FROM leads WHERE assigned_to IS NULL OR assigned_to = ''`).get() as {
        c: number;
      }
    ).c;
    const counselorWorkloads = db
      .prepare(
        `SELECT u.id, u.name, u.role, COUNT(l.id) as lead_count,
                (SELECT dc.presence_status FROM daily_checkins dc WHERE dc.user_id = u.id AND dc.checkin_date = ? LIMIT 1) as presence
         FROM users u
         LEFT JOIN leads l ON l.assigned_to = u.id
         WHERE u.is_active = 1 AND u.role IN ('counselor', 'senior_counselor', 'telecaller')
         GROUP BY u.id
         ORDER BY lead_count DESC`
      )
      .all(todayStr) as any[];
    const campaigns = db
      .prepare(
        `SELECT COALESCE(c.name, l.campaign, 'Uncategorized') as campaign, COUNT(*) as count
         FROM leads l
         LEFT JOIN campaigns c ON l.campaign_id = c.id
         GROUP BY COALESCE(c.name, l.campaign, 'Uncategorized')
         ORDER BY count DESC
         LIMIT 10`
      )
      .all() as any[];

    opsExtra = {
      unassignedCount,
      counselorWorkloads,
      campaigns,
    };
  }

  return {
    role: user.role,
    isOps: ops,
    todayDate: todayStr,
    myLeadsCount,
    statusBreakdown,
    pendingTasks,
    overdueTasks,
    openWaThreads,
    unreadWaThreads,
    myPresence: myCheckin?.presence_status || "not_checked_in",
    checkedInAt: myCheckin?.checked_in_at || null,
    ...opsExtra,
  };
}

export const AiCommandService = {
  async getShiftBrief(user: User): Promise<AiCommandResponse> {
    const metrics = getScopedMetrics(user);

    const systemPrompt = `You are DreamDesk CRM's Operations & Counselor AI Copilot.
Generate a crisp, motivating Daily Shift Brief for "${user.name}" (${user.role}).
Return strictly valid JSON:
{
  "answer": "2-3 concise sentences highlighting today's top priorities based strictly on the metrics provided.",
  "highlights": [
    { "label": "Short KPI label", "value": "Value" }
  ]
}
Include 3 to 4 highlights.`;

    const parsed = await callGeminiJson(systemPrompt, JSON.stringify(metrics, null, 2));
    return {
      answer: String(parsed?.answer || "Ready for your shift."),
      highlights: Array.isArray(parsed?.highlights)
        ? parsed.highlights.slice(0, 4).map((h: any) => ({
            label: String(h?.label || ""),
            value: String(h?.value || ""),
          }))
        : [],
      applyFilters: null,
      proposedAction: null,
    };
  },

  async planCommand(params: {
    prompt: string;
    currentView?: string;
    user: User;
  }): Promise<AiCommandResponse> {
    const metrics = getScopedMetrics(params.user);
    const ops = isOpsRole(params.user);

    const systemPrompt = `You are DreamDesk CRM's Global AI Copilot.
Current user: "${params.user.name}" (role: "${params.user.role}", isOps: ${ops}, currentView: "${params.currentView || "leads"}").

Live CRM Context (use ONLY these real numbers, counselor IDs, statuses, and campaigns):
${JSON.stringify(metrics, null, 2)}

Capabilities you can return in JSON:
1. Analytical Answers & Reports: Answer questions about leads, workload, campaigns, WhatsApp inbox, tasks, or team status using the live metrics above.
2. Smart Filters / Navigation ("applyFilters"): Help the user jump to a view ("leads", "whatsapp", "tasks", "dashboard", "assignments", "team", "analytics") or filter the Leads table by search, status[], campaign[], assigned_to[].
3. Confirmable Actions ("proposedAction"):
   - "set_presence": Change the current user's availability status. Valid presence values: "available", "on_break", "in_meeting", "away", "offline".
   ${
     ops
       ? `- "bulk_status": Update lead status for filtered leads. Payload: { "filter_params": { "search"?, "status"?, "campaign"?, "assigned_to"? }, "status": "New Lead" | "Contacted" | "Follow-up" | "Interested" | "Converted" | "Cold" | "Not Interested" | string }
   - "bulk_assign": Assign filtered leads to a counselor (mode: "single" with target_user_id from counselorWorkloads, or "auto" round-robin). Payload: { "filter_params": {...}, "mode": "single" | "auto", "target_user_id"?: string, "total_to_assign"?: number }
   - "bulk_tag": Add tags to filtered leads. Payload: { "filter_params": {...}, "tags": ["string"] }`
       : `- IMPORTANT: User is NOT an Admin/Team Lead. NEVER propose "bulk_assign", "bulk_status", or "bulk_tag". If they ask to bulk reassign or view team-wide admin reports, politely explain that it requires Admin or Team Lead access.`
   }

Return strictly valid JSON:
{
  "answer": "Clear, concise answer or explanation of the proposed action.",
  "highlights": [{ "label": "string", "value": "string" }],
  "applyFilters": { "search"?: "string", "status"?: ["string"], "campaign"?: ["string"], "assigned_to"?: ["string"], "view"?: "string" } | null,
  "proposedAction": {
    "type": "bulk_status" | "bulk_assign" | "bulk_tag" | "set_presence",
    "title": "Short button/card title",
    "summary": "Exact human-readable summary of what will change",
    "payload": {}
  } | null
}`;

    const parsed = await callGeminiJson(systemPrompt, params.prompt);

    let proposedAction: AiProposedAction | null = null;
    if (parsed?.proposedAction?.type) {
      const pType = String(parsed.proposedAction.type);
      const rawPayload = parsed.proposedAction.payload || {};

      if (pType === "set_presence") {
        const validPresences = new Set(["available", "on_break", "in_meeting", "away", "offline"]);
        const presence = validPresences.has(rawPayload?.presence) ? rawPayload.presence : "available";
        proposedAction = {
          type: "set_presence",
          title: String(parsed.proposedAction.title || `Set status to ${presence}`),
          summary: String(parsed.proposedAction.summary || `Update your CRM presence status to "${presence}".`),
          affectedCount: 1,
          payload: { presence },
        };
      } else if (ops && ["bulk_status", "bulk_assign", "bulk_tag"].includes(pType)) {
        const filterParams = buildFilterParams(rawPayload.filter_params || {}, params.user);
        const limit =
          pType === "bulk_assign" && rawPayload.total_to_assign
            ? Number(rawPayload.total_to_assign)
            : undefined;
        const targetIds = LeadsService.getTargetLeadIds(filterParams, limit);
        proposedAction = {
          type: pType as any,
          title: String(parsed.proposedAction.title || "Proposed Bulk Action"),
          summary: String(parsed.proposedAction.summary || "Apply bulk update to matching leads."),
          affectedCount: targetIds.length,
          payload: {
            ...rawPayload,
            filter_params: filterParams,
          },
        };
      }
    }

    return {
      answer: String(parsed?.answer || "Done."),
      highlights: Array.isArray(parsed?.highlights)
        ? parsed.highlights.slice(0, 6).map((h: any) => ({
            label: String(h?.label || ""),
            value: String(h?.value || ""),
          }))
        : [],
      applyFilters: parsed?.applyFilters || null,
      proposedAction,
    };
  },

  async executeAction(params: {
    action: AiProposedAction;
    user: User;
  }): Promise<{ success: boolean; message: string; affectedCount?: number }> {
    const { action, user } = params;
    const ops = isOpsRole(user);

    if (action.type === "set_presence") {
      const presence = String(action.payload?.presence || "available") as PresenceStatus;
      DailyOpsService.updatePresence(user.id, presence);
      return {
        success: true,
        message: `Updated your status to "${presence}".`,
        affectedCount: 1,
      };
    }

    if (!ops) {
      throw new Error("Forbidden: Bulk operations require Admin or Team Lead role.");
    }

    const filterParams = buildFilterParams(action.payload?.filter_params || {}, user);

    if (action.type === "bulk_status") {
      const newStatus = String(action.payload?.status || "").trim();
      if (!newStatus) throw new Error("Target status is required.");
      const affected = LeadsService.bulkUpdateStatus([], newStatus, true, filterParams);
      return {
        success: true,
        message: `Updated ${affected} lead(s) to status "${newStatus}".`,
        affectedCount: affected,
      };
    }

    if (action.type === "bulk_assign") {
      const mode = action.payload?.mode === "single" ? "single" : "auto";
      const res = LeadsService.bulkAssign(
        {
          mode,
          apply_to_all_filtered: true,
          filter_params: filterParams,
          single_user_id: action.payload?.target_user_id
            ? String(action.payload.target_user_id)
            : action.payload?.single_user_id
            ? String(action.payload.single_user_id)
            : undefined,
          total_to_assign: action.payload?.total_to_assign
            ? Number(action.payload.total_to_assign)
            : undefined,
          assignment_name: `AI Copilot Assign`,
        },
        user
      );
      return {
        success: true,
        message: res.message || `Assigned ${res.affectedCount} lead(s).`,
        affectedCount: res.affectedCount,
      };
    }

    if (action.type === "bulk_tag") {
      const tags: string[] = Array.isArray(action.payload?.tags)
        ? action.payload.tags.map(String).filter(Boolean)
        : [];
      if (tags.length === 0) throw new Error("At least one tag is required.");
      const res = LeadsService.bulkUpdateTags({
        lead_ids: [],
        action: "add",
        tags,
        apply_to_all_filtered: true,
        filter_params: filterParams,
        performed_by_name: `${user.name} (AI Copilot)`,
      });
      const affected = Number((res as any)?.affectedCount || 0);
      return {
        success: true,
        message: `Tagged ${affected} lead(s) with ${tags.join(", ")}.`,
        affectedCount: affected,
      };
    }

    throw new Error(`Unsupported AI action type: ${action.type}`);
  },
};
