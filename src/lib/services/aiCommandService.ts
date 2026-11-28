import { getDatabase } from "@/lib/db/database";
import { AiCopilotService } from "@/lib/services/aiCopilotService";
import { DailyOpsService } from "@/lib/services/dailyOpsService";
import { LeadsService } from "@/lib/services/leadsService";
import { SyncService } from "@/lib/services/syncService";
import {
  AiCommandResponse,
  AiProposedAction,
  AiUiBlock,
  AiWorkflowStepResult,
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
  if (Array.isArray(raw?.campaign_id) && raw.campaign_id.length > 0) {
    fp.campaign_id = raw.campaign_id.map(String);
  } else if (Array.isArray(raw?.campaign) && raw.campaign.length > 0) {
    fp.campaign_id = raw.campaign.map(String);
  }
  if (Array.isArray(raw?.disposition_id) && raw.disposition_id.length > 0) {
    fp.disposition_id = raw.disposition_id.map(String);
  }
  if (Array.isArray(raw?.tags) && raw.tags.length > 0) {
    fp.tags = raw.tags.map(String);
  }
  if (
    raw?.calling_recency &&
    ["uncalled_today", "never_called", "called_today", "all"].includes(String(raw.calling_recency))
  ) {
    fp.calling_recency = String(raw.calling_recency) as FilterParams["calling_recency"];
  }
  if (raw?.facets && typeof raw.facets === "object") {
    const cleanFacets: Record<string, string[]> = {};
    for (const [k, vals] of Object.entries(raw.facets)) {
      if (Array.isArray(vals) && vals.length > 0) {
        cleanFacets[k] = vals.map(String);
      }
    }
    if (Object.keys(cleanFacets).length > 0) {
      fp.facets = { ...(fp.facets || {}), ...cleanFacets };
    }
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

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "all", "are", "was", "have", "has",
  "lead", "leads", "assign", "assigned", "unassigned", "matching", "match", "filter",
  "show", "find", "give", "tell", "many", "how", "what", "which", "who", "status",
  "counselor", "counselors", "today", "tomorrow", "create", "task", "tasks", "tag",
  "tags", "move", "change", "set", "update", "into", "across", "batch", "report",
]);

function findPromptFacetMatches(
  prompt: string,
  facets: Array<{ key_name: string; display_label: string; options: { value: string; count: number }[] }>
) {
  const tokens = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

  if (tokens.length === 0) return [];

  const matches: Array<{ facet_key: string; display_label: string; value: string; count: number }> = [];
  for (const fg of facets) {
    for (const opt of fg.options || []) {
      const val = String(opt.value || "").trim();
      if (!val || val === "Unspecified" || val === "Unassigned") continue;
      const valLower = val.toLowerCase();
      const valWords = valLower.split(/[\s,._-]+/).filter((w) => w.length >= 3);

      let matched = false;
      for (const tok of tokens) {
        if (valLower.includes(tok) || (tok.length >= 4 && valWords.some((w) => w.includes(tok)))) {
          matched = true;
          break;
        }
        if (tok.length >= 4) {
          for (const vw of valWords) {
            if (Math.abs(vw.length - tok.length) <= 2 && levenshtein(tok, vw) <= 2) {
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
      }

      if (matched) {
        matches.push({
          facet_key: fg.key_name,
          display_label: fg.display_label,
          value: val,
          count: opt.count,
        });
      }
    }
  }
  return matches.sort((a, b) => b.count - a.count).slice(0, 30);
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

function getScopedMetrics(user: User, prompt?: string) {
  const db = getDatabase();
  const ops = isOpsRole(user);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Pull cached facets (all schema fields + unique values + counts)
  const leadsMetaRes = LeadsService.getLeads(
    { page: 1, limit: 1 },
    { userId: user.id, role: user.role, canViewAllLeads: ops }
  );
  const allFacets = leadsMetaRes.facets || [];
  const promptFacetMatches = prompt ? findPromptFacetMatches(prompt, allFacets) : [];

  const schemaAndFacets = allFacets.map((fg) => {
    const opts = fg.options || [];
    const maxToSend = 250;
    const head = opts.slice(0, maxToSend).map((o) => `${o.value} (${o.count})`);
    return {
      key: fg.key_name,
      label: fg.display_label,
      total_unique: opts.length,
      values: head,
    };
  });

  const recencyRow = db
    .prepare(
      ops
        ? `SELECT
             SUM(CASE WHEN attempt_count = 0 THEN 1 ELSE 0 END) as never_called,
             SUM(CASE WHEN date(last_attempt_at) = ? THEN 1 ELSE 0 END) as called_today,
             SUM(CASE WHEN last_attempt_at IS NULL OR date(last_attempt_at) != ? THEN 1 ELSE 0 END) as uncalled_today
           FROM leads`
        : `SELECT
             SUM(CASE WHEN attempt_count = 0 THEN 1 ELSE 0 END) as never_called,
             SUM(CASE WHEN date(last_attempt_at) = ? THEN 1 ELSE 0 END) as called_today,
             SUM(CASE WHEN last_attempt_at IS NULL OR date(last_attempt_at) != ? THEN 1 ELSE 0 END) as uncalled_today
           FROM leads WHERE assigned_to = ?`
    )
    .get(...(ops ? [todayStr, todayStr] : [todayStr, todayStr, user.id])) as any;

  let uniqueTags: { tag: string; count: number }[] = [];
  try {
    uniqueTags = db
      .prepare(
        ops
          ? `SELECT j.value as tag, COUNT(*) as count FROM leads, json_each(leads.tags) j WHERE leads.tags IS NOT NULL AND leads.tags != '[]' GROUP BY j.value ORDER BY count DESC LIMIT 100`
          : `SELECT j.value as tag, COUNT(*) as count FROM leads, json_each(leads.tags) j WHERE leads.assigned_to = ? AND leads.tags IS NOT NULL AND leads.tags != '[]' GROUP BY j.value ORDER BY count DESC LIMIT 100`
      )
      .all(...(ops ? [] : [user.id])) as any[];
  } catch {
    uniqueTags = [];
  }

  const activitySummary7d = db
    .prepare(
      `SELECT activity_type, COUNT(*) as count
       FROM lead_activities
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY activity_type
       ORDER BY count DESC`
    )
    .all() as any[];

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
        `SELECT u.id, u.name, u.role, u.status, u.last_login_at, COUNT(l.id) as lead_count,
                (SELECT dc.presence_status FROM daily_checkins dc WHERE dc.user_id = u.id AND dc.checkin_date = ? LIMIT 1) as presence,
                (SELECT dc.checked_in_at FROM daily_checkins dc WHERE dc.user_id = u.id AND dc.checkin_date = ? LIMIT 1) as checked_in_at,
                (SELECT dc.morning_focus FROM daily_checkins dc WHERE dc.user_id = u.id AND dc.checkin_date = ? LIMIT 1) as morning_focus,
                (SELECT COUNT(*) FROM lead_activities la WHERE la.performed_by_name = u.name AND date(la.created_at) = ?) as today_activities
         FROM users u
         LEFT JOIN leads l ON l.assigned_to = u.id
         GROUP BY u.id
         ORDER BY lead_count DESC`
      )
      .all(todayStr, todayStr, todayStr, todayStr) as any[];
    const campaigns = db
      .prepare(
        `SELECT c.id as campaign_id, COALESCE(c.name, 'Uncategorized') as campaign, COUNT(*) as count
         FROM leads l
         LEFT JOIN campaigns c ON l.campaign_id = c.id
         GROUP BY c.id, COALESCE(c.name, 'Uncategorized')
         ORDER BY count DESC`
      )
      .all() as any[];

    let recentAssignmentBatches: any[] = [];
    try {
      recentAssignmentBatches = db
        .prepare(
          `SELECT id, name, mode, filter_summary, total_assigned, created_by_name, created_at
           FROM assignment_batches
           ORDER BY created_at DESC
           LIMIT 10`
        )
        .all() as any[];
    } catch {}

    let recentSystemLogs: any[] = [];
    try {
      recentSystemLogs = db
        .prepare(
          `SELECT action_type, description, affected_count, performed_by, created_at
           FROM activity_logs
           ORDER BY id DESC
           LIMIT 10`
        )
        .all() as any[];
    } catch {}

    const callerDailyReport7d = db
      .prepare(
        `SELECT date(created_at) as day,
                COALESCE(performed_by_name, 'System') as caller,
                activity_type,
                COUNT(*) as count
         FROM lead_activities
         WHERE created_at >= datetime('now', '-7 days')
         GROUP BY date(created_at), COALESCE(performed_by_name, 'System'), activity_type
         ORDER BY day DESC, count DESC`
      )
      .all() as any[];

    const callerDispositionBreakdown7d = db
      .prepare(
        `SELECT COALESCE(performed_by_name, 'System') as caller,
                COALESCE(new_value, title) as outcome,
                COUNT(*) as count
         FROM lead_activities
         WHERE created_at >= datetime('now', '-7 days')
           AND activity_type IN ('call_outcome', 'disposition', 'status_change')
         GROUP BY COALESCE(performed_by_name, 'System'), COALESCE(new_value, title)
         ORDER BY count DESC
         LIMIT 100`
      )
      .all() as any[];

    opsExtra = {
      unassignedCount,
      counselorWorkloads,
      campaigns,
      recentAssignmentBatches,
      recentSystemLogs,
      callerDailyReport7d,
      callerDispositionBreakdown7d,
    };
  } else {
    const myDailyReport7d = db
      .prepare(
        `SELECT date(created_at) as day, activity_type, COUNT(*) as count
         FROM lead_activities
         WHERE created_at >= datetime('now', '-7 days') AND performed_by_name = ?
         GROUP BY date(created_at), activity_type
         ORDER BY day DESC, count DESC`
      )
      .all(user.name) as any[];
    opsExtra = { myDailyReport7d };
  }

  return {
    role: user.role,
    isOps: ops,
    todayDate: todayStr,
    myLeadsCount,
    statusBreakdown,
    callingRecency: recencyRow,
    uniqueTags,
    promptFacetMatches,
    schemaAndFacets,
    activitySummary7d,
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
    history?: { role: "user" | "assistant"; text: string }[];
    user: User;
  }): Promise<AiCommandResponse> {
    const historyText = Array.isArray(params.history) && params.history.length > 0
      ? params.history
          .slice(-6)
          .map((h) => `${h.role === "user" ? "USER" : "ASSISTANT"}: ${h.text}`)
          .join("\n")
      : "";
    const metrics = getScopedMetrics(
      params.user,
      `${historyText}\n${params.prompt}`
    );
    const ops = isOpsRole(params.user);

    const systemPrompt = `You are DreamDesk CRM's Adaptive Global AI Copilot.
Current user: "${params.user.name}" (role: "${params.user.role}", isOps: ${ops}, currentView: "${params.currentView || "leads"}").

${historyText ? `Recent Conversation History (use this to resolve follow-ups like "break it down day wise" or "assign those"):\n${historyText}\n` : ""}
Live CRM Context (schema fields, ALL unique facet values + counts, fuzzy prompt matches, users, 7-day day-wise caller report, and history):
${JSON.stringify(metrics, null, 2)}

CRITICAL FILTERING & ADAPTIVE UI RULES:
- Always check "promptFacetMatches" and "schemaAndFacets" FIRST!
- If the user mentions a location, school, stream, board, course, or custom attribute (even with spelling variations like "hoogly" -> "Hooghly"), put the EXACT matched value under "facets": { "<facet_key>": ["<exact_value>"] }. Do NOT put location/attribute names into "search"!
- Reserve "search" ONLY for a person's name, phone number, email, or LD- lead code.
- Use "status", "campaign_id", "disposition_id", "tags", "assigned_to", and "calling_recency".
- ADAPTIVE UI ("blocks"): NEVER end "answer" with "Here is the report:" without actually putting the data inside "blocks"! Choose the best UI blocks for the question:
  1. "table": Use for day-wise calling reports, caller comparisons, or multi-column breakdowns. Example: { "type": "table", "title": "Keshab Thapa — Last 7 Days", "columns": ["Date", "Call Attempts", "Dispositions", "WhatsApp", "Total"], "rows": [["2026-11-27", 18, 5, 2, 25]] }
  2. "bars": Use for rankings, distributions, campaign counts, district counts, or workload charts. Example: { "type": "bars", "title": "Counselor Lead Load", "items": [{ "label": "Keshab Thapa", "value": 164, "badge": "available" }] }
  3. "kpis": Use for 2-4 headline metrics. Example: { "type": "kpis", "items": [{ "label": "Assigned", "value": "164", "tone": "good" }] }
  4. "list": Use for prioritized call lists, bottlenecks, or recent assignment batches. Example: { "type": "list", "title": "Recent Batches", "items": [{ "title": "Batch Name", "subtitle": "Filters...", "badge": "50 leads" }] }

Capabilities you can return in JSON:
1. Analytical Answers & Adaptive Reports: Answer using live metrics + rich "blocks".
2. Smart Filters / Navigation ("applyFilters"): Help the user jump to a view or filter Leads with exact "facets", "status", "campaign_id", "assigned_to", "tags", "calling_recency", "search".
3. Confirmable Single Action ("proposedAction") OR Multi-Step Workflow ("proposedWorkflow"):
   Use "proposedWorkflow" (an ordered array of 2-5 steps) whenever the user asks for a multi-step operation. Use "proposedAction" for a single action.
   ${
     ops
       ? `Supported action types:
   - "bulk_status": Payload: { "filter_params": { "facets"?, "status"?, "campaign_id"?, "disposition_id"?, "tags"?, "calling_recency"?, "assigned_to"?, "search"? }, "status": "..." }
   - "bulk_assign": Payload: { "filter_params": {...}, "mode": "single" | "auto", "target_user_id"?: string, "total_to_assign"?: number }
   - "bulk_tag": Payload: { "filter_params": {...}, "tags": ["string"] }
   - "bulk_create_tasks": Payload: { "filter_params": {...}, "title": "string", "priority": "low" | "normal" | "high" | "urgent", "due_date": "ISO-8601 string", "limit"?: number }`
       : `- IMPORTANT: User is NOT an Admin/Team Lead. NEVER propose "bulk_assign", "bulk_status", "bulk_tag", or "bulk_create_tasks".`
   }

Return strictly valid JSON:
{
  "answer": "Clear, concise summary.",
  "highlights": [{ "label": "string", "value": "string" }],
  "blocks": [],
  "applyFilters": { "search"?: "string", "status"?: ["string"], "campaign_id"?: ["string"], "assigned_to"?: ["string"], "tags"?: ["string"], "calling_recency"?: "string", "facets"?: { "key": ["value"] }, "view"?: "string" } | null,
  "proposedAction": {
    "type": "bulk_status" | "bulk_assign" | "bulk_tag" | "bulk_create_tasks",
    "title": "Short button/card title",
    "summary": "Exact human-readable summary of what will change",
    "payload": {}
  } | null,
  "proposedWorkflow": [
    {
      "type": "bulk_assign" | "bulk_tag" | "bulk_status" | "bulk_create_tasks",
      "title": "Step title",
      "summary": "What this step does",
      "payload": {}
    }
  ] | null
}`;

    const parsed = await callGeminiJson(systemPrompt, params.prompt);

    const normalizeStep = (rawStep: any): AiProposedAction | null => {
      if (!rawStep?.type) return null;
      const pType = String(rawStep.type);
      const rawPayload = rawStep.payload || {};

      if (pType === "set_presence") {
        const validPresences = new Set(["available", "on_break", "in_meeting", "away", "offline"]);
        const presence = validPresences.has(rawPayload?.presence) ? rawPayload.presence : "available";
        return {
          type: "set_presence",
          title: String(rawStep.title || `Set status to ${presence}`),
          summary: String(rawStep.summary || `Update your CRM presence status to "${presence}".`),
          affectedCount: 1,
          payload: { presence },
        };
      }

      if (ops && ["bulk_status", "bulk_assign", "bulk_tag", "bulk_create_tasks"].includes(pType)) {
        const filterParams = buildFilterParams(rawPayload.filter_params || {}, params.user);
        const limit =
          (pType === "bulk_assign" && rawPayload.total_to_assign)
            ? Number(rawPayload.total_to_assign)
            : (pType === "bulk_create_tasks" && rawPayload.limit)
            ? Number(rawPayload.limit)
            : undefined;
        const targetIds = LeadsService.getTargetLeadIds(filterParams, limit);
        return {
          type: pType as any,
          title: String(rawStep.title || "Workflow Step"),
          summary: String(rawStep.summary || "Apply update to matching leads."),
          affectedCount: targetIds.length,
          payload: {
            ...rawPayload,
            filter_params: filterParams,
          },
        };
      }
      return null;
    };

    const proposedWorkflow = Array.isArray(parsed?.proposedWorkflow)
      ? parsed.proposedWorkflow.map(normalizeStep).filter(Boolean) as AiProposedAction[]
      : null;

    const proposedAction =
      !proposedWorkflow || proposedWorkflow.length === 0
        ? normalizeStep(parsed?.proposedAction)
        : null;

    const blocks: AiUiBlock[] = Array.isArray(parsed?.blocks)
      ? parsed.blocks.filter((b: any) => b && ["table", "bars", "kpis", "list"].includes(b.type))
      : [];

    return {
      answer: String(parsed?.answer || "Done."),
      highlights: Array.isArray(parsed?.highlights)
        ? parsed.highlights.slice(0, 6).map((h: any) => ({
            label: String(h?.label || ""),
            value: String(h?.value || ""),
          }))
        : [],
      blocks,
      applyFilters: parsed?.applyFilters || null,
      proposedAction,
      proposedWorkflow: proposedWorkflow && proposedWorkflow.length > 0 ? proposedWorkflow : null,
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
      SyncService.publish("leads_bulk_updated", "AI_BULK_STATUS", { userId: user.id, data: { affected } });
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
      SyncService.publish("leads_bulk_updated", "AI_BULK_ASSIGN", { userId: user.id, data: { affected: res.affectedCount } });
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
      SyncService.publish("leads_bulk_updated", "AI_BULK_TAG", { userId: user.id, data: { affected } });
      return {
        success: true,
        message: `Tagged ${affected} lead(s) with ${tags.join(", ")}.`,
        affectedCount: affected,
      };
    }

    if (action.type === "bulk_create_tasks") {
      const title = String(action.payload?.title || "AI Follow-up").trim();
      const priority = ["low", "normal", "high", "urgent"].includes(action.payload?.priority)
        ? String(action.payload.priority)
        : "normal";
      const dueDate = action.payload?.due_date
        ? String(action.payload.due_date)
        : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const limit = action.payload?.limit ? Math.min(200, Number(action.payload.limit)) : 200;

      const targetIds = LeadsService.getTargetLeadIds(filterParams, limit);
      if (targetIds.length === 0) {
        return { success: true, message: "No matching leads found for task creation.", affectedCount: 0 };
      }

      const db = getDatabase();
      const placeholders = targetIds.map(() => "?").join(",");
      const leads = db
        .prepare(`SELECT id, assigned_to FROM leads WHERE id IN (${placeholders})`)
        .all(...targetIds) as { id: number; assigned_to: string | null }[];

      const insertTask = db.prepare(`
        INSERT INTO crm_tasks (
          lead_id, assigned_to, title, description, priority, due_date, status, created_by, source_action
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'ai_workflow')
      `);

      const tx = db.transaction(() => {
        for (const l of leads) {
          insertTask.run(
            l.id,
            l.assigned_to || user.id,
            title,
            `Created via AI Workflow by ${user.name}`,
            priority,
            dueDate,
            user.name
          );
        }
      });
      tx();

      SyncService.publish("task_updated", "AI_BULK_TASKS", { userId: user.id, data: { affected: leads.length } });
      return {
        success: true,
        message: `Created ${leads.length} follow-up task(s): "${title}".`,
        affectedCount: leads.length,
      };
    }

    throw new Error(`Unsupported AI action type: ${action.type}`);
  },

  async executeWorkflow(params: {
    steps: AiProposedAction[];
    user: User;
  }): Promise<{ success: boolean; results: AiWorkflowStepResult[]; summary: string }> {
    const results: AiWorkflowStepResult[] = [];
    for (let i = 0; i < params.steps.length; i++) {
      const step = params.steps[i];
      try {
        const res = await this.executeAction({ action: step, user: params.user });
        results.push({
          stepIndex: i,
          title: step.title,
          success: true,
          message: res.message,
          affectedCount: res.affectedCount,
        });
      } catch (err: any) {
        results.push({
          stepIndex: i,
          title: step.title,
          success: false,
          message: err?.message || "Step failed",
        });
      }
    }
    const okCount = results.filter((r) => r.success).length;
    return {
      success: okCount === results.length,
      results,
      summary: `Completed ${okCount}/${results.length} workflow step(s).`,
    };
  },
};
