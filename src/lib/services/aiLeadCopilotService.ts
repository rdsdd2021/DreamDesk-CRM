import { getDatabase } from "@/lib/db/database";
import { AiCopilotService } from "@/lib/services/aiCopilotService";
import { LeadAiBriefResult, LeadAiParseNotesResult, User } from "@/types/crm";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

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

export const AiLeadCopilotService = {
  async generatePreCallBrief(leadId: number, user: User): Promise<LeadAiBriefResult> {
    const db = getDatabase();
    const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId) as any;
    if (!lead) throw new Error("Lead not found");

    const cfg = AiCopilotService.getRawSettings();
    const activities = db
      .prepare(
        `SELECT activity_type, title, description, old_value, new_value, performed_by_name, created_at
         FROM lead_activities
         WHERE lead_id = ?
         ORDER BY id DESC
         LIMIT 10`
      )
      .all(leadId) as any[];

    const waMsgs = db
      .prepare(
        `SELECT direction, body, created_at
         FROM whatsapp_messages
         WHERE lead_id = ?
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT 8`
      )
      .all(leadId) as any[];

    const pendingTasks = db
      .prepare(
        `SELECT title, priority, due_date
         FROM crm_tasks
         WHERE lead_id = ? AND status = 'pending'
         ORDER BY due_date ASC
         LIMIT 5`
      )
      .all(leadId) as any[];

    let customData: Record<string, any> = {};
    if (lead.custom_data) {
      try {
        customData = JSON.parse(lead.custom_data);
      } catch {
        customData = {};
      }
    }

    const systemPrompt = `You are an Admissions Pre-Call Copilot preparing counselor "${user.name}" right before dialing a student/parent.
Tone: ${cfg.tone}
College Knowledge Base:
${cfg.knowledge_base || "(No custom Knowledge Base configured yet.)"}

Return strictly valid JSON:
{
  "summary": "2-sentence crisp context of where this lead stands right now.",
  "talkingPoints": ["3 short, actionable bullet points tailored to this lead's history & course interest."],
  "recommendedAction": "1 clear goal for this call (e.g., Confirm campus visit or collect 12th marks).",
  "riskOrObjection": "Optional 1-line warning if there were unreachable attempts, fee concern, or delay; null if none."
}`;

    const userPrompt = JSON.stringify(
      {
        lead: {
          name: lead.name,
          status: lead.status,
          source: lead.source,
          campaign: lead.campaign,
          attempt_count: lead.attempt_count,
          notes: lead.notes,
          custom_data: customData,
        },
        recentActivities: activities,
        recentWhatsApp: waMsgs.reverse(),
        pendingTasks,
      },
      null,
      2
    );

    const parsed = await callGeminiJson(systemPrompt, userPrompt);
    return {
      summary: String(parsed?.summary || "No prior history available."),
      talkingPoints: Array.isArray(parsed?.talkingPoints)
        ? parsed.talkingPoints.map(String).filter(Boolean).slice(0, 4)
        : [],
      recommendedAction: String(parsed?.recommendedAction || "Qualify student & confirm next step."),
      riskOrObjection: parsed?.riskOrObjection ? String(parsed.riskOrObjection) : null,
    };
  },

  async parseRoughNotes(params: {
    leadId: number;
    roughNotes: string;
    user: User;
  }): Promise<LeadAiParseNotesResult> {
    const db = getDatabase();
    const lead = db.prepare(`SELECT id, name FROM leads WHERE id = ?`).get(params.leadId) as any;
    if (!lead) throw new Error("Lead not found");

    const dispositions = db
      .prepare(`SELECT id, name, category, requires_callback FROM dispositions WHERE is_active = 1 ORDER BY display_order ASC`)
      .all() as any[];

    const subDispositions = db
      .prepare(`SELECT id, disposition_id, name FROM sub_dispositions WHERE is_active = 1 ORDER BY display_order ASC`)
      .all() as any[];

    const schemaFields = db
      .prepare(`SELECT key_name, display_label FROM lead_schema_meta WHERE is_visible = 1 ORDER BY display_order ASC`)
      .all() as any[];

    const validFieldMap = new Map<string, string>([
      ["name", "Student Name"],
      ["email", "Email"],
      ["source", "Lead Source"],
      ["campaign", "Campaign"],
    ]);
    for (const sf of schemaFields) {
      if (sf?.key_name) validFieldMap.set(sf.key_name, sf.display_label || sf.key_name);
    }

    const dispTree = dispositions.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      requires_callback: Boolean(d.requires_callback),
      sub_dispositions: subDispositions
        .filter((s) => s.disposition_id === d.id)
        .map((s) => ({ id: s.id, name: s.name })),
    }));

    const nowLocal = new Date();
    const systemPrompt = `You are a CRM Call-Notes Parser. Convert the counselor's rough post-call notes into a structured disposition, sub-disposition, callback datetime, clean professional note, and extracted lead fields.
Current local date/time: ${nowLocal.toISOString()} (IST +05:30).

Available Dispositions & Sub-Dispositions (use ONLY exact IDs from this list):
${JSON.stringify(dispTree, null, 2)}

Valid CRM Lead Fields:
${Array.from(validFieldMap.entries())
  .map(([k, l]) => `- "${k}" (${l})`)
  .join("\n")}

Return strictly valid JSON:
{
  "disposition_id": "exact disposition id or null",
  "sub_disposition_id": "exact sub_disposition id belonging to that disposition or null",
  "callback_at": "YYYY-MM-DDTHH:mm local datetime string if a callback/follow-up time is mentioned, else null",
  "clean_notes": "Professional, concise 1-2 sentence CRM call summary.",
  "extracted_fields": [{ "field": "string", "label": "string", "value": "string" }]
}`;

    const parsed = await callGeminiJson(systemPrompt, `Lead: ${lead.name}\nRough Notes: ${params.roughNotes}`);

    const dispMap = new Map(dispositions.map((d) => [d.id, d]));
    const subMap = new Map(subDispositions.map((s) => [s.id, s]));

    const validDisp = parsed?.disposition_id && dispMap.get(String(parsed.disposition_id));
    const validSub =
      validDisp &&
      parsed?.sub_disposition_id &&
      subMap.get(String(parsed.sub_disposition_id))?.disposition_id === validDisp.id
        ? subMap.get(String(parsed.sub_disposition_id))
        : null;

    const extracted_fields = Array.isArray(parsed?.extracted_fields)
      ? parsed.extracted_fields
          .filter((ef: any) => ef?.field && validFieldMap.has(String(ef.field)) && String(ef.value ?? "").trim() !== "")
          .map((ef: any) => ({
            field: String(ef.field),
            label: validFieldMap.get(String(ef.field)) || String(ef.field),
            value: String(ef.value).trim(),
          }))
      : [];

    let callbackAt: string | null = null;
    if (parsed?.callback_at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(parsed.callback_at))) {
      callbackAt = String(parsed.callback_at).slice(0, 16);
    }

    return {
      disposition_id: validDisp ? validDisp.id : null,
      disposition_name: validDisp ? validDisp.name : null,
      sub_disposition_id: validSub ? validSub.id : null,
      sub_disposition_name: validSub ? validSub.name : null,
      callback_at: callbackAt,
      clean_notes: String(parsed?.clean_notes || params.roughNotes).trim(),
      extracted_fields,
    };
  },
};
