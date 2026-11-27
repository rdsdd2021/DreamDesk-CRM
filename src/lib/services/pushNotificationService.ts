import { getDatabase } from "@/lib/db/database";

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: "default" | "normal" | "high";
}

export class PushNotificationService {
  static registerToken(
    userId: string,
    token: string,
    platform = "android",
    deviceName?: string | null
  ): void {
    const cleanToken = token.trim();
    if (!userId || !cleanToken) return;

    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(
      `
      INSERT INTO push_tokens (user_id, token, platform, device_name, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, token) DO UPDATE SET
        platform = excluded.platform,
        device_name = COALESCE(excluded.device_name, push_tokens.device_name),
        updated_at = excluded.updated_at
    `
    ).run(userId, cleanToken, platform, deviceName || null, now);
  }

  static unregisterToken(userId: string, token?: string): void {
    const db = getDatabase();
    if (token && token.trim()) {
      db.prepare(`DELETE FROM push_tokens WHERE user_id = ? AND token = ?`).run(
        userId,
        token.trim()
      );
      return;
    }
    db.prepare(`DELETE FROM push_tokens WHERE user_id = ?`).run(userId);
  }

  static sendToUser(userId: string, payload: PushPayload): void {
    if (!userId) return;

    let tokens: { token: string }[] = [];
    try {
      const db = getDatabase();
      tokens = db
        .prepare(`SELECT token FROM push_tokens WHERE user_id = ?`)
        .all(userId) as { token: string }[];
    } catch {
      return;
    }

    const expoTokens = tokens
      .map((r) => r.token)
      .filter((t) => t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken["));

    if (expoTokens.length === 0) return;

    const messages = expoTokens.map((to) => ({
      to,
      sound: "default",
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: payload.priority === "high" ? "high" : "default",
      channelId: "dreamdesk-alerts",
    }));

    // Fire-and-forget via Expo Push API so SQLite transactions never block
    void fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
        const invalidTokens: string[] = [];
        tickets.forEach((ticket, idx) => {
          if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
            invalidTokens.push(expoTokens[idx]);
          }
        });
        if (invalidTokens.length > 0) {
          const db = getDatabase();
          const del = db.prepare(`DELETE FROM push_tokens WHERE token = ?`);
          for (const bad of invalidTokens) {
            del.run(bad);
          }
        }
      })
      .catch(() => {
        // Ignore transient network failures
      });
  }
}
