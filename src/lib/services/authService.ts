import crypto from "crypto";
import { getDatabase } from "@/lib/db/database";
import { User, UserRole, AuthSession } from "@/types/crm";

export interface RolePermissions {
  canViewAllLeads: boolean;
  canExportLeads: boolean;
  canDeleteLeads: boolean;
  canManageSchema: boolean;
  canManageCampaigns: boolean;
  canManageDispositions: boolean;
  canManageTeam: boolean;
  canImportLeads: boolean;
  canViewAuditLogs: boolean;
  canAssignLeads: boolean;
  allowedViews: string[];
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canViewAllLeads: true,
    canExportLeads: true,
    canDeleteLeads: true,
    canManageSchema: true,
    canManageCampaigns: true,
    canManageDispositions: true,
    canManageTeam: true,
    canImportLeads: true,
    canViewAuditLogs: true,
    canAssignLeads: true,
    allowedViews: [
      "leads",
      "tasks",
      "dashboard",
      "pipeline",
      "campaigns",
      "dispositions",
      "fields",
      "team",
      "import",
      "activity",
    ],
  },
  team_lead: {
    canViewAllLeads: true,
    canExportLeads: true,
    canDeleteLeads: false,
    canManageSchema: false,
    canManageCampaigns: true,
    canManageDispositions: true,
    canManageTeam: true,
    canImportLeads: true,
    canViewAuditLogs: true,
    canAssignLeads: true,
    allowedViews: [
      "leads",
      "tasks",
      "dashboard",
      "pipeline",
      "campaigns",
      "dispositions",
      "team",
      "import",
      "activity",
    ],
  },
  senior_counselor: {
    canViewAllLeads: false,
    canExportLeads: false,
    canDeleteLeads: false,
    canManageSchema: false,
    canManageCampaigns: false,
    canManageDispositions: false,
    canManageTeam: false,
    canImportLeads: false,
    canViewAuditLogs: false,
    canAssignLeads: false,
    allowedViews: ["leads", "tasks", "pipeline"],
  },
  counselor: {
    canViewAllLeads: false,
    canExportLeads: false,
    canDeleteLeads: false,
    canManageSchema: false,
    canManageCampaigns: false,
    canManageDispositions: false,
    canManageTeam: false,
    canImportLeads: false,
    canViewAuditLogs: false,
    canAssignLeads: false,
    allowedViews: ["leads", "tasks", "pipeline"],
  },
  telecaller: {
    canViewAllLeads: false,
    canExportLeads: false,
    canDeleteLeads: false,
    canManageSchema: false,
    canManageCampaigns: false,
    canManageDispositions: false,
    canManageTeam: false,
    canImportLeads: false,
    canViewAuditLogs: false,
    canAssignLeads: false,
    allowedViews: ["leads", "tasks", "pipeline"],
  },
};

export class AuthService {
  static hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { hash, salt };
  }

  static verifyPassword(password: string, storedHash: string, salt: string): boolean {
    try {
      const hash = crypto.scryptSync(password, salt, 64).toString("hex");
      return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
    } catch {
      return false;
    }
  }

  static createSession(
    userId: string,
    metadata?: { ip?: string; location?: string; userAgent?: string },
    daysValid = 7
  ): { sessionId: string; expiresAt: Date } {
    const db = getDatabase();
    const sessionId = "sess_" + crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysValid);

    db.prepare(`
      INSERT INTO sessions (id, user_id, ip_address, location, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      userId,
      metadata?.ip || null,
      metadata?.location || null,
      metadata?.userAgent || null,
      expiresAt.toISOString()
    );

    return { sessionId, expiresAt };
  }

  static getSession(sessionId: string): AuthSession | null {
    if (!sessionId) return null;
    const db = getDatabase();

    const row = db.prepare(`
      SELECT 
        s.id as session_id,
        s.expires_at,
        u.id,
        u.name,
        u.email,
        u.role,
        u.status,
        u.avatar_color,
        u.last_login_at,
        u.last_login_ip,
        u.last_login_location,
        u.deactivated_at,
        u.deactivated_by,
        u.created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.status = 'active'
    `).get(sessionId) as any;

    if (!row) return null;

    const role = (row.role as UserRole) || "counselor";
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.counselor;

    const user: User = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: role,
      status: row.status,
      avatar_color: row.avatar_color,
      last_login_at: row.last_login_at,
      last_login_ip: row.last_login_ip,
      last_login_location: row.last_login_location,
      deactivated_at: row.deactivated_at,
      deactivated_by: row.deactivated_by,
      created_at: row.created_at,
    };

    return {
      user,
      sessionId: row.session_id,
      expiresAt: row.expires_at,
      permissions,
    };
  }

  static deleteSession(sessionId: string): void {
    if (!sessionId) return;
    const db = getDatabase();
    db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  static authenticate(
    emailOrUserId: string,
    password?: string,
    bypassPassword = false,
    metadata?: { ip?: string; location?: string; userAgent?: string }
  ): { user: User; session: { sessionId: string; expiresAt: Date }; permissions: RolePermissions } {
    const db = getDatabase();

    const userRow = db.prepare(`
      SELECT id, name, email, role, status, avatar_color, password_hash, salt, created_at,
             last_login_at, last_login_ip, last_login_location, deactivated_at, deactivated_by
      FROM users
      WHERE (LOWER(email) = LOWER(?) OR id = ?)
    `).get(emailOrUserId.trim(), emailOrUserId.trim()) as any;

    if (!userRow) {
      throw new Error("No user found with the provided credentials.");
    }

    if (userRow.status === "inactive") {
      throw new Error("Your account has been deactivated. Please contact an administrator.");
    }

    if (!bypassPassword) {
      if (!password) {
        throw new Error("Password is required.");
      }

      if (!userRow.password_hash || !userRow.salt) {
        // Fallback for unset password
        if (password !== "password123") {
          throw new Error("Invalid password.");
        }
      } else {
        const isValid = this.verifyPassword(password, userRow.password_hash, userRow.salt);
        if (!isValid) {
          throw new Error("Invalid email or password.");
        }
      }
    }

    const nowIso = new Date().toISOString();
    const clientIp = metadata?.ip || "127.0.0.1";
    const locationStr = metadata?.location || "Local Terminal (192.168.31.36)";

    // Update user login timestamp, IP, and location
    db.prepare(`
      UPDATE users 
      SET last_login_at = ?, last_login_ip = ?, last_login_location = ?
      WHERE id = ?
    `).run(nowIso, clientIp, locationStr, userRow.id);

    // Record login activity in audit logs
    try {
      db.prepare(`
        INSERT INTO activity_logs (action_type, description, metadata, performed_by)
        VALUES ('USER_LOGIN', ?, ?, ?)
      `).run(
        `${userRow.name} logged in from ${locationStr}`,
        JSON.stringify({
          ip: clientIp,
          location: locationStr,
          userAgent: metadata?.userAgent || "Browser",
          role: userRow.role,
        }),
        userRow.name
      );
    } catch {}

    const role = (userRow.role as UserRole) || "counselor";
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.counselor;

    const user: User = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role,
      status: userRow.status,
      avatar_color: userRow.avatar_color,
      last_login_at: nowIso,
      last_login_ip: clientIp,
      last_login_location: locationStr,
      deactivated_at: userRow.deactivated_at,
      deactivated_by: userRow.deactivated_by,
      created_at: userRow.created_at,
    };

    const session = this.createSession(user.id, metadata);

    return { user, session, permissions };
  }

  /**
   * Deactivates a user account and immediately terminates ALL active sessions.
   * The user is immediately kicked out and blocked from all endpoints.
   */
  static deactivateUser(
    userId: string,
    deactivatedBy: string = "Admin"
  ): { success: boolean; terminatedSessions: number } {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) throw new Error("User not found.");

    // 1. Mark user as inactive in users table
    db.prepare(`
      UPDATE users 
      SET status = 'inactive', deactivated_at = CURRENT_TIMESTAMP, deactivated_by = ? 
      WHERE id = ?
    `).run(deactivatedBy, userId);

    // 2. Instantly purge all active sessions for this user!
    const delResult = db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    const terminatedSessions = delResult.changes;

    // 3. Log in activity logs
    try {
      db.prepare(`
        INSERT INTO activity_logs (action_type, description, metadata, performed_by)
        VALUES ('USER_DEACTIVATED', ?, ?, ?)
      `).run(
        `Staff account ${user.name} (${user.email}) was deactivated. Terminated ${terminatedSessions} active sessions.`,
        JSON.stringify({ userId, terminatedSessions, deactivatedBy }),
        deactivatedBy
      );
    } catch {}

    return { success: true, terminatedSessions };
  }

  /**
   * Reactivates a previously deactivated user account.
   */
  static reactivateUser(
    userId: string,
    activatedBy: string = "Admin"
  ): { success: boolean } {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) throw new Error("User not found.");

    db.prepare(`
      UPDATE users 
      SET status = 'active', deactivated_at = NULL, deactivated_by = NULL 
      WHERE id = ?
    `).run(userId);

    try {
      db.prepare(`
        INSERT INTO activity_logs (action_type, description, metadata, performed_by)
        VALUES ('USER_REACTIVATED', ?, ?, ?)
      `).run(
        `Staff account ${user.name} (${user.email}) was reactivated.`,
        JSON.stringify({ userId, activatedBy }),
        activatedBy
      );
    } catch {}

    return { success: true };
  }

  static getAllActiveUsers(): User[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, name, email, role, status, avatar_color, last_login_at, last_login_ip, last_login_location, deactivated_at, deactivated_by, created_at
      FROM users
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'team_lead' THEN 2 
          WHEN 'senior_counselor' THEN 3 
          ELSE 4 
        END, name ASC
    `).all() as User[];
  }
}
