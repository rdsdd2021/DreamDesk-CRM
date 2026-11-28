import { getDatabase } from "@/lib/db/database";
import { AiSettings, WhatsAppAiAssistResult, User } from "@/types/crm";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function maskKey(key?: string | null): string {
  if (!key) return "";
  const s = String(key).trim();
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 6)}••••${s.slice(-4)}`;
}

export const AiCopilotService = {
  getRawSettings(): AiSettings & { raw_api_key: string } {
    const db = getDatabase();
    const row = db.prepare(`SELECT * FROM ai_settings WHERE id = 1`).get() as any;
    const envKey = process.env.GEMINI_API_KEY || "";
    const rawKey = (row?.gemini_api_key && String(row.gemini_api_key).trim()) || envKey;

    return {
      provider: "gemini",
      gemini_api_key: maskKey(rawKey),
      raw_api_key: rawKey,
      has_api_key: Boolean(rawKey),
      model: row?.model || "gemini-2.5-flash",
      tone: row?.tone || "Warm, helpful, concise admissions counselor",
      knowledge_base: row?.knowledge_base || "",
      guardrails:
        row?.guardrails ||
        "Never invent fee amounts, scholarship percentages, or admission deadlines not listed in the Knowledge Base. Keep replies concise (2-4 sentences) and natural for WhatsApp.",
      is_enabled: row ? Boolean(row.is_enabled) : true,
      updated_at: row?.updated_at,
    };
  },

  getPublicSettings(): AiSettings {
    const { raw_api_key: _raw, ...pub } = this.getRawSettings();
    return pub;
  },

  saveSettings(input: Partial<AiSettings>): AiSettings {
    const db = getDatabase();
    const existing = db.prepare(`SELECT * FROM ai_settings WHERE id = 1`).get() as any;
    const now = new Date().toISOString();

    const incomingKey = input.gemini_api_key?.trim();
    const isMasked = incomingKey && incomingKey.includes("••••");
    const nextKey =
      incomingKey && !isMasked
        ? incomingKey
        : existing?.gemini_api_key || null;

    const nextModel = (input.model || existing?.model || "gemini-2.5-flash").trim();
    const nextTone = (input.tone ?? existing?.tone ?? "Warm, helpful, concise admissions counselor").trim();
    const nextKb = input.knowledge_base ?? existing?.knowledge_base ?? "";
    const nextGuardrails = input.guardrails ?? existing?.guardrails ?? "";
    const nextEnabled =
      input.is_enabled === undefined
        ? existing
          ? Number(existing.is_enabled)
          : 1
        : input.is_enabled
        ? 1
        : 0;

    if (existing) {
      db.prepare(
        `UPDATE ai_settings
         SET gemini_api_key = ?, model = ?, tone = ?, knowledge_base = ?, guardrails = ?, is_enabled = ?, updated_at = ?
         WHERE id = 1`
      ).run(nextKey, nextModel, nextTone, nextKb, nextGuardrails, nextEnabled, now);
    } else {
      db.prepare(
        `INSERT INTO ai_settings (id, provider, gemini_api_key, model, tone, knowledge_base, guardrails, is_enabled, updated_at)
         VALUES (1, 'gemini', ?, ?, ?, ?, ?, ?, ?)`
      ).run(nextKey, nextModel, nextTone, nextKb, nextGuardrails, nextEnabled, now);
    }

    return this.getPublicSettings();
  },

  async testConnection(overrideKey?: string, overrideModel?: string): Promise<{ ok: boolean; message: string }> {
    const cfg = this.getRawSettings();
    const key =
      overrideKey && !overrideKey.includes("••••") && overrideKey.trim()
        ? overrideKey.trim()
        : cfg.raw_api_key;
    if (!key) {
      throw new Error("Please enter a Gemini API Key first.");
    }
    const model = (overrideModel || cfg.model || "gemini-2.5-flash").trim();
    const res = await fetch(
      `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Reply with the single word: OK" }] }],
          generationConfig: { maxOutputTokens: 16, temperature: 0 },
        }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || `Gemini API returned HTTP ${res.status}`);
    }
    return { ok: true, message: `Connected to ${model} successfully!` };
  },

  async generateWhatsAppAssist(params: {
    conversationId?: number;
    leadId?: number;
    is24hOpen?: boolean;
    user: User;
  }): Promise<WhatsAppAiAssistResult> {
    const cfg = this.getRawSettings();
    if (!cfg.is_enabled) {
      throw new Error("AI Copilot is currently disabled in Admin Settings.");
    }
    if (!cfg.raw_api_key) {
      throw new Error(
        "Gemini API Key is not configured yet. Ask an Admin to add it in WhatsApp → Kapso Setup."
      );
    }

    const db = getDatabase();
    let conv: any = null;
    if (params.conversationId) {
      conv = db
        .prepare(`SELECT * FROM whatsapp_conversations WHERE id = ?`)
        .get(params.conversationId);
    } else if (params.leadId) {
      conv = db
        .prepare(`SELECT * FROM whatsapp_conversations WHERE lead_id = ? ORDER BY last_message_at DESC LIMIT 1`)
        .get(params.leadId);
    }

    const resolvedLeadId = params.leadId || conv?.lead_id || null;
    const lead = resolvedLeadId
      ? (db.prepare(`SELECT * FROM leads WHERE id = ?`).get(resolvedLeadId) as any)
      : null;

    const messages = conv
      ? (db
          .prepare(
            `SELECT direction, message_type, body, template_name, created_at
             FROM whatsapp_messages
             WHERE conversation_id = ?
             ORDER BY datetime(created_at) DESC, id DESC
             LIMIT 20`
          )
          .all(conv.id) as any[])
          .reverse()
      : [];

    const schemaFields = db
      .prepare(
        `SELECT key_name, display_label, data_type FROM lead_schema_meta WHERE is_visible = 1 ORDER BY display_order ASC`
      )
      .all() as any[];

    const approvedTemplates = db
      .prepare(
        `SELECT name, category, language, template_body, variables_json
         FROM whatsapp_templates
         WHERE status = 'APPROVED'
         ORDER BY is_default DESC, name ASC
         LIMIT 25`
      )
      .all() as any[];

    const validFieldMap = new Map<string, string>([
      ["name", "Student Name"],
      ["email", "Email"],
      ["source", "Lead Source"],
      ["campaign", "Campaign"],
      ["status", "Lead Status"],
      ["notes", "Counselor Notes"],
      ["whatsapp_phone", "WhatsApp Phone"],
    ]);
    for (const sf of schemaFields) {
      if (sf?.key_name) {
        validFieldMap.set(sf.key_name, sf.display_label || sf.key_name);
      }
    }

    let rawAttributes: Record<string, any> = {};
    if (lead?.raw_attributes) {
      try {
        rawAttributes = JSON.parse(lead.raw_attributes);
      } catch {
        rawAttributes = {};
      }
    }

    const leadSnapshot = lead
      ? {
          id: lead.id,
          name: lead.name,
          email: lead.email,
          status: lead.status,
          campaign_id: lead.campaign_id,
          notes: lead.notes,
          raw_attributes: rawAttributes,
        }
      : { contact_name: conv?.contact_name || "Unknown Prospect" };

    const transcriptText =
      messages.length > 0
        ? messages
            .map(
              (m) =>
                `[${m.direction === "inbound" ? "STUDENT" : "COUNSELOR"} | ${m.created_at}] ${
                  m.body || `[${m.message_type}]`
                }`
            )
            .join("\n")
        : "(No WhatsApp messages exchanged yet)";

    const templatesSummary = approvedTemplates.map((t) => {
      let vars: any[] = [];
      try {
        vars = t.variables_json ? JSON.parse(t.variables_json) : [];
      } catch {
        vars = [];
      }
      return {
        name: t.name,
        category: t.category,
        body: t.template_body,
        variables: vars.map((v: any) => v.name),
      };
    });

    const nowIso = new Date().toISOString();
    const systemPrompt = `You are an Admissions CRM WhatsApp Copilot helping counselor "${params.user.name}" reply to a prospective student.
Current ISO timestamp: ${nowIso}
Tone: ${cfg.tone}
Guardrails: ${cfg.guardrails}

College Knowledge Base:
${cfg.knowledge_base || "(No custom Knowledge Base provided yet. Rely only on the lead profile and approved templates; do not invent fee figures or dates.)"}

Valid CRM Lead Fields you may extract (only suggest fields whose value is clearly stated in the conversation and differs from or fills in the current lead profile):
${Array.from(validFieldMap.entries())
  .map(([k, label]) => `- "${k}" (${label})`)
  .join("\n")}

Approved Meta WhatsApp Templates:
${JSON.stringify(templatesSummary, null, 2)}

Instructions:
1. Summarize the thread in 1 concise sentence.
2. Classify student intent as one of: "hot", "warm", "fee_inquiry", "callback_requested", "cold", "not_interested".
3. ${
      params.is24hOpen
        ? "The 24-hour WhatsApp window is OPEN. Provide 3 distinct, ready-to-send replyDrafts (short, helpful, WhatsApp-friendly). Set recommendedTemplate to null."
        : "The 24-hour WhatsApp window is CLOSED (Template Only). Set replyDrafts to [] and pick the single best approved template in recommendedTemplate with pre-filled variable values based on the student's context (or null if no approved templates exist)."
    }
4. Extract any new student details into extractedFields using ONLY the valid field keys listed above.
5. If the student asked for a callback, campus visit, or follow-up at a specific time (or if a clear next step is needed), populate suggestedTask with title, due_at (ISO-8601), priority ("low" | "medium" | "high" | "urgent"), and brief notes; otherwise set suggestedTask to null.

Return strictly valid JSON matching this structure:
{
  "summary": "string",
  "intent": "hot" | "warm" | "fee_inquiry" | "callback_requested" | "cold" | "not_interested",
  "replyDrafts": ["string"],
  "recommendedTemplate": { "name": "string", "reason": "string", "variables": { "varName": "value" } } | null,
  "extractedFields": [{ "field": "string", "label": "string", "value": "string", "reason": "string" }],
  "suggestedTask": { "title": "string", "due_at": "ISO-8601 string", "priority": "low" | "medium" | "high" | "urgent", "notes": "string" } | null
}`;

    const userPrompt = `Lead Profile:
${JSON.stringify(leadSnapshot, null, 2)}

WhatsApp Conversation Transcript:
${transcriptText}`;

    const res = await fetch(
      `${GEMINI_API_BASE}/${encodeURIComponent(cfg.model || "gemini-2.5-flash")}:generateContent?key=${encodeURIComponent(cfg.raw_api_key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.35,
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
    if (!rawText) {
      throw new Error("Gemini returned an empty response.");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = String(rawText)
        .replace(/^```json\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    }

    const validIntents = new Set([
      "hot",
      "warm",
      "fee_inquiry",
      "callback_requested",
      "cold",
      "not_interested",
    ]);

    const approvedTplNames = new Set(approvedTemplates.map((t) => t.name));
    const recTpl =
      parsed?.recommendedTemplate?.name && approvedTplNames.has(parsed.recommendedTemplate.name)
        ? {
            name: String(parsed.recommendedTemplate.name),
            reason: parsed.recommendedTemplate.reason ? String(parsed.recommendedTemplate.reason) : undefined,
            variables:
              parsed.recommendedTemplate.variables && typeof parsed.recommendedTemplate.variables === "object"
                ? Object.fromEntries(
                    Object.entries(parsed.recommendedTemplate.variables).map(([k, v]) => [k, String(v ?? "")])
                  )
                : {},
          }
        : null;

    const extractedFields = Array.isArray(parsed?.extractedFields)
      ? parsed.extractedFields
          .filter((ef: any) => ef?.field && validFieldMap.has(String(ef.field)) && String(ef.value ?? "").trim() !== "")
          .map((ef: any) => ({
            field: String(ef.field),
            label: validFieldMap.get(String(ef.field)) || String(ef.label || ef.field),
            value: String(ef.value).trim(),
            reason: ef.reason ? String(ef.reason) : undefined,
          }))
      : [];

    const validPriorities = new Set(["low", "medium", "high", "urgent"]);
    const suggestedTask =
      parsed?.suggestedTask?.title
        ? {
            title: String(parsed.suggestedTask.title).trim(),
            due_at: parsed.suggestedTask.due_at
              ? String(parsed.suggestedTask.due_at)
              : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            priority: (validPriorities.has(parsed.suggestedTask.priority)
              ? parsed.suggestedTask.priority
              : "medium") as "low" | "medium" | "high" | "urgent",
            notes: parsed.suggestedTask.notes ? String(parsed.suggestedTask.notes) : undefined,
          }
        : null;

    return {
      summary: String(parsed?.summary || "No summary available."),
      intent: validIntents.has(parsed?.intent) ? parsed.intent : "warm",
      replyDrafts: Array.isArray(parsed?.replyDrafts)
        ? parsed.replyDrafts.map((d: any) => String(d).trim()).filter(Boolean).slice(0, 3)
        : [],
      recommendedTemplate: recTpl,
      extractedFields,
      suggestedTask,
    };
  },
};
