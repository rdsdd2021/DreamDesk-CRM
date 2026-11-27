import { getDatabase } from "@/lib/db/database";
import { PushNotificationService } from "@/lib/services/pushNotificationService";
import { SyncService } from "@/lib/services/syncService";
import { maskPhoneNumber } from "@/lib/utils/phoneMasker";
import {
  User,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppSettings,
} from "@/types/crm";

const KAPSO_API_BASE = "https://api.kapso.ai";

function normalizePhoneDigits(raw: string): string {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function maskKey(val?: string | null): string {
  if (!val) return "";
  if (val.length <= 8) return "••••••••";
  return `${val.slice(0, 4)}••••••••${val.slice(-4)}`;
}

export class KapsoWhatsappService {
  static getRawConfig(): {
    kapso_api_key: string;
    phone_number_id: string;
    business_account_id: string;
    webhook_secret: string;
    display_phone_number: string;
    is_connected: boolean;
    updated_at?: string;
  } {
    const db = getDatabase();
    const row = db.prepare(`SELECT * FROM whatsapp_settings WHERE id = 1`).get() as any;

    const apiKey = row?.kapso_api_key || process.env.KAPSO_API_KEY || "";
    const phoneId = row?.phone_number_id || process.env.KAPSO_PHONE_NUMBER_ID || "";
    const wabaId = row?.business_account_id || process.env.KAPSO_WABA_ID || "";
    const secret = row?.webhook_secret || process.env.KAPSO_WEBHOOK_SECRET || "";
    const displayPhone = row?.display_phone_number || "";
    const isConnected = Boolean(row?.is_connected) || Boolean(apiKey && phoneId);

    return {
      kapso_api_key: apiKey,
      phone_number_id: phoneId,
      business_account_id: wabaId,
      webhook_secret: secret,
      display_phone_number: displayPhone,
      is_connected: isConnected,
      updated_at: row?.updated_at,
    };
  }

  static getPublicConfig(): WhatsAppSettings {
    const raw = this.getRawConfig();
    return {
      kapso_api_key: maskKey(raw.kapso_api_key),
      has_api_key: Boolean(raw.kapso_api_key),
      phone_number_id: raw.phone_number_id,
      business_account_id: raw.business_account_id,
      webhook_secret: maskKey(raw.webhook_secret),
      display_phone_number: raw.display_phone_number,
      is_connected: raw.is_connected,
      updated_at: raw.updated_at,
    };
  }

  static saveConfig(input: Partial<WhatsAppSettings>): WhatsAppSettings {
    const db = getDatabase();
    const existing = this.getRawConfig();

    const apiKey =
      input.kapso_api_key && !input.kapso_api_key.includes("••••")
        ? input.kapso_api_key.trim()
        : existing.kapso_api_key;
    const phoneId =
      input.phone_number_id !== undefined
        ? String(input.phone_number_id).trim()
        : existing.phone_number_id;
    const wabaId =
      input.business_account_id !== undefined
        ? String(input.business_account_id).trim()
        : existing.business_account_id;
    const secret =
      input.webhook_secret && !input.webhook_secret.includes("••••")
        ? input.webhook_secret.trim()
        : existing.webhook_secret;
    const displayPhone =
      input.display_phone_number !== undefined
        ? String(input.display_phone_number).trim()
        : existing.display_phone_number;

    const now = new Date().toISOString();
    const isConnected = Boolean(apiKey && phoneId) ? 1 : 0;

    db.prepare(
      `
      INSERT INTO whatsapp_settings (
        id, kapso_api_key, phone_number_id, business_account_id, webhook_secret,
        display_phone_number, is_connected, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kapso_api_key = excluded.kapso_api_key,
        phone_number_id = excluded.phone_number_id,
        business_account_id = excluded.business_account_id,
        webhook_secret = excluded.webhook_secret,
        display_phone_number = excluded.display_phone_number,
        is_connected = excluded.is_connected,
        updated_at = excluded.updated_at
    `
    ).run(apiKey, phoneId, wabaId, secret, displayPhone, isConnected, now);

    return this.getPublicConfig();
  }

  static async testConnection(): Promise<{ ok: boolean; message: string; details?: any }> {
    const cfg = this.getRawConfig();
    if (!cfg.kapso_api_key || !cfg.phone_number_id) {
      return { ok: false, message: "Kapso API Key and Phone Number ID are required." };
    }

    try {
      const url = cfg.business_account_id
        ? `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.business_account_id}/message_templates?limit=1`
        : `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.phone_number_id}`;

      const res = await fetch(url, {
        headers: { "X-API-Key": cfg.kapso_api_key },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          message: json?.error?.message || json?.message || `Kapso returned HTTP ${res.status}`,
        };
      }
      const db = getDatabase();
      db.prepare(`UPDATE whatsapp_settings SET is_connected = 1, updated_at = ? WHERE id = 1`).run(
        new Date().toISOString()
      );
      return { ok: true, message: "Connected to Kapso WhatsApp API successfully.", details: json };
    } catch (err: any) {
      return { ok: false, message: err?.message || "Network error reaching Kapso API" };
    }
  }

  static getOrCreateConversationForLead(leadId: number): WhatsAppConversation {
    const db = getDatabase();
    const lead = db.prepare(`SELECT id, name, phone, assigned_to FROM leads WHERE id = ?`).get(leadId) as any;
    if (!lead) throw new Error("Lead not found");

    const phoneDigits = normalizePhoneDigits(lead.phone);
    if (!phoneDigits || phoneDigits.length < 7) {
      throw new Error("Lead does not have a valid phone number");
    }

    let conv = db
      .prepare(`SELECT * FROM whatsapp_conversations WHERE lead_id = ? OR phone_digits = ? LIMIT 1`)
      .get(lead.id, phoneDigits) as any;

    if (!conv) {
      const now = new Date().toISOString();
      const res = db
        .prepare(
          `
          INSERT INTO whatsapp_conversations (
            lead_id, phone_number, phone_digits, contact_name, assigned_to,
            status, unread_count, last_message_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'open', 0, ?, ?)
        `
        )
        .run(lead.id, lead.phone, phoneDigits, lead.name, lead.assigned_to || null, now, now);
      conv = db
        .prepare(`SELECT * FROM whatsapp_conversations WHERE id = ?`)
        .get(Number(res.lastInsertRowid));
    } else if (!conv.lead_id) {
      db.prepare(`UPDATE whatsapp_conversations SET lead_id = ?, contact_name = COALESCE(contact_name, ?) WHERE id = ?`).run(
        lead.id,
        lead.name,
        conv.id
      );
    }

    return conv as WhatsAppConversation;
  }

  static listConversations(
    userScope: { userId: string; role: string; canViewAllLeads: boolean },
    options?: { filter?: "all" | "unread" | "open" | "resolved"; search?: string; limit?: number }
  ): WhatsAppConversation[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: any[] = [];

    if (!userScope.canViewAllLeads) {
      conditions.push(`(wc.assigned_to = ? OR l.assigned_to = ?)`);
      params.push(userScope.userId, userScope.userId);
    }

    const filter = options?.filter || "all";
    if (filter === "unread") conditions.push(`wc.unread_count > 0`);
    if (filter === "open") conditions.push(`wc.status = 'open'`);
    if (filter === "resolved") conditions.push(`wc.status = 'resolved'`);

    if (options?.search && options.search.trim()) {
      const q = `%${options.search.trim()}%`;
      conditions.push(
        `(wc.contact_name LIKE ? OR wc.phone_digits LIKE ? OR l.name LIKE ? OR l.lead_code LIKE ?)`
      );
      params.push(q, q, q, q);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(200, Math.max(10, options?.limit || 80));
    params.push(limit);

    const rows = db
      .prepare(
        `
        SELECT
          wc.*,
          l.lead_code,
          l.name AS lead_name,
          l.status AS lead_status,
          u.name AS assigned_user_name
        FROM whatsapp_conversations wc
        LEFT JOIN leads l ON wc.lead_id = l.id
        LEFT JOIN users u ON wc.assigned_to = u.id
        ${whereSql}
        ORDER BY wc.last_message_at DESC, wc.id DESC
        LIMIT ?
      `
      )
      .all(...params) as any[];

    const shouldMask = userScope.role !== "admin" && userScope.role !== "team_lead";
    return rows.map((r) => ({
      ...r,
      phone_number: shouldMask ? maskPhoneNumber(r.phone_number) : r.phone_number,
      phone_digits: shouldMask ? maskPhoneNumber(r.phone_digits) : r.phone_digits,
    }));
  }

  static getConversationMessages(
    conversationId: number,
    userScope: { userId: string; role: string; canViewAllLeads: boolean }
  ): { conversation: WhatsAppConversation; messages: WhatsAppMessage[] } | null {
    const db = getDatabase();
    const conv = db
      .prepare(
        `
        SELECT
          wc.*,
          l.lead_code,
          l.name AS lead_name,
          l.status AS lead_status,
          l.assigned_to AS lead_assigned_to,
          u.name AS assigned_user_name
        FROM whatsapp_conversations wc
        LEFT JOIN leads l ON wc.lead_id = l.id
        LEFT JOIN users u ON wc.assigned_to = u.id
        WHERE wc.id = ?
      `
      )
      .get(conversationId) as any;

    if (!conv) return null;
    if (
      !userScope.canViewAllLeads &&
      conv.assigned_to !== userScope.userId &&
      conv.lead_assigned_to !== userScope.userId
    ) {
      return null;
    }

    const messages = db
      .prepare(`SELECT * FROM whatsapp_messages WHERE conversation_id = ? ORDER BY id ASC`)
      .all(conversationId) as WhatsAppMessage[];

    // Mark unread as read on open
    if (conv.unread_count > 0) {
      db.prepare(`UPDATE whatsapp_conversations SET unread_count = 0 WHERE id = ?`).run(conversationId);
    }

    const shouldMask = userScope.role !== "admin" && userScope.role !== "team_lead";
    return {
      conversation: {
        ...conv,
        unread_count: 0,
        phone_number: shouldMask ? maskPhoneNumber(conv.phone_number) : conv.phone_number,
        phone_digits: shouldMask ? maskPhoneNumber(conv.phone_digits) : conv.phone_digits,
      },
      messages,
    };
  }

  static updateConversation(
    conversationId: number,
    updates: { status?: "open" | "resolved"; assigned_to?: string | null; unread_count?: number }
  ): void {
    const db = getDatabase();
    const sets: string[] = [];
    const params: any[] = [];
    if (updates.status && ["open", "resolved"].includes(updates.status)) {
      sets.push("status = ?");
      params.push(updates.status);
    }
    if (updates.assigned_to !== undefined) {
      sets.push("assigned_to = ?");
      params.push(updates.assigned_to || null);
    }
    if (updates.unread_count !== undefined) {
      sets.push("unread_count = ?");
      params.push(Math.max(0, updates.unread_count));
    }
    if (sets.length === 0) return;
    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(conversationId);
    db.prepare(`UPDATE whatsapp_conversations SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  }

  static async sendMessage(params: {
    leadId?: number;
    conversationId?: number;
    toPhone?: string;
    messageType?: "text" | "template";
    body: string;
    templateName?: string;
    languageCode?: string;
    user: User;
  }): Promise<{ message: WhatsAppMessage; conversation: WhatsAppConversation }> {
    const db = getDatabase();
    const cfg = this.getRawConfig();
    if (!cfg.kapso_api_key || !cfg.phone_number_id) {
      throw new Error(
        "Kapso WhatsApp is not configured yet. Ask an Admin to add the API Key & Phone Number ID in WhatsApp → Kapso Setup."
      );
    }

    let conv: any = null;
    if (params.conversationId) {
      conv = db
        .prepare(`SELECT * FROM whatsapp_conversations WHERE id = ?`)
        .get(params.conversationId);
    } else if (params.leadId) {
      conv = this.getOrCreateConversationForLead(params.leadId);
    } else if (params.toPhone) {
      const digits = normalizePhoneDigits(params.toPhone);
      if (digits.length < 7) throw new Error("Invalid recipient phone number");
      conv = db
        .prepare(`SELECT * FROM whatsapp_conversations WHERE phone_digits = ?`)
        .get(digits);
      if (!conv) {
        const now = new Date().toISOString();
        const res = db
          .prepare(
            `INSERT INTO whatsapp_conversations (phone_number, phone_digits, assigned_to, status, last_message_at, updated_at)
             VALUES (?, ?, ?, 'open', ?, ?)`
          )
          .run(params.toPhone, digits, params.user.id, now, now);
        conv = db
          .prepare(`SELECT * FROM whatsapp_conversations WHERE id = ?`)
          .get(Number(res.lastInsertRowid));
      }
    }

    if (!conv) throw new Error("Conversation or Lead not found");

    const toDigits = normalizePhoneDigits(conv.phone_digits || conv.phone_number);
    const msgType = params.messageType === "template" && params.templateName ? "template" : "text";
    const textBody = String(params.body || "").trim();
    if (!textBody && msgType === "text") {
      throw new Error("Message body is required");
    }

    const kapsoPayload =
      msgType === "template"
        ? {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toDigits,
            type: "template",
            template: {
              name: params.templateName,
              language: { code: params.languageCode || "en" },
            },
          }
        : {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: toDigits,
            type: "text",
            text: { body: textBody },
          };

    const apiRes = await fetch(
      `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": cfg.kapso_api_key,
        },
        body: JSON.stringify(kapsoPayload),
      }
    );

    const apiJson = await apiRes.json().catch(() => ({}));
    const now = new Date().toISOString();
    const kapsoMsgId = apiJson?.messages?.[0]?.id || apiJson?.id || null;
    const status = apiRes.ok ? "sent" : "failed";
    const errorMsg = apiRes.ok
      ? null
      : apiJson?.error?.message || apiJson?.message || `Kapso HTTP ${apiRes.status}`;

    const insertRes = db
      .prepare(
        `
        INSERT INTO whatsapp_messages (
          conversation_id, kapso_message_id, lead_id, direction, message_type,
          body, template_name, status, error_message, sent_by, sent_by_name, created_at
        ) VALUES (?, ?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        conv.id,
        kapsoMsgId,
        conv.lead_id || null,
        msgType,
        textBody || `[Template: ${params.templateName}]`,
        params.templateName || null,
        status,
        errorMsg,
        params.user.id,
        params.user.name,
        now
      );

    db.prepare(
      `
      UPDATE whatsapp_conversations
      SET
        last_message_preview = ?,
        last_message_direction = 'outbound',
        last_message_at = ?,
        updated_at = ?,
        status = 'open',
        unread_count = 0
      WHERE id = ?
    `
    ).run((textBody || `[Template: ${params.templateName}]`).slice(0, 120), now, now, conv.id);

    if (conv.lead_id && apiRes.ok) {
      db.prepare(
        `
        INSERT INTO lead_activities (
          lead_id, activity_type, title, description, new_value, performed_by_id, performed_by_name
        ) VALUES (?, 'whatsapp', 'WhatsApp Sent (Kapso)', ?, ?, ?, ?)
      `
      ).run(
        conv.lead_id,
        textBody.slice(0, 240),
        params.templateName || "Kapso Integrated Chat",
        params.user.id,
        params.user.name
      );
    }

    if (!apiRes.ok) {
      throw new Error(errorMsg || "Failed to send WhatsApp message via Kapso");
    }

    SyncService.publish("system", `wa_msg:${conv.id}`);
    const savedMessage = db
      .prepare(`SELECT * FROM whatsapp_messages WHERE id = ?`)
      .get(Number(insertRes.lastInsertRowid)) as WhatsAppMessage;
    const updatedConv = db
      .prepare(`SELECT * FROM whatsapp_conversations WHERE id = ?`)
      .get(conv.id) as WhatsAppConversation;

    return { message: savedMessage, conversation: updatedConv };
  }

  static async syncTemplatesFromKapso(): Promise<{ synced: number; templates: any[] }> {
    const cfg = this.getRawConfig();
    if (!cfg.kapso_api_key || !cfg.business_account_id) {
      throw new Error("Kapso API Key and Business Account ID (WABA) are required to sync templates.");
    }

    const res = await fetch(
      `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.business_account_id}/message_templates?limit=100`,
      { headers: { "X-API-Key": cfg.kapso_api_key } }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || json?.message || `Kapso HTTP ${res.status}`);
    }

    const list: any[] = Array.isArray(json?.data) ? json.data : [];
    const db = getDatabase();
    let synced = 0;

    for (const tpl of list) {
      const name = String(tpl?.name || "").trim();
      if (!name) continue;
      const bodyComp = Array.isArray(tpl?.components)
        ? tpl.components.find((c: any) => c.type === "BODY")
        : null;
      const bodyText = bodyComp?.text || `[Kapso Template: ${name}]`;
      const category = String(tpl?.category || "UTILITY");
      const id = `kapso_${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;

      db.prepare(
        `
        INSERT INTO whatsapp_templates (id, name, category, template_body, is_default)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          category = excluded.category,
          template_body = excluded.template_body
      `
      ).run(id, name, category, bodyText);
      synced++;
    }

    return { synced, templates: list };
  }

  static processWebhook(payload: any, eventHeader?: string | null): { processed: number } {
    const events: any[] =
      payload?.batch && Array.isArray(payload?.data)
        ? payload.data
        : [payload];

    const db = getDatabase();
    let processed = 0;

    for (const ev of events) {
      const eventType = String(ev?.event || ev?.type || eventHeader || "");
      const msg = ev?.message || ev?.data?.message || null;
      const convData = ev?.conversation || ev?.data?.conversation || null;
      const kapsoMsg = msg?.kapso || {};

      // Status update handling
      if (msg?.id && kapsoMsg?.status && eventType.includes("status")) {
        const mappedStatus = ["sent", "delivered", "read", "failed"].includes(kapsoMsg.status)
          ? kapsoMsg.status
          : null;
        if (mappedStatus) {
          db.prepare(`UPDATE whatsapp_messages SET status = ? WHERE kapso_message_id = ?`).run(
            mappedStatus,
            msg.id
          );
          processed++;
        }
        continue;
      }

      // Inbound message handling
      const direction = kapsoMsg?.direction === "outbound" ? "outbound" : "inbound";
      if (!msg && !convData) continue;

      const rawPhone =
        convData?.phone_number ||
        msg?.from ||
        convData?.wa_id ||
        convData?.id ||
        "";
      const phoneDigits = normalizePhoneDigits(rawPhone);
      if (!phoneDigits) continue;

      const bodyText =
        kapsoMsg?.content ||
        msg?.text?.body ||
        kapsoMsg?.transcript ||
        (kapsoMsg?.has_media ? "[Media attachment]" : "[WhatsApp Message]");
      const contactName = convData?.contact_name || null;
      const kapsoConvId = convData?.id || null;
      const kapsoMsgId = msg?.id || null;
      const now = new Date().toISOString();

      // Dedupe if kapso_message_id already recorded
      if (kapsoMsgId) {
        const dup = db
          .prepare(`SELECT id FROM whatsapp_messages WHERE kapso_message_id = ?`)
          .get(kapsoMsgId);
        if (dup) continue;
      }

      // Match lead by phone_digits
      const matchedLead = db
        .prepare(
          `SELECT id, name, assigned_to FROM leads WHERE phone_digits = ? OR phone_digits LIKE ? LIMIT 1`
        )
        .get(phoneDigits, `%${phoneDigits.slice(-10)}`) as any;

      let conv = db
        .prepare(`SELECT * FROM whatsapp_conversations WHERE phone_digits = ?`)
        .get(phoneDigits) as any;

      if (!conv) {
        const res = db
          .prepare(
            `
            INSERT INTO whatsapp_conversations (
              kapso_conversation_id, lead_id, phone_number, phone_digits, contact_name,
              assigned_to, status, unread_count, last_message_preview, last_message_direction,
              last_message_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
          `
          )
          .run(
            kapsoConvId,
            matchedLead?.id || null,
            rawPhone || phoneDigits,
            phoneDigits,
            contactName || matchedLead?.name || null,
            matchedLead?.assigned_to || null,
            direction === "inbound" ? 1 : 0,
            String(bodyText).slice(0, 120),
            direction,
            now,
            now
          );
        conv = db
          .prepare(`SELECT * FROM whatsapp_conversations WHERE id = ?`)
          .get(Number(res.lastInsertRowid));
      } else {
        db.prepare(
          `
          UPDATE whatsapp_conversations
          SET
            kapso_conversation_id = COALESCE(kapso_conversation_id, ?),
            lead_id = COALESCE(lead_id, ?),
            contact_name = COALESCE(?, contact_name),
            unread_count = unread_count + ?,
            last_message_preview = ?,
            last_message_direction = ?,
            last_message_at = ?,
            updated_at = ?,
            status = 'open'
          WHERE id = ?
        `
        ).run(
          kapsoConvId,
          matchedLead?.id || null,
          contactName,
          direction === "inbound" ? 1 : 0,
          String(bodyText).slice(0, 120),
          direction,
          now,
          now,
          conv.id
        );
      }

      db.prepare(
        `
        INSERT INTO whatsapp_messages (
          conversation_id, kapso_message_id, lead_id, direction, message_type,
          body, media_url, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        conv.id,
        kapsoMsgId,
        matchedLead?.id || conv.lead_id || null,
        direction,
        kapsoMsg?.has_media ? "image" : "text",
        bodyText,
        kapsoMsg?.media_url || null,
        direction === "inbound" ? "delivered" : "sent",
        now
      );

      if (direction === "inbound") {
        const targetUser = conv.assigned_to || matchedLead?.assigned_to;
        if (targetUser) {
          const senderLabel = contactName || matchedLead?.name || rawPhone;
          db.prepare(
            `
            INSERT INTO user_notifications (user_id, title, message, type, priority, metadata)
            VALUES (?, ?, ?, 'system', 'high', ?)
          `
          ).run(
            targetUser,
            `New WhatsApp from ${senderLabel}`,
            String(bodyText).slice(0, 180),
            JSON.stringify({ lead_id: matchedLead?.id || conv.lead_id, conversation_id: conv.id })
          );

          PushNotificationService.sendToUser(targetUser, {
            title: `WhatsApp: ${senderLabel}`,
            body: String(bodyText).slice(0, 180),
            priority: "high",
            data: { type: "whatsapp", lead_id: matchedLead?.id || conv.lead_id, conversation_id: conv.id },
          });
        }
      }

      processed++;
    }

    if (processed > 0) {
      SyncService.publish("system", "whatsapp_webhook");
    }
    return { processed };
  }
}
