import { getDatabase } from "@/lib/db/database";
import { PushNotificationService } from "@/lib/services/pushNotificationService";
import { SyncService } from "@/lib/services/syncService";
import {
  BroadcastActionButton,
  BroadcastRecipientRecord,
  BroadcastRecord,
  BroadcastTargetType,
  TaskPriority,
  User,
} from "@/types/crm";

export interface SendBroadcastInput {
  title: string;
  message: string;
  priority?: TaskPriority;
  target_type: BroadcastTargetType;
  target_values?: string[];
  action_buttons?: BroadcastActionButton[];
  require_ack?: boolean;
}

export class BroadcastService {
  private static sanitizeButtons(buttons?: BroadcastActionButton[]): BroadcastActionButton[] {
    if (!Array.isArray(buttons)) return [];
    const seen = new Set<string>();
    const out: BroadcastActionButton[] = [];
    for (let i = 0; i < buttons.length; i++) {
      const b = buttons[i];
      const label = String(b?.label || "").trim();
      if (!label) continue;
      let id = String(b?.id || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
      if (!id) {
        id = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `btn_${i + 1}`;
      }
      if (seen.has(id)) id = `${id}_${i + 1}`;
      seen.add(id);
      const variant = ["primary", "secondary", "success", "warning", "danger"].includes(b?.variant)
        ? b.variant
        : "primary";
      out.push({ id, label: label.slice(0, 40), variant });
      if (out.length >= 6) break;
    }
    return out;
  }

  static getEligibleRecipients(sender: User): User[] {
    const db = getDatabase();
    if (sender.role === "admin") {
      return db
        .prepare(`SELECT id, name, email, role, status, avatar_color, team_lead_id FROM users WHERE status = 'active' ORDER BY name ASC`)
        .all() as User[];
    }
    if (sender.role === "team_lead") {
      return db
        .prepare(
          `SELECT id, name, email, role, status, avatar_color, team_lead_id
           FROM users
           WHERE status = 'active' AND (team_lead_id = ? OR id = ?)
           ORDER BY name ASC`
        )
        .all(sender.id, sender.id) as User[];
    }
    return [];
  }

  static resolveRecipients(
    sender: User,
    targetType: BroadcastTargetType,
    targetValues: string[] = []
  ): User[] {
    const eligible = this.getEligibleRecipients(sender);
    if (eligible.length === 0) return [];

    if (targetType === "all") {
      return eligible;
    }

    const cleanValues = Array.from(new Set(targetValues.map((v) => String(v).trim()).filter(Boolean)));
    if (cleanValues.length === 0) return [];

    if (targetType === "roles") {
      const roleSet = new Set(cleanValues);
      return eligible.filter((u) => roleSet.has(u.role));
    }

    if (targetType === "users") {
      const idSet = new Set(cleanValues);
      return eligible.filter((u) => idSet.has(u.id));
    }

    return [];
  }

  static sendBroadcast(sender: User, input: SendBroadcastInput): BroadcastRecord {
    if (!["admin", "team_lead"].includes(sender.role)) {
      throw new Error("Only Admins and Team Leads can send broadcasts.");
    }

    const title = String(input.title || "").trim();
    const message = String(input.message || "").trim();
    if (!title || !message) {
      throw new Error("Broadcast title and message are required.");
    }

    const priority: TaskPriority = ["low", "normal", "high", "urgent"].includes(String(input.priority))
      ? (input.priority as TaskPriority)
      : "normal";
    const targetType: BroadcastTargetType = ["all", "roles", "users"].includes(input.target_type)
      ? input.target_type
      : "all";
    const targetValues = Array.isArray(input.target_values)
      ? input.target_values.map((v) => String(v).trim()).filter(Boolean)
      : [];
    const actionButtons = this.sanitizeButtons(input.action_buttons);
    const requireAck = Boolean(input.require_ack) && actionButtons.length > 0;

    const recipients = this.resolveRecipients(sender, targetType, targetValues);
    if (recipients.length === 0) {
      throw new Error("No eligible active recipients matched the selected target.");
    }

    const db = getDatabase();
    const now = new Date().toISOString();

    const insertBroadcast = db.prepare(`
      INSERT INTO broadcasts (
        title, message, priority, target_type, target_values, action_buttons,
        require_ack, created_by, created_by_name, created_by_role, total_recipients, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertNotif = db.prepare(`
      INSERT INTO user_notifications (user_id, title, message, type, priority, metadata, is_read, created_at)
      VALUES (?, ?, ?, 'broadcast', ?, ?, 0, ?)
    `);

    const insertRecipient = db.prepare(`
      INSERT INTO broadcast_recipients (broadcast_id, user_id, notification_id, delivered_at)
      VALUES (?, ?, ?, ?)
    `);

    const broadcastId = db.transaction(() => {
      const res = insertBroadcast.run(
        title,
        message,
        priority,
        targetType,
        JSON.stringify(targetValues),
        JSON.stringify(actionButtons),
        requireAck ? 1 : 0,
        sender.id,
        sender.name,
        sender.role,
        recipients.length,
        now
      );
      const bid = Number(res.lastInsertRowid);

      const metadataJson = JSON.stringify({
        broadcast_id: bid,
        sender_id: sender.id,
        sender_name: sender.name,
        sender_role: sender.role,
        action_buttons: actionButtons,
        require_ack: requireAck,
      });

      for (const recipient of recipients) {
        const notifRes = insertNotif.run(
          recipient.id,
          title,
          message,
          priority,
          metadataJson,
          now
        );
        insertRecipient.run(bid, recipient.id, Number(notifRes.lastInsertRowid), now);
      }

      return bid;
    })();

    // Dispatch push notifications asynchronously outside SQLite transaction
    for (const recipient of recipients) {
      PushNotificationService.sendToUser(recipient.id, {
        title,
        body: message,
        priority: priority === "urgent" || priority === "high" ? "high" : "default",
        data: {
          type: "broadcast",
          broadcast_id: broadcastId,
          require_ack: requireAck,
        },
      });
    }

    SyncService.publish("system", `broadcast:${broadcastId}`);
    return this.listBroadcasts(sender, 1, broadcastId)[0];
  }

  static listBroadcasts(
    viewer: User,
    limit = 50,
    onlyId?: number
  ): BroadcastRecord[] {
    const db = getDatabase();
    const params: any[] = [];
    const conditions: string[] = [];

    if (viewer.role !== "admin") {
      conditions.push("b.created_by = ?");
      params.push(viewer.id);
    }
    if (onlyId) {
      conditions.push("b.id = ?");
      params.push(onlyId);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    const rows = db
      .prepare(
        `
        SELECT
          b.*,
          (SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = b.id AND br.read_at IS NOT NULL) AS read_count,
          (SELECT COUNT(*) FROM broadcast_recipients br WHERE br.broadcast_id = b.id AND br.responded_at IS NOT NULL) AS responded_count
        FROM broadcasts b
        ${whereSql}
        ORDER BY b.id DESC
        LIMIT ?
      `
      )
      .all(...params) as any[];

    const breakdownStmt = db.prepare(`
      SELECT response_action_label, COUNT(*) AS cnt
      FROM broadcast_recipients
      WHERE broadcast_id = ? AND response_action_label IS NOT NULL
      GROUP BY response_action_label
    `);

    return rows.map((r) => {
      const bRows = breakdownStmt.all(r.id) as { response_action_label: string; cnt: number }[];
      const breakdown: Record<string, number> = {};
      for (const br of bRows) {
        breakdown[br.response_action_label] = br.cnt;
      }
      return {
        id: r.id,
        title: r.title,
        message: r.message,
        priority: r.priority,
        target_type: r.target_type,
        target_values: JSON.parse(r.target_values || "[]"),
        action_buttons: JSON.parse(r.action_buttons || "[]"),
        require_ack: Boolean(r.require_ack),
        created_by: r.created_by,
        created_by_name: r.created_by_name,
        created_by_role: r.created_by_role,
        total_recipients: r.total_recipients,
        created_at: r.created_at,
        read_count: r.read_count || 0,
        responded_count: r.responded_count || 0,
        action_breakdown: breakdown,
      };
    });
  }

  static getBroadcastDetail(
    broadcastId: number,
    viewer: User
  ): { broadcast: BroadcastRecord; recipients: BroadcastRecipientRecord[] } | null {
    const db = getDatabase();
    const broadcast = this.listBroadcasts(viewer, 1, broadcastId)[0];
    if (!broadcast) return null;

    const recipients = db
      .prepare(
        `
        SELECT
          br.*,
          u.name AS user_name,
          u.email AS user_email,
          u.role AS user_role
        FROM broadcast_recipients br
        JOIN users u ON br.user_id = u.id
        WHERE br.broadcast_id = ?
        ORDER BY
          CASE WHEN br.responded_at IS NOT NULL THEN 0 WHEN br.read_at IS NOT NULL THEN 1 ELSE 2 END,
          u.name ASC
      `
      )
      .all(broadcastId) as BroadcastRecipientRecord[];

    return { broadcast, recipients };
  }

  static respondToBroadcast(
    broadcastId: number,
    userId: string,
    actionId: string,
    note?: string
  ): { success: boolean; action_id: string; action_label: string; responded_at: string } {
    const db = getDatabase();

    const broadcastRow = db
      .prepare(`SELECT id, action_buttons FROM broadcasts WHERE id = ?`)
      .get(broadcastId) as any;
    if (!broadcastRow) {
      throw new Error("Broadcast not found.");
    }

    const buttons: BroadcastActionButton[] = JSON.parse(broadcastRow.action_buttons || "[]");
    const chosen = buttons.find((b) => b.id === actionId);
    if (!chosen) {
      throw new Error("Invalid broadcast action button.");
    }

    const recipientRow = db
      .prepare(`SELECT * FROM broadcast_recipients WHERE broadcast_id = ? AND user_id = ?`)
      .get(broadcastId, userId) as any;
    if (!recipientRow) {
      throw new Error("You are not a recipient of this broadcast.");
    }
    if (recipientRow.responded_at) {
      return {
        success: true,
        action_id: recipientRow.response_action_id,
        action_label: recipientRow.response_action_label,
        responded_at: recipientRow.responded_at,
      };
    }

    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare(
        `
        UPDATE broadcast_recipients
        SET
          read_at = COALESCE(read_at, ?),
          response_action_id = ?,
          response_action_label = ?,
          response_note = ?,
          responded_at = ?
        WHERE broadcast_id = ? AND user_id = ?
      `
      ).run(
        now,
        chosen.id,
        chosen.label,
        note ? String(note).trim() : null,
        now,
        broadcastId,
        userId
      );

      if (recipientRow.notification_id) {
        db.prepare(`UPDATE user_notifications SET is_read = 1 WHERE id = ? AND user_id = ?`).run(
          recipientRow.notification_id,
          userId
        );
      }
    })();

    SyncService.publish("system", `broadcast_response:${broadcastId}:${userId}`);
    return {
      success: true,
      action_id: chosen.id,
      action_label: chosen.label,
      responded_at: now,
    };
  }
}
