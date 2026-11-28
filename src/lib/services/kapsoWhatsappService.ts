import { getDatabase } from "@/lib/db/database";
import { PushNotificationService } from "@/lib/services/pushNotificationService";
import { SyncService } from "@/lib/services/syncService";
import { maskPhoneNumber } from "@/lib/utils/phoneMasker";
import { normalizeAndValidatePhone } from "@/lib/utils/phoneNormalizer";
import { WhatsappCheckerService } from "@/lib/services/whatsappCheckerService";
import {
  User,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppSettings,
  WhatsAppTemplate,
  WhatsAppTemplateButton,
  WhatsAppTemplateHeaderType,
} from "@/types/crm";

const KAPSO_API_BASE = "https://api.kapso.ai";

function stripKapsoMediaMetadata(text?: string | null): string {
  if (!text) return "";
  return String(text)
    .replace(/\s*(?:Image|Video|Audio|Document|Media|File)\s+attached\s*\([^)]*\)\s*\[Size:[^\]]*\]\s*URL:\s*\S+/gi, "")
    .trim();
}

function detectKapsoMessageType(
  m: any,
  k: any
): "image" | "video" | "audio" | "document" | "text" {
  const rawType = String(m?.type || "").toLowerCase();
  if (rawType === "image" || rawType === "video" || rawType === "audio" || rawType === "document") {
    return rawType;
  }
  const mime = String(k?.media_data?.content_type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime) return "document";
  const content = String(k?.content || "");
  if (/Video attached/i.test(content)) return "video";
  if (/Audio attached/i.test(content)) return "audio";
  if (/Document attached/i.test(content)) return "document";
  if (/Image attached/i.test(content) || k?.has_media) return "image";
  return "text";
}

function normalizePhoneDigits(raw: string): string {
  const res = normalizeAndValidatePhone(raw);
  if (res.valid) return res.digits;
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function normalizeKapsoTimestamp(raw?: string | number | null, fallbackIso?: string): string {
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    const str = String(raw).trim();
    if (/^\d{9,11}$/.test(str)) {
      return new Date(Number(str) * 1000).toISOString();
    }
    if (/^\d{12,14}$/.test(str)) {
      return new Date(Number(str)).toISOString();
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallbackIso || new Date().toISOString();
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

  static async uploadMedia(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ id: string; url?: string }> {
    const cfg = this.getRawConfig();
    if (!cfg.kapso_api_key || !cfg.phone_number_id) {
      throw new Error("Kapso API Key and Phone Number ID are required to upload media.");
    }

    const ext = String(fileName || "").split(".").pop()?.toLowerCase() || "";
    const extMimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      mp4: "video/mp4",
      "3gp": "video/3gpp",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      mp3: "audio/mpeg",
      ogg: "audio/ogg",
      aac: "audio/aac",
    };
    const resolvedMime =
      mimeType && mimeType !== "application/octet-stream"
        ? mimeType.split(";")[0].trim()
        : extMimeMap[ext] || "application/octet-stream";

    if (resolvedMime.startsWith("image/") && fileBuffer.length > 5 * 1024 * 1024) {
      throw new Error(
        `Image is ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB, exceeding Meta's 5 MB limit.`
      );
    }
    if ((resolvedMime.startsWith("video/") || resolvedMime.startsWith("audio/")) && fileBuffer.length > 16 * 1024 * 1024) {
      throw new Error(
        `Media is ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB, exceeding Meta's 16 MB limit.`
      );
    }

    const safeName = (fileName || "upload").replace(/[^\w.\-]/g, "_");
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("type", resolvedMime);
    const fileObj =
      typeof File !== "undefined"
        ? new File([new Uint8Array(fileBuffer)], safeName, { type: resolvedMime })
        : new Blob([new Uint8Array(fileBuffer)], { type: resolvedMime });
    formData.append("file", fileObj, safeName);

    const res = await fetch(
      `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.phone_number_id}/media`,
      {
        method: "POST",
        headers: { "X-API-Key": cfg.kapso_api_key },
        body: formData,
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.id) {
      const detail = json?.error?.message || json?.message || `Kapso Media Upload HTTP ${res.status}`;
      throw new Error(`${detail} [${resolvedMime}, ${fileBuffer.length}B]`);
    }
    return { id: String(json.id), url: json.url };
  }

  static async registerWebhookWithKapso(webhookUrl: string): Promise<{ ok: boolean; webhook?: any; message: string }> {
    const cfg = this.getRawConfig();
    if (!cfg.kapso_api_key || !cfg.phone_number_id) {
      throw new Error("Kapso API Key and Phone Number ID are required.");
    }
    const cleanUrl = String(webhookUrl || "").trim();
    if (!cleanUrl.startsWith("https://")) {
      throw new Error("Webhook URL must be a public https:// URL.");
    }

    // Check existing webhooks first to avoid 422 duplicate URL errors
    const listRes = await fetch(
      `${KAPSO_API_BASE}/platform/v1/whatsapp/phone_numbers/${cfg.phone_number_id}/webhooks`,
      { headers: { "X-API-Key": cfg.kapso_api_key } }
    );
    if (listRes.ok) {
      const listJson = await listRes.json().catch(() => ({}));
      const existingList: any[] = Array.isArray(listJson?.data)
        ? listJson.data
        : Array.isArray(listJson?.whatsapp_webhooks)
        ? listJson.whatsapp_webhooks
        : [];
      const already = existingList.find((w) => String(w?.url || "").trim() === cleanUrl);
      const desiredEvents = [
        "whatsapp.message.received",
        "whatsapp.message.sent",
        "whatsapp.message.delivered",
        "whatsapp.message.read",
        "whatsapp.message.failed",
      ];
      if (already) {
        // Ensure all 5 events & kind="kapso" are active on the existing webhook
        if (already.id) {
          await fetch(
            `${KAPSO_API_BASE}/platform/v1/whatsapp/phone_numbers/${cfg.phone_number_id}/webhooks/${already.id}`,
            {
              method: "PATCH",
              headers: {
                "X-API-Key": cfg.kapso_api_key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                whatsapp_webhook: {
                  kind: "kapso",
                  active: true,
                  events: desiredEvents,
                },
              }),
            }
          ).catch(() => {});
        }
        return {
          ok: true,
          webhook: already,
          message: `Webhook verified & synced with Kapso (${desiredEvents.length} events active).`,
        };
      }
    }

    const res = await fetch(
      `${KAPSO_API_BASE}/platform/v1/whatsapp/phone_numbers/${cfg.phone_number_id}/webhooks`,
      {
        method: "POST",
        headers: {
          "X-API-Key": cfg.kapso_api_key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whatsapp_webhook: {
            kind: "kapso",
            url: cleanUrl,
            events: [
              "whatsapp.message.received",
              "whatsapp.message.sent",
              "whatsapp.message.delivered",
              "whatsapp.message.read",
              "whatsapp.message.failed",
            ],
            ...(cfg.webhook_secret && cfg.webhook_secret.length >= 8 ? { secret_key: cfg.webhook_secret } : {}),
          },
        }),
      }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errDetail =
        json?.error?.message ||
        json?.message ||
        (Array.isArray(json?.errors) ? json.errors.map((e: any) => e?.message || JSON.stringify(e)).join("; ") : null) ||
        JSON.stringify(json);
      throw new Error(`Kapso Webhook HTTP ${res.status}: ${errDetail}`);
    }
    return { ok: true, webhook: json?.data || json, message: "Webhook registered with Kapso successfully!" };
  }

  static listTemplates(onlyApproved = false): WhatsAppTemplate[] {
    const db = getDatabase();
    const sql = onlyApproved
      ? `SELECT * FROM whatsapp_templates WHERE status = 'APPROVED' ORDER BY name ASC`
      : `SELECT * FROM whatsapp_templates ORDER BY COALESCE(synced_at, created_at) DESC, name ASC`;
    const rows = db.prepare(sql).all() as any[];

    return rows.map((r) => ({
      id: r.id,
      kapso_template_id: r.kapso_template_id || null,
      name: r.name,
      category: r.category || "UTILITY",
      language: r.language || "en_US",
      parameter_format: (r.parameter_format as any) || "NAMED",
      status: (r.status as any) || "APPROVED",
      header_type: (r.header_type as any) || "NONE",
      header_content: r.header_content || null,
      template_body: r.template_body,
      footer_text: r.footer_text || null,
      buttons: r.buttons_json ? JSON.parse(r.buttons_json) : [],
      variables: r.variables_json ? JSON.parse(r.variables_json) : [],
      rejected_reason: r.rejected_reason || null,
      is_default: r.is_default,
      synced_at: r.synced_at || null,
      created_at: r.created_at,
    }));
  }

  static async createAndSubmitTemplate(input: {
    name: string;
    category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
    language: string;
    parameter_format: "NAMED" | "POSITIONAL";
    header_type: WhatsAppTemplateHeaderType;
    header_text?: string;
    header_handle?: string;
    body_text: string;
    footer_text?: string;
    variables?: { name: string; example: string }[];
    buttons?: WhatsAppTemplateButton[];
  }): Promise<WhatsAppTemplate> {
    const cfg = this.getRawConfig();
    if (!cfg.kapso_api_key || !cfg.business_account_id) {
      throw new Error(
        "Kapso API Key and Business Account ID (WABA) are required to submit templates to Meta."
      );
    }

    const cleanName = String(input.name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!cleanName) throw new Error("Template name is required (lowercase letters, numbers, underscores).");
    if (!input.body_text?.trim()) throw new Error("Template body text is required.");

    const components: any[] = [];

    // 1. HEADER
    if (input.header_type && input.header_type !== "NONE") {
      if (input.header_type === "TEXT") {
        if (!input.header_text?.trim()) throw new Error("Header text is required for TEXT header.");
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: input.header_text.trim(),
        });
      } else {
        if (!input.header_handle?.trim()) {
          throw new Error(`Sample media handle is required for ${input.header_type} header.`);
        }
        components.push({
          type: "HEADER",
          format: input.header_type,
          example: { header_handle: [input.header_handle.trim()] },
        });
      }
    }

    // 2. BODY
    const bodyComp: any = {
      type: "BODY",
      text: input.body_text.trim(),
    };
    const vars = Array.isArray(input.variables) ? input.variables.filter((v) => v.name) : [];
    if (vars.length > 0) {
      if (input.parameter_format === "NAMED") {
        bodyComp.example = {
          body_text_named_params: vars.map((v) => ({
            param_name: v.name,
            example: v.example || "Sample",
          })),
        };
      } else {
        bodyComp.example = {
          body_text: [vars.map((v) => v.example || "Sample")],
        };
      }
    }
    components.push(bodyComp);

    // 3. FOOTER
    if (input.footer_text?.trim()) {
      components.push({
        type: "FOOTER",
        text: input.footer_text.trim().slice(0, 60),
      });
    }

    // 4. BUTTONS
    const cleanButtons = (input.buttons || []).filter((b) => b.text?.trim()).slice(0, 3);
    if (cleanButtons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: cleanButtons.map((b) => {
          if (b.type === "URL") return { type: "URL", text: b.text.trim(), url: b.url?.trim() || "https://example.com" };
          if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text.trim(), phone_number: b.phone_number?.trim() || "+910000000000" };
          return { type: "QUICK_REPLY", text: b.text.trim() };
        }),
      });
    }

    const payload = {
      name: cleanName,
      category: input.category,
      language: input.language || "en_US",
      parameter_format: input.parameter_format || "NAMED",
      components,
    };

    const res = await fetch(
      `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.business_account_id}/message_templates`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": cfg.kapso_api_key,
        },
        body: JSON.stringify(payload),
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || json?.message || `Meta/Kapso returned HTTP ${res.status}`);
    }

    const db = getDatabase();
    const id = `kapso_${cleanName}_${payload.language}`;
    const now = new Date().toISOString();
    const status = String(json?.status || "PENDING").toUpperCase();

    db.prepare(
      `
      INSERT INTO whatsapp_templates (
        id, kapso_template_id, name, category, language, parameter_format, status,
        header_type, header_content, template_body, footer_text, buttons_json,
        components_json, variables_json, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        kapso_template_id = excluded.kapso_template_id,
        category = excluded.category,
        language = excluded.language,
        parameter_format = excluded.parameter_format,
        status = excluded.status,
        header_type = excluded.header_type,
        header_content = excluded.header_content,
        template_body = excluded.template_body,
        footer_text = excluded.footer_text,
        buttons_json = excluded.buttons_json,
        components_json = excluded.components_json,
        variables_json = excluded.variables_json,
        synced_at = excluded.synced_at
    `
    ).run(
      id,
      json?.id ? String(json.id) : null,
      cleanName,
      payload.category,
      payload.language,
      payload.parameter_format,
      status,
      input.header_type || "NONE",
      input.header_text || input.header_handle || null,
      input.body_text.trim(),
      input.footer_text?.trim() || null,
      JSON.stringify(cleanButtons),
      JSON.stringify(components),
      JSON.stringify(vars),
      now
    );

    return this.listTemplates(false).find((t) => t.id === id)!;
  }

  static async deleteTemplate(templateId: string): Promise<void> {
    const db = getDatabase();
    const existing = db.prepare(`SELECT * FROM whatsapp_templates WHERE id = ?`).get(templateId) as any;
    if (!existing) return;

    const cfg = this.getRawConfig();
    if (cfg.kapso_api_key && cfg.business_account_id && existing.name) {
      const url = `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.business_account_id}/message_templates?name=${encodeURIComponent(existing.name)}`;
      await fetch(url, {
        method: "DELETE",
        headers: { "X-API-Key": cfg.kapso_api_key },
      }).catch(() => {});
    }

    db.prepare(`DELETE FROM whatsapp_templates WHERE id = ?`).run(templateId);
  }

  static async syncTemplatesFromKapso(): Promise<{ synced: number; templates: WhatsAppTemplate[] }> {
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
    const now = new Date().toISOString();
    let synced = 0;

    for (const tpl of list) {
      const name = String(tpl?.name || "").trim();
      if (!name) continue;
      const comps: any[] = Array.isArray(tpl?.components) ? tpl.components : [];
      const headerComp = comps.find((c) => c.type === "HEADER");
      const bodyComp = comps.find((c) => c.type === "BODY");
      const footerComp = comps.find((c) => c.type === "FOOTER");
      const btnsComp = comps.find((c) => c.type === "BUTTONS");

      const bodyText = bodyComp?.text || `[Kapso Template: ${name}]`;
      const category = String(tpl?.category || "UTILITY");
      const language = String(tpl?.language || "en_US");
      const status = String(tpl?.status || "APPROVED").toUpperCase();
      const headerType = (headerComp?.format || "NONE") as WhatsAppTemplateHeaderType;
      const headerContent = headerComp?.text || headerComp?.example?.header_handle?.[0] || null;
      const footerText = footerComp?.text || null;
      const buttons = Array.isArray(btnsComp?.buttons) ? btnsComp.buttons : [];

      // Extract {{var}} placeholders from header (if TEXT) and bodyText
      const headerMatches =
        headerType === "TEXT" && headerComp?.text
          ? Array.from(String(headerComp.text).matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)).map((m: any) => String(m[1]))
          : [];
      const bodyMatches = Array.from(bodyText.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)).map((m: any) => String(m[1]));
      const allMatches = [...headerMatches, ...bodyMatches];
      const uniqueVars = Array.from(new Set(allMatches)).map((v) => ({ name: v, example: "" }));
      const isNumericVars = allMatches.length > 0 && allMatches.every((v) => /^\d+$/.test(v));
      const paramFormat =
        tpl?.parameter_format === "POSITIONAL" || (!tpl?.parameter_format && isNumericVars)
          ? "POSITIONAL"
          : "NAMED";

      const id = `kapso_${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}_${language}`;

      db.prepare(
        `
        INSERT INTO whatsapp_templates (
          id, kapso_template_id, name, category, language, parameter_format, status,
          header_type, header_content, template_body, footer_text, buttons_json,
          components_json, variables_json, rejected_reason, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          kapso_template_id = excluded.kapso_template_id,
          category = excluded.category,
          language = excluded.language,
          parameter_format = excluded.parameter_format,
          status = excluded.status,
          header_type = excluded.header_type,
          header_content = excluded.header_content,
          template_body = excluded.template_body,
          footer_text = excluded.footer_text,
          buttons_json = excluded.buttons_json,
          components_json = excluded.components_json,
          variables_json = excluded.variables_json,
          rejected_reason = excluded.rejected_reason,
          synced_at = excluded.synced_at
      `
      ).run(
        id,
        tpl?.id ? String(tpl.id) : null,
        name,
        category,
        language,
        paramFormat,
        status,
        headerType,
        headerContent,
        bodyText,
        footerText,
        JSON.stringify(buttons),
        JSON.stringify(comps),
        JSON.stringify(uniqueVars),
        tpl?.rejected_reason || null,
        now
      );
      synced++;
    }

    return { synced, templates: this.listTemplates(false) };
  }

  static async syncHistoryFromKapso(): Promise<{ conversationsSynced: number; messagesSynced: number }> {
    const cfg = this.getRawConfig();
    if (!cfg.kapso_api_key || !cfg.phone_number_id) {
      throw new Error("Kapso API Key and Phone Number ID are required to sync chat history.");
    }

    const db = getDatabase();
    const convRes = await fetch(
      `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.phone_number_id}/conversations?limit=50`,
      { headers: { "X-API-Key": cfg.kapso_api_key } }
    );
    const convJson = await convRes.json().catch(() => ({}));
    if (!convRes.ok) {
      throw new Error(convJson?.error?.message || convJson?.message || `Kapso HTTP ${convRes.status}`);
    }

    const convList: any[] = Array.isArray(convJson?.data) ? convJson.data : [];
    let conversationsSynced = 0;
    let messagesSynced = 0;

    for (const c of convList) {
      const rawPhone = c?.phone_number || c?.wa_id || "";
      const phoneDigits = normalizePhoneDigits(rawPhone);
      if (!phoneDigits) continue;

      const last10 = phoneDigits.slice(-10);
      const matchedLead =
        last10.length >= 10
          ? (db
              .prepare(
                `SELECT id, name, assigned_to FROM leads
                 WHERE phone_digits = ? OR phone_digits LIKE ? OR alternate_contacts LIKE ?
                 LIMIT 1`
              )
              .get(phoneDigits, `%${last10}`, `%${last10}%`) as any)
          : null;

      const now = c?.last_active_at || c?.updated_at || new Date().toISOString();
      let localConv = db
        .prepare(`SELECT * FROM whatsapp_conversations WHERE phone_digits = ?`)
        .get(phoneDigits) as any;

      if (!localConv) {
        const ins = db
          .prepare(
            `
            INSERT INTO whatsapp_conversations (
              kapso_conversation_id, lead_id, phone_number, phone_digits, contact_name,
              assigned_to, status, unread_count, last_message_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'open', 0, ?, ?)
          `
          )
          .run(
            c?.id || null,
            matchedLead?.id || null,
            rawPhone,
            phoneDigits,
            c?.contact_name || matchedLead?.name || null,
            matchedLead?.assigned_to || null,
            now,
            now
          );
        localConv = db
          .prepare(`SELECT * FROM whatsapp_conversations WHERE id = ?`)
          .get(Number(ins.lastInsertRowid));
        conversationsSynced++;
      } else if (c?.id && !localConv.kapso_conversation_id) {
        db.prepare(`UPDATE whatsapp_conversations SET kapso_conversation_id = ?, lead_id = COALESCE(lead_id, ?) WHERE id = ?`).run(
          c.id,
          matchedLead?.id || null,
          localConv.id
        );
      }

      if (c?.id) {
        const msgRes = await fetch(
          `${KAPSO_API_BASE}/meta/whatsapp/v24.0/${cfg.phone_number_id}/messages?conversation_id=${encodeURIComponent(c.id)}&limit=50`,
          { headers: { "X-API-Key": cfg.kapso_api_key } }
        );
        const msgJson = await msgRes.json().catch(() => ({}));
        const msgs: any[] = Array.isArray(msgJson?.data) ? msgJson.data : [];
        let latestInboundAt: string | null = c?.kapso?.last_inbound_at
          ? normalizeKapsoTimestamp(c.kapso.last_inbound_at)
          : null;
        let latestMsgAt: string | null = null;
        let latestPreview: string | null = null;
        let latestDir: string | null = null;

        for (const m of msgs) {
          const k = m?.kapso || {};
          const msgConvId = k?.whatsapp_conversation_id || k?.conversation_id;
          if (msgConvId && msgConvId !== c.id) continue;
          const kapsoMsgId = m?.id ? String(m.id) : null;
          if (kapsoMsgId) {
            const exists = db
              .prepare(`SELECT id FROM whatsapp_messages WHERE kapso_message_id = ?`)
              .get(kapsoMsgId);
            if (exists) continue;
          }
          const direction = k?.direction === "outbound" ? "outbound" : "inbound";
          const msgType = detectKapsoMessageType(m, k);
          const rawBody = stripKapsoMediaMetadata(k?.content || m?.text?.body || "");
          const bodyText = rawBody || (msgType === "text" ? "[WhatsApp Message]" : "");
          const createdAt = normalizeKapsoTimestamp(m?.timestamp || k?.timestamp, now);
          if (direction === "inbound" && (!latestInboundAt || createdAt > latestInboundAt)) {
            latestInboundAt = createdAt;
          }
          if (!latestMsgAt || createdAt > latestMsgAt) {
            latestMsgAt = createdAt;
            latestPreview = String(bodyText || `[${msgType}]`).slice(0, 120);
            latestDir = direction;
          }
          db.prepare(
            `
            INSERT INTO whatsapp_messages (
              conversation_id, kapso_message_id, lead_id, direction, message_type,
              body, media_url, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
          ).run(
            localConv.id,
            kapsoMsgId,
            matchedLead?.id || localConv.lead_id || null,
            direction,
            msgType,
            bodyText,
            k?.media_url || null,
            k?.status || (direction === "inbound" ? "delivered" : "sent"),
            createdAt
          );
          messagesSynced++;
        }

        if (latestMsgAt || latestInboundAt) {
          db.prepare(
            `UPDATE whatsapp_conversations
             SET last_inbound_at = COALESCE(?, last_inbound_at),
                 last_message_at = COALESCE(?, last_message_at),
                 last_message_preview = COALESCE(?, last_message_preview),
                 last_message_direction = COALESCE(?, last_message_direction)
             WHERE id = ?`
          ).run(latestInboundAt, latestMsgAt, latestPreview, latestDir, localConv.id);
        }
      }
    }

    // Clean up any empty ghost conversations with 0 messages
    db.prepare(
      `DELETE FROM whatsapp_conversations WHERE NOT EXISTS (SELECT 1 FROM whatsapp_messages wm WHERE wm.conversation_id = whatsapp_conversations.id)`
    ).run();

    return { conversationsSynced, messagesSynced };
  }

  static getExistingConversationForLead(leadId: number): WhatsAppConversation | null {
    const db = getDatabase();
    const lead = db
      .prepare(`SELECT id, phone, whatsapp_phone FROM leads WHERE id = ?`)
      .get(leadId) as any;
    if (!lead) return null;
    const rawTarget = lead.whatsapp_phone || lead.phone;
    const phoneDigits = rawTarget ? normalizePhoneDigits(rawTarget) : "";
    const conv = db
      .prepare(
        `SELECT * FROM whatsapp_conversations
         WHERE (lead_id = ? OR (? != '' AND phone_digits = ?))
         ORDER BY last_message_at DESC, id DESC LIMIT 1`
      )
      .get(lead.id, phoneDigits, phoneDigits) as any;
    return conv ? (conv as WhatsAppConversation) : null;
  }

  static purgeStaleConversations(): { deletedConversations: number; deletedMessages: number } {
    const db = getDatabase();
    const msgRes = db.prepare(`DELETE FROM whatsapp_messages`).run();
    const convRes = db.prepare(`DELETE FROM whatsapp_conversations`).run();
    SyncService.publish("system", "wa_purged");
    return {
      deletedConversations: Number(convRes.changes || 0),
      deletedMessages: Number(msgRes.changes || 0),
    };
  }

  static getOrCreateConversationForLead(leadId: number, preferredPhone?: string): WhatsAppConversation {
    const db = getDatabase();
    const lead = db
      .prepare(`SELECT id, name, phone, whatsapp_phone, assigned_to FROM leads WHERE id = ?`)
      .get(leadId) as any;
    if (!lead) throw new Error("Lead not found");

    const rawTarget = preferredPhone || lead.whatsapp_phone || lead.phone;
    const phoneDigits = normalizePhoneDigits(rawTarget);
    if (!phoneDigits || phoneDigits.length < 7) {
      throw new Error("Lead does not have a valid phone number");
    }

    let conv = db
      .prepare(`SELECT * FROM whatsapp_conversations WHERE phone_digits = ? OR (lead_id = ? AND ? IS NULL) LIMIT 1`)
      .get(phoneDigits, lead.id, preferredPhone || null) as any;

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
        .run(lead.id, rawTarget, phoneDigits, lead.name, lead.assigned_to || null, now, now);
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
    const conditions: string[] = [
      `EXISTS (SELECT 1 FROM whatsapp_messages wm WHERE wm.conversation_id = wc.id)`,
    ];
    const params: any[] = [];

    // Counselors strictly see ALL chat history for leads currently assigned to them (only their assigned leads)
    if (!userScope.canViewAllLeads) {
      conditions.push(`l.assigned_to = ?`);
      params.push(userScope.userId);
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
        LEFT JOIN users u ON COALESCE(l.assigned_to, wc.assigned_to) = u.id
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
        LEFT JOIN users u ON COALESCE(l.assigned_to, wc.assigned_to) = u.id
        WHERE wc.id = ?
      `
      )
      .get(conversationId) as any;

    if (!conv) return null;
    if (!userScope.canViewAllLeads && conv.lead_assigned_to !== userScope.userId) {
      return null;
    }

    const messages = db
      .prepare(`SELECT * FROM whatsapp_messages WHERE conversation_id = ? ORDER BY datetime(created_at) ASC, id ASC`)
      .all(conversationId) as WhatsAppMessage[];

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

  static createLeadFromConversation(convId: number, currentUser: User): { leadId: number; leadCode: string } {
    const db = getDatabase();
    const conv = db.prepare(`SELECT * FROM whatsapp_conversations WHERE id = ?`).get(convId) as any;
    if (!conv) throw new Error("Conversation not found");
    if (conv.lead_id) {
      const existing = db.prepare(`SELECT id, lead_code FROM leads WHERE id = ?`).get(conv.lead_id) as any;
      if (existing) return { leadId: existing.id, leadCode: existing.lead_code };
    }

    const norm = normalizeAndValidatePhone(conv.phone_number || conv.phone_digits);
    const e164 = norm.valid ? norm.e164 : conv.phone_number;
    const digits = norm.valid ? norm.digits : conv.phone_digits;
    const maxId = (db.prepare(`SELECT MAX(id) as maxId FROM leads`).get() as any)?.maxId || 0;
    const leadCode = `LD-${String(maxId + 1).padStart(6, "0")}`;
    const name = conv.contact_name || `WhatsApp Inquiry (${digits.slice(-4)})`;

    const res = db
      .prepare(
        `INSERT INTO leads (lead_code, name, phone, phone_digits, status, assigned_to, raw_attributes)
         VALUES (?, ?, ?, ?, 'New', ?, ?)`
      )
      .run(leadCode, name, e164, digits, conv.assigned_to || currentUser.id, JSON.stringify({ source: "WhatsApp Inbound" }));
    const leadId = Number(res.lastInsertRowid);

    db.prepare(`UPDATE whatsapp_conversations SET lead_id = ?, assigned_to = COALESCE(assigned_to, ?) WHERE id = ?`).run(
      leadId,
      conv.assigned_to || currentUser.id,
      convId
    );
    db.prepare(`UPDATE whatsapp_messages SET lead_id = ? WHERE conversation_id = ? AND lead_id IS NULL`).run(
      leadId,
      convId
    );
    db.prepare(
      `INSERT INTO lead_activities (lead_id, activity_type, title, description, new_value, performed_by_id, performed_by_name)
       VALUES (?, 'created', 'Lead Created from WhatsApp Inquiry', ?, 'New', ?, ?)`
    ).run(leadId, `Saved inbound WhatsApp contact (${e164}) as CRM Lead.`, currentUser.id, currentUser.name);

    SyncService.publish("system", `wa_conv:${convId}`);
    return { leadId, leadCode };
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
    messageType?: "text" | "template" | "image" | "document" | "video" | "audio";
    body: string;
    templateName?: string;
    languageCode?: string;
    parameterFormat?: "NAMED" | "POSITIONAL";
    templateVariables?: { name: string; value: string }[];
    headerMediaType?: WhatsAppTemplateHeaderType;
    mediaUrl?: string;
    mediaId?: string;
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
      conv = this.getOrCreateConversationForLead(params.leadId, params.toPhone);
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
    const msgType = params.messageType || "text";
    const textBody = String(params.body || "").trim();

    let kapsoPayload: any;
    if (msgType === "template" && params.templateName) {
      const components: any[] = [];
      if (params.headerMediaType && ["IMAGE", "VIDEO", "DOCUMENT"].includes(params.headerMediaType)) {
        const mediaObj = params.mediaId
          ? { id: params.mediaId }
          : params.mediaUrl
          ? { link: params.mediaUrl }
          : null;
        if (mediaObj) {
          components.push({
            type: "header",
            parameters: [
              {
                type: params.headerMediaType.toLowerCase(),
                [params.headerMediaType.toLowerCase()]: mediaObj,
              },
            ],
          });
        }
      }
      if (Array.isArray(params.templateVariables) && params.templateVariables.length > 0) {
        const isPositional =
          params.parameterFormat === "POSITIONAL" ||
          params.templateVariables.every((v) => /^\d+$/.test(String(v.name || "")));
        components.push({
          type: "body",
          parameters: params.templateVariables.map((v) =>
            isPositional
              ? { type: "text", text: v.value || " " }
              : { type: "text", parameter_name: v.name, text: v.value || " " }
          ),
        });
      }

      kapsoPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toDigits,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.languageCode || "en_US" },
          ...(components.length > 0 ? { components } : {}),
        },
      };
    } else if (["image", "document", "video", "audio"].includes(msgType) && (params.mediaId || params.mediaUrl)) {
      const mediaObj: any = params.mediaId ? { id: params.mediaId } : { link: params.mediaUrl };
      if (textBody && msgType !== "audio") mediaObj.caption = textBody;
      kapsoPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toDigits,
        type: msgType,
        [msgType]: mediaObj,
      };
    } else {
      if (!textBody) throw new Error("Message body is required");
      kapsoPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toDigits,
        type: "text",
        text: { body: textBody },
      };
    }

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
    const errorCode = apiJson?.error?.code ? String(apiJson.error.code) : "";
    const errorMsg = apiRes.ok
      ? null
      : apiJson?.error?.message || apiJson?.message || `Kapso HTTP ${apiRes.status}`;

    if (!apiRes.ok && (errorCode === "131026" || /131026|not on whatsapp|undeliverable/i.test(String(errorMsg)))) {
      WhatsappCheckerService.markStatus(toDigits, "invalid", "131026", "webhook");
    }

    const displayBody =
      textBody || (params.templateName ? `[Template: ${params.templateName}]` : "");
    const resolvedMediaUrl =
      params.mediaUrl || (params.mediaId ? `/api/whatsapp/media?id=${encodeURIComponent(params.mediaId)}` : null);
    const insertRes = db
      .prepare(
        `
        INSERT INTO whatsapp_messages (
          conversation_id, kapso_message_id, lead_id, direction, message_type,
          body, template_name, media_url, status, error_message, sent_by, sent_by_name, created_at
        ) VALUES (?, ?, ?, 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        conv.id,
        kapsoMsgId,
        conv.lead_id || null,
        msgType,
        displayBody,
        params.templateName || null,
        resolvedMediaUrl,
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
    ).run(displayBody.slice(0, 120), now, now, conv.id);

    if (conv.lead_id && apiRes.ok) {
      db.prepare(
        `
        INSERT INTO lead_activities (
          lead_id, activity_type, title, description, new_value, performed_by_id, performed_by_name
        ) VALUES (?, 'whatsapp', 'WhatsApp Sent (Kapso)', ?, ?, ?, ?)
      `
      ).run(
        conv.lead_id,
        displayBody.slice(0, 240),
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

  static processWebhook(payload: any, eventHeader?: string | null): { processed: number } {
    const events: any[] = [];
    if (payload?.batch && Array.isArray(payload?.data)) {
      events.push(...payload.data);
    } else if (Array.isArray(payload?.entry)) {
      // Meta Cloud API webhook envelope
      for (const entry of payload.entry) {
        for (const change of entry?.changes || []) {
          const val = change?.value || {};
          const contacts = Array.isArray(val?.contacts) ? val.contacts : [];
          for (const st of val?.statuses || []) {
            events.push({ event: "whatsapp.message.status", message: { id: st.id, kapso: { status: st.status } } });
          }
          for (const m of val?.messages || []) {
            const cMatch = contacts.find((c: any) => c.wa_id === m.from) || contacts[0];
            events.push({
              event: "whatsapp.message.received",
              conversation: {
                phone_number: m.from || cMatch?.wa_id,
                contact_name: cMatch?.profile?.name || null,
                wa_id: cMatch?.wa_id || m.from,
              },
              message: {
                ...m,
                kapso: { direction: "inbound", status: "received", content: m?.text?.body || "" },
              },
            });
          }
        }
      }
    } else {
      events.push(payload);
    }

    const db = getDatabase();
    let processed = 0;

    for (const ev of events) {
      const eventType = String(ev?.event || ev?.type || eventHeader || "");
      const msg = ev?.message || ev?.data?.message || null;
      const convData = ev?.conversation || ev?.data?.conversation || null;
      const kapsoMsg = msg?.kapso || {};

      const isStatusEvent =
        eventType.includes("status") ||
        [
          "whatsapp.message.sent",
          "whatsapp.message.delivered",
          "whatsapp.message.read",
          "whatsapp.message.failed",
        ].includes(eventType) ||
        (kapsoMsg?.direction === "outbound" && Boolean(msg?.id) && Boolean(kapsoMsg?.status));

      if (msg?.id && isStatusEvent) {
        const rawStatus =
          kapsoMsg?.status ||
          (eventType.endsWith(".sent")
            ? "sent"
            : eventType.endsWith(".delivered")
            ? "delivered"
            : eventType.endsWith(".read")
            ? "read"
            : eventType.endsWith(".failed")
            ? "failed"
            : null);
        const mappedStatus =
          rawStatus && ["sent", "delivered", "read", "failed"].includes(rawStatus)
            ? rawStatus
            : null;
        if (mappedStatus) {
          const updated = db
            .prepare(`UPDATE whatsapp_messages SET status = ? WHERE kapso_message_id = ?`)
            .run(mappedStatus, msg.id);
          if (updated.changes > 0) {
            SyncService.publish("system", `wa_status:${msg.id}`);
          }
          // Auto-learn WhatsApp availability from delivery/read/failure webhooks
          const msgRow = db
            .prepare(`SELECT wc.phone_digits FROM whatsapp_messages wm JOIN whatsapp_conversations wc ON wm.conversation_id = wc.id WHERE wm.kapso_message_id = ? LIMIT 1`)
            .get(msg.id) as { phone_digits?: string } | undefined;
          const targetDigits = msgRow?.phone_digits || convData?.phone_number || msg?.to || "";
          if (targetDigits) {
            if (mappedStatus === "delivered" || mappedStatus === "read") {
              WhatsappCheckerService.markStatus(targetDigits, "valid", null, "webhook");
            } else if (mappedStatus === "failed") {
              const errStr = JSON.stringify(kapsoMsg?.statuses || msg?.errors || ev?.error || "");
              if (/131026|not on whatsapp|undeliverable/i.test(errStr)) {
                WhatsappCheckerService.markStatus(targetDigits, "invalid", "131026", "webhook");
              }
            }
          }
          processed++;
        }
        continue;
      }

      const direction = kapsoMsg?.direction === "outbound" ? "outbound" : "inbound";
      if (!msg && !convData) continue;

      const rawPhone =
        convData?.phone_number ||
        msg?.from ||
        convData?.wa_id ||
        convData?.business_scoped_user_id ||
        convData?.id ||
        "";
      const phoneDigits = normalizePhoneDigits(rawPhone) || String(rawPhone || "").replace(/[^a-zA-Z0-9_-]/g, "");
      if (!phoneDigits) continue;

      if (direction === "inbound" && /^\d{7,}$/.test(phoneDigits)) {
        WhatsappCheckerService.markStatus(phoneDigits, "valid", null, "webhook");
      }

      const transcriptText =
        typeof kapsoMsg?.transcript === "string"
          ? kapsoMsg.transcript
          : kapsoMsg?.transcript?.text || "";
      const bodyText =
        kapsoMsg?.content ||
        msg?.text?.body ||
        msg?.button?.text ||
        msg?.interactive?.button_reply?.title ||
        msg?.interactive?.list_reply?.title ||
        transcriptText ||
        (kapsoMsg?.has_media ? `[${String(msg?.type || "media").toUpperCase()} attachment]` : "[WhatsApp Message]");
      const contactName = convData?.contact_name || convData?.username || null;
      const kapsoConvId = convData?.id || null;
      const kapsoMsgId = msg?.id || null;
      const now = normalizeKapsoTimestamp(msg?.timestamp || kapsoMsg?.timestamp);

      if (kapsoMsgId) {
        const dup = db
          .prepare(`SELECT id FROM whatsapp_messages WHERE kapso_message_id = ?`)
          .get(kapsoMsgId);
        if (dup) continue;
      }

      const last10 = phoneDigits.slice(-10);
      const matchedLead =
        last10.length >= 7
          ? (db
              .prepare(
                `SELECT id, name, assigned_to FROM leads
                 WHERE phone_digits = ? OR phone_digits LIKE ? OR alternate_contacts LIKE ?
                 LIMIT 1`
              )
              .get(phoneDigits, `%${last10}`, `%${last10}%`) as any)
          : null;

      let conv = db
        .prepare(`SELECT * FROM whatsapp_conversations WHERE phone_digits = ? OR (? IS NOT NULL AND kapso_conversation_id = ?) LIMIT 1`)
        .get(phoneDigits, kapsoConvId, kapsoConvId) as any;

      if (!conv) {
        const res = db
          .prepare(
            `
            INSERT INTO whatsapp_conversations (
              kapso_conversation_id, lead_id, phone_number, phone_digits, contact_name,
              assigned_to, status, unread_count, last_message_preview, last_message_direction,
              last_message_at, last_inbound_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)
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
            direction === "inbound" ? now : null,
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
            last_inbound_at = COALESCE(?, last_inbound_at),
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
          direction === "inbound" ? now : null,
          now,
          conv.id
        );
      }

      const whMsgType = detectKapsoMessageType(msg, kapsoMsg);
      const cleanWhBody = stripKapsoMediaMetadata(bodyText);
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
        whMsgType,
        cleanWhBody || (whMsgType === "text" ? bodyText : ""),
        kapsoMsg?.media_url || null,
        direction === "inbound" ? "delivered" : "sent",
        now
      );

      if (direction === "inbound") {
        const targetUser = matchedLead?.assigned_to || conv.assigned_to;
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
          SyncService.publish("notification", "whatsapp_inbound", {
            userId: targetUser,
            entityId: conv.id,
          });
        }
      }

      processed++;
    }

    if (processed > 0) {
      SyncService.publish("whatsapp_updated", "whatsapp_webhook", { data: { processed } });
    }
    return { processed };
  }
}
