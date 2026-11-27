import { getDatabase } from "@/lib/db/database";
import { normalizeAndValidatePhone } from "@/lib/utils/phoneNormalizer";
import { WhatsAppNumberStatus } from "@/types/crm";

export interface WhatsAppCheckRecord {
  phone_digits: string;
  status: WhatsAppNumberStatus;
  error_code?: string | null;
  source?: string | null;
  checked_at?: string | null;
}

function toDigitsKey(raw?: string | null): string {
  if (!raw) return "";
  const norm = normalizeAndValidatePhone(raw);
  if (norm.valid) return norm.digits;
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export class WhatsappCheckerService {
  static getStatus(rawPhone?: string | null): WhatsAppCheckRecord {
    const digits = toDigitsKey(rawPhone);
    if (!digits || digits.length < 7) {
      return { phone_digits: digits, status: "unknown" };
    }
    const db = getDatabase();
    const row = db
      .prepare(`SELECT * FROM phone_whatsapp_status WHERE phone_digits = ?`)
      .get(digits) as any;
    if (!row) return { phone_digits: digits, status: "unknown" };
    return {
      phone_digits: row.phone_digits,
      status: (row.status as WhatsAppNumberStatus) || "unknown",
      error_code: row.error_code || null,
      source: row.source || null,
      checked_at: row.checked_at || null,
    };
  }

  static getStatusesBulk(rawPhones: Array<string | null | undefined>): Map<string, WhatsAppNumberStatus> {
    const map = new Map<string, WhatsAppNumberStatus>();
    const digitKeys = Array.from(
      new Set(rawPhones.map((p) => toDigitsKey(p)).filter((d) => d.length >= 7))
    );
    if (digitKeys.length === 0) return map;

    const db = getDatabase();
    const CHUNK = 400;
    for (let i = 0; i < digitKeys.length; i += CHUNK) {
      const slice = digitKeys.slice(i, i + CHUNK);
      const placeholders = slice.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT phone_digits, status FROM phone_whatsapp_status WHERE phone_digits IN (${placeholders})`)
        .all(...slice) as { phone_digits: string; status: string }[];
      for (const r of rows) {
        map.set(r.phone_digits, (r.status as WhatsAppNumberStatus) || "unknown");
      }
    }
    return map;
  }

  static markStatus(
    rawPhone: string | null | undefined,
    status: WhatsAppNumberStatus,
    errorCode?: string | null,
    source: "webhook" | "external_checker" | "manual" = "webhook"
  ): void {
    const digits = toDigitsKey(rawPhone);
    if (!digits || digits.length < 7) return;
    const db = getDatabase();
    db.prepare(
      `
      INSERT INTO phone_whatsapp_status (phone_digits, status, error_code, source, checked_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(phone_digits) DO UPDATE SET
        status = excluded.status,
        error_code = excluded.error_code,
        source = excluded.source,
        checked_at = CURRENT_TIMESTAMP
    `
    ).run(digits, status, errorCode || null, source);
  }

  static async checkNumber(rawPhone: string): Promise<WhatsAppCheckRecord> {
    const digits = toDigitsKey(rawPhone);
    if (!digits || digits.length < 7) {
      return { phone_digits: digits, status: "invalid", error_code: "INVALID_FORMAT", source: "manual" };
    }

    const db = getDatabase();
    const settings = db
      .prepare(`SELECT wa_checker_url, wa_checker_token FROM whatsapp_settings WHERE id = 1`)
      .get() as { wa_checker_url?: string; wa_checker_token?: string } | undefined;

    const checkerUrl = settings?.wa_checker_url?.trim();
    if (!checkerUrl) {
      return this.getStatus(digits);
    }

    try {
      const res = await fetch(checkerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings?.wa_checker_token ? { Authorization: `Bearer ${settings.wa_checker_token}` } : {}),
        },
        body: JSON.stringify({ phone: `+${digits}`, phone_digits: digits }),
      });
      const json = await res.json().catch(() => ({}));
      const exists = Boolean(json?.exists ?? json?.onWhatsApp ?? json?.valid);
      const nextStatus: WhatsAppNumberStatus = exists ? "valid" : "invalid";
      this.markStatus(digits, nextStatus, exists ? null : "NOT_ON_WHATSAPP", "external_checker");
      return this.getStatus(digits);
    } catch {
      return this.getStatus(digits);
    }
  }
}
