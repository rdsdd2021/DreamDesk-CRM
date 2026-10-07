import { getDatabase } from "@/lib/db/database";
import { CrmPolicy, CrmPolicyConfig, PolicyValidationResult, User, UserRole } from "@/types/crm";

export class PolicyService {
  private static safeParseJson<T>(val: any, fallback: T): T {
    if (!val) return fallback;
    if (typeof val === "object") return val;
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }

  /**
   * Fetches all registered CRM policies from database.
   */
  static getPolicies(): CrmPolicy[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM crm_policies ORDER BY created_at ASC").all() as any[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      policy_type: row.policy_type,
      is_enabled: Boolean(row.is_enabled),
      config: this.safeParseJson<CrmPolicyConfig>(row.config, {
        lock_days: 7,
        exempt_roles: ["admin", "team_lead"],
      }),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Fetches a specific policy by ID.
   */
  static getPolicy(id: string): CrmPolicy | null {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM crm_policies WHERE id = ?").get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      policy_type: row.policy_type,
      is_enabled: Boolean(row.is_enabled),
      config: this.safeParseJson<CrmPolicyConfig>(row.config, {
        lock_days: 7,
        exempt_roles: ["admin", "team_lead"],
      }),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Updates policy state and configuration (Admin / Team Leader only).
   */
  static updatePolicy(
    id: string,
    updates: { is_enabled?: boolean; config?: Partial<CrmPolicyConfig> },
    performedBy: string = "Admin"
  ): CrmPolicy {
    const db = getDatabase();
    const existing = this.getPolicy(id);
    if (!existing) throw new Error(`Policy "${id}" not found`);

    const newIsEnabled = updates.is_enabled !== undefined ? (updates.is_enabled ? 1 : 0) : existing.is_enabled ? 1 : 0;
    const newConfig = {
      ...existing.config,
      ...(updates.config || {}),
    };

    db.prepare(`
      UPDATE crm_policies
      SET is_enabled = ?, config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newIsEnabled, JSON.stringify(newConfig), id);

    // Audit log
    db.prepare(`
      INSERT INTO activity_logs (action_type, description, affected_count, performed_by)
      VALUES ('policy_update', ?, 1, ?)
    `).run(
      `Updated policy "${existing.name}" (Enabled: ${Boolean(newIsEnabled)}, Lock Days: ${newConfig.lock_days})`,
      performedBy
    );

    return this.getPolicy(id)!;
  }

  /**
   * Checks whether a specific lead is locked under counselor ownership protection.
   */
  static checkLeadLock(
    leadId: number,
    customLockDays?: number
  ): {
    isLocked: boolean;
    leadId: number;
    leadCode: string;
    counselorId?: string;
    counselorName?: string;
    lastCallAt?: string;
    daysSinceCall?: number;
    daysRemaining?: number;
    lockDays?: number;
  } {
    const db = getDatabase();
    const policy = this.getPolicy("counselor_lock");

    const lead = db.prepare(`
      SELECT leads.id, leads.lead_code, leads.assigned_to, leads.disposition_id, leads.updated_at, users.name as counselor_name
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      WHERE leads.id = ?
    `).get(leadId) as any;

    if (!lead || !lead.assigned_to) {
      return { isLocked: false, leadId, leadCode: lead?.lead_code || `LD-${leadId}` };
    }

    if (!policy || !policy.is_enabled) {
      return { isLocked: false, leadId, leadCode: lead.lead_code };
    }

    const lockDays = customLockDays ?? (policy.config.lock_days || 7);

    // 1. Check most recent call activity in lead_activities
    const callActivity = db.prepare(`
      SELECT created_at
      FROM lead_activities
      WHERE lead_id = ? AND activity_type IN ('disposition', 'call')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(leadId) as { created_at: string } | undefined;

    let lastCallAt = callActivity?.created_at;

    // 2. Fallback check: if lead has disposition_id and no lead_activities row
    if (!lastCallAt && lead.disposition_id && lead.updated_at) {
      lastCallAt = lead.updated_at;
    }

    if (!lastCallAt) {
      return { isLocked: false, leadId, leadCode: lead.lead_code };
    }

    const callDate = new Date(lastCallAt);
    const now = new Date();
    const diffMs = now.getTime() - callDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < lockDays) {
      const daysSinceCall = Math.max(0, Math.floor(diffDays));
      const daysRemaining = Math.max(1, Math.ceil(lockDays - diffDays));

      return {
        isLocked: true,
        leadId,
        leadCode: lead.lead_code,
        counselorId: lead.assigned_to,
        counselorName: lead.counselor_name || "Counselor",
        lastCallAt,
        daysSinceCall,
        daysRemaining,
        lockDays,
      };
    }

    return {
      isLocked: false,
      leadId,
      leadCode: lead.lead_code,
      daysSinceCall: Math.floor(diffDays),
    };
  }

  /**
   * Validates whether a lead can be reassigned to a target counselor.
   * If locked under 7-day rule, only Admin or Team Leader can override.
   */
  static validateReassignment(options: {
    leadId: number;
    newUserId: string | null;
    currentUser?: User | null;
    overridePolicy?: boolean;
  }): PolicyValidationResult {
    const { leadId, newUserId, currentUser, overridePolicy } = options;
    const lockInfo = this.checkLeadLock(leadId);

    if (!lockInfo.isLocked) {
      return { allowed: true, lead_id: leadId, lead_code: lockInfo.leadCode };
    }

    // Reassigning to the same counselor is always safe
    if (newUserId && newUserId === lockInfo.counselorId) {
      return { allowed: true, lead_id: leadId, lead_code: lockInfo.leadCode };
    }

    const policy = this.getPolicy("counselor_lock");
    const exemptRoles: UserRole[] = policy?.config.exempt_roles || ["admin", "team_lead"];

    const isExemptRole =
      currentUser &&
      (currentUser.role === "admin" ||
        currentUser.role === "team_lead" ||
        exemptRoles.includes(currentUser.role));

    if (isExemptRole) {
      return {
        allowed: true,
        policy_id: "counselor_lock",
        policy_name: policy?.name || "Counselor Ownership Lock-in Policy",
        is_override: true,
        lead_id: leadId,
        lead_code: lockInfo.leadCode,
        counselor_id: lockInfo.counselorId,
        counselor_name: lockInfo.counselorName,
        last_call_at: lockInfo.lastCallAt,
        days_since_call: lockInfo.daysSinceCall,
        days_remaining: lockInfo.daysRemaining,
        lock_days: lockInfo.lockDays,
        message: `Admin/Team Leader override applied for lead ${lockInfo.leadCode} (contacted ${lockInfo.daysSinceCall}d ago by ${lockInfo.counselorName}).`,
      };
    }

    return {
      allowed: false,
      policy_id: "counselor_lock",
      policy_name: policy?.name || "Counselor Ownership Lock-in Policy",
      is_override: false,
      reason: "counselor_lock_active",
      lead_id: leadId,
      lead_code: lockInfo.leadCode,
      counselor_id: lockInfo.counselorId,
      counselor_name: lockInfo.counselorName,
      last_call_at: lockInfo.lastCallAt,
      days_since_call: lockInfo.daysSinceCall,
      days_remaining: lockInfo.daysRemaining,
      lock_days: lockInfo.lockDays,
      message: `Policy Restriction: Lead ${lockInfo.leadCode} was contacted ${lockInfo.daysSinceCall} day(s) ago by ${lockInfo.counselorName} and is protected under the ${lockInfo.lockDays}-day ownership policy (${lockInfo.daysRemaining} days remaining). Reassignment is restricted to Admins and Team Leaders.`,
    };
  }

  /**
   * Filters and validates a bulk list of lead IDs for reassignment.
   */
  static validateBulkReassignment(options: {
    leadIds: number[];
    newUserId?: string | null;
    currentUser?: User | null;
    overridePolicy?: boolean;
  }): {
    allowedIds: number[];
    lockedIds: number[];
    violations: PolicyValidationResult[];
    totalEvaluated: number;
    isOverrideActive: boolean;
  } {
    const { leadIds, newUserId, currentUser, overridePolicy } = options;
    const allowedIds: number[] = [];
    const lockedIds: number[] = [];
    const violations: PolicyValidationResult[] = [];

    const policy = this.getPolicy("counselor_lock");
    const exemptRoles: UserRole[] = policy?.config.exempt_roles || ["admin", "team_lead"];
    const isExemptRole =
      currentUser &&
      (currentUser.role === "admin" ||
        currentUser.role === "team_lead" ||
        exemptRoles.includes(currentUser.role));

    const allowOverride = Boolean(isExemptRole && (overridePolicy !== false));

    for (const id of leadIds) {
      const result = this.validateReassignment({
        leadId: id,
        newUserId: newUserId || null,
        currentUser,
        overridePolicy: allowOverride,
      });

      if (result.allowed) {
        allowedIds.push(id);
      } else {
        lockedIds.push(id);
        violations.push(result);
      }
    }

    return {
      allowedIds,
      lockedIds,
      violations,
      totalEvaluated: leadIds.length,
      isOverrideActive: allowOverride,
    };
  }

  /**
   * Gathers live statistics for the policy dashboard.
   */
  static getPolicyStats(): {
    totalLockedLeads: number;
    totalProtectedCounselors: number;
    lockDays: number;
    isPolicyEnabled: boolean;
    exemptRoles: UserRole[];
    overridesInLast30Days: number;
  } {
    const db = getDatabase();
    const policy = this.getPolicy("counselor_lock");
    const lockDays = policy?.config.lock_days || 7;
    const isPolicyEnabled = Boolean(policy?.is_enabled);
    const exemptRoles = policy?.config.exempt_roles || ["admin", "team_lead"];

    // Leads assigned with a call within lockDays
    const lockedRows = db.prepare(`
      SELECT DISTINCT leads.id, leads.assigned_to
      FROM leads
      INNER JOIN lead_activities ON leads.id = lead_activities.lead_id
      WHERE leads.assigned_to IS NOT NULL
        AND lead_activities.activity_type IN ('disposition', 'call')
        AND datetime(lead_activities.created_at) >= datetime('now', '-' || ? || ' days')
    `).all(lockDays) as { id: number; assigned_to: string }[];

    const counselorSet = new Set(lockedRows.map((r) => r.assigned_to));

    // Overrides in last 30 days
    const overrideCount = (
      db.prepare(`
        SELECT COUNT(*) as count
        FROM lead_activities
        WHERE title LIKE '%Lock Overridden%'
          AND datetime(created_at) >= datetime('now', '-30 days')
      `).get() as any
    )?.count || 0;

    return {
      totalLockedLeads: lockedRows.length,
      totalProtectedCounselors: counselorSet.size,
      lockDays,
      isPolicyEnabled,
      exemptRoles,
      overridesInLast30Days: overrideCount,
    };
  }
}
