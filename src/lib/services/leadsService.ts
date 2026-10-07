import { getDatabase } from "@/lib/db/database";
import {
  Lead,
  FilterParams,
  LeadsResponse,
  FacetGroup,
  SchemaMeta,
  BulkAssignRequest,
  User,
  ActivityLog,
  LeadActivity,
  Disposition,
  Campaign,
  SubDisposition,
  SavedView,
  CallbackTask,
  WhatsAppTemplate,
  AssignmentRule,
  DuplicateCluster,
  CounselorMetric,
  FunnelStage,
  UserScope,
  AnalyticsReportParams,
  AnalyticsReportData,
} from "@/types/crm";
import { PolicyService } from "@/lib/services/policyService";

export class LeadsService {
  private static _facetCacheMap = new Map<string, { data: FacetGroup[]; timestamp: number }>();
  private static _summaryCacheMap = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_TTL_MS = 25000; // 25s TTL

  public static invalidateCache() {
    LeadsService._facetCacheMap.clear();
    LeadsService._summaryCacheMap.clear();
  }

  /**
   * Retrieves paginated leads with dynamic faceted filtering, search, and sorting.
   * Scoped by UserScope to guarantee strict private lead isolation.
   */
  static getLeads(params: FilterParams, userScope?: UserScope): LeadsResponse {
    const db = getDatabase();
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(200, Math.max(10, params.limit || 50));
    const offset = (page - 1) * limit;

    // Strict security constraint: if user cannot view all leads, force assigned_to = [userScope.userId]
    if (userScope && !userScope.canViewAllLeads) {
      params.assigned_to = [userScope.userId];
    }

    const { whereClause, queryParams } = this.buildWhereClause(params, undefined, userScope);

    // 1. Get filtered total count
    const countSql = `
      SELECT COUNT(*) as count 
      FROM leads 
      LEFT JOIN users ON leads.assigned_to = users.id
      LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
      LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
      ${whereClause}
    `;
    const countResult = db.prepare(countSql).get(queryParams) as { count: number };
    const total = countResult.count;

    // 2. Fetch paginated records
    const sortColumn = this.sanitizeSortColumn(params.sort_by);
    const sortDirection = params.sort_order === "asc" ? "ASC" : "DESC";

    const fetchSql = `
      SELECT 
        leads.*,
        users.name as assigned_user_name,
        users.avatar_color as assigned_user_color,
        campaigns.name as campaign_name,
        dispositions.name as disposition_name,
        dispositions.color as disposition_color,
        dispositions.category as disposition_category,
        sub_dispositions.name as sub_disposition_name
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
      LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
      LEFT JOIN sub_dispositions ON leads.sub_disposition_id = sub_dispositions.id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT @limit OFFSET @offset
    `;

    const rawRows = db.prepare(fetchSql).all({
      ...queryParams,
      limit,
      offset,
    }) as any[];

    const leads: Lead[] = rawRows.map((row) => ({
      id: row.id,
      lead_code: row.lead_code,
      name: row.name,
      phone: row.phone,
      email: row.email,
      status: row.status,
      assigned_to: row.assigned_to,
      assigned_user_name: row.assigned_user_name,
      assigned_user_color: row.assigned_user_color,
      assigned_at: row.assigned_at,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      disposition_id: row.disposition_id,
      disposition_name: row.disposition_name,
      disposition_color: row.disposition_color,
      sub_disposition_id: row.sub_disposition_id,
      sub_disposition_name: row.sub_disposition_name,
      callback_at: row.callback_at,
      tags: this.safeParseArray(row.tags),
      raw_attributes: this.safeParseJson(row.raw_attributes),
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // 3. Compute dynamic facets for filterable fields (strictly scoped)
    const facets = this.computeDynamicFacets(params, userScope);

    // 4. Compute database summary (strictly scoped by user permissions)
    const summary = this.getSummaryStats(userScope);

    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      facets,
      summary,
    };
  }

  /**
   * Builds SQL WHERE clause and bindings from FilterParams.
   * If excludeKey is specified, that key's condition is skipped (essential for contextual faceted counts).
   * Note: userScope security constraints are NEVER excluded.
   */
  private static buildWhereClause(
    params: FilterParams,
    excludeKey?: string,
    userScope?: UserScope
  ): {
    whereClause: string;
    queryParams: Record<string, any>;
  } {
    const conditions: string[] = [];
    const queryParams: Record<string, any> = {};

    // Global Search
    if (params.search && params.search.trim()) {
      conditions.push(`(
        leads.name LIKE @search 
        OR leads.phone LIKE @search 
        OR leads.email LIKE @search 
        OR leads.lead_code LIKE @search 
        OR campaigns.name LIKE @search
        OR dispositions.name LIKE @search
        OR leads.tags LIKE @search
        OR leads.raw_attributes LIKE @search
      )`);
      queryParams.search = `%${params.search.trim()}%`;
    }

    // Status filter
    if (excludeKey !== "status" && params.status && params.status.length > 0) {
      const statusPlaceholders = params.status
        .map((s, idx) => {
          const key = `status_${idx}`;
          queryParams[key] = s;
          return `@${key}`;
        })
        .join(", ");
      conditions.push(`leads.status IN (${statusPlaceholders})`);
    }

    // Assigned Counselor filter & Mandatory User Scope enforcement
    if (userScope && !userScope.canViewAllLeads) {
      // Security: Counselors & Telecallers MUST ALWAYS be strictly constrained to their own leads
      conditions.push(`leads.assigned_to = @mandatory_user_id`);
      queryParams.mandatory_user_id = userScope.userId;
    } else if (excludeKey !== "assigned_to" && params.assigned_to && params.assigned_to.length > 0) {
      const hasUnassigned = params.assigned_to.includes("unassigned");
      const assignedIds = params.assigned_to.filter((id) => id !== "unassigned");

      const counselorConditions: string[] = [];
      if (hasUnassigned) {
        counselorConditions.push("leads.assigned_to IS NULL");
      }
      if (assignedIds.length > 0) {
        const userPlaceholders = assignedIds
          .map((uid, idx) => {
            const key = `user_${idx}`;
            queryParams[key] = uid;
            return `@${key}`;
          })
          .join(", ");
        counselorConditions.push(`(leads.assigned_to IN (${userPlaceholders}) OR users.name IN (${userPlaceholders}))`);
      }

      if (counselorConditions.length > 0) {
        conditions.push(`(${counselorConditions.join(" OR ")})`);
      }
    }

    // Campaign filter (supports campaign_id or campaign name)
    if (excludeKey !== "campaign_id" && params.campaign_id && params.campaign_id.length > 0) {
      const hasUnassigned = params.campaign_id.includes("unassigned") || params.campaign_id.includes("Unassigned Campaign");
      const campIds = params.campaign_id.filter((id) => id !== "unassigned" && id !== "Unassigned Campaign");

      const campConditions: string[] = [];
      if (hasUnassigned) {
        campConditions.push("leads.campaign_id IS NULL");
      }
      if (campIds.length > 0) {
        const campPlaceholders = campIds
          .map((cid, idx) => {
            const key = `camp_${idx}`;
            queryParams[key] = cid;
            return `@${key}`;
          })
          .join(", ");
        campConditions.push(`(leads.campaign_id IN (${campPlaceholders}) OR campaigns.name IN (${campPlaceholders}))`);
      }

      if (campConditions.length > 0) {
        conditions.push(`(${campConditions.join(" OR ")})`);
      }
    }

    // Disposition filter (supports disposition_id or disposition name)
    if (excludeKey !== "disposition_id" && params.disposition_id && params.disposition_id.length > 0) {
      const hasNone = params.disposition_id.includes("none") || params.disposition_id.includes("No Disposition Logged");
      const dispIds = params.disposition_id.filter((id) => id !== "none" && id !== "No Disposition Logged");

      const dispConditions: string[] = [];
      if (hasNone) {
        dispConditions.push("leads.disposition_id IS NULL");
      }
      if (dispIds.length > 0) {
        const dispPlaceholders = dispIds
          .map((did, idx) => {
            const key = `disp_${idx}`;
            queryParams[key] = did;
            return `@${key}`;
          })
          .join(", ");
        dispConditions.push(`(leads.disposition_id IN (${dispPlaceholders}) OR dispositions.name IN (${dispPlaceholders}))`);
      }

      if (dispConditions.length > 0) {
        conditions.push(`(${dispConditions.join(" OR ")})`);
      }
    }

    // Tags filter
    if (excludeKey !== "tags" && params.tags && params.tags.length > 0) {
      const tagConditions: string[] = [];
      params.tags.forEach((tag, idx) => {
        const key = `tag_${idx}`;
        queryParams[key] = `%"${tag}"%`;
        tagConditions.push(`leads.tags LIKE @${key}`);
      });
      if (tagConditions.length > 0) {
        conditions.push(`(${tagConditions.join(" OR ")})`);
      }
    }

    // Dynamic Faceted Filters from JSON attributes
    if (params.facets) {
      let facetIndex = 0;
      for (const [keyName, values] of Object.entries(params.facets)) {
        if (excludeKey === keyName || !values || values.length === 0) continue;

        const valPlaceholders = values
          .map((val) => {
            const paramKey = `facet_${facetIndex++}`;
            queryParams[paramKey] = val;
            return `@${paramKey}`;
          })
          .join(", ");

        // Extracts the attribute directly via SQLite json_extract
        conditions.push(
          `json_extract(leads.raw_attributes, '$.' || '${keyName.replace(/[^a-zA-Z0-9_]/g, "")}') IN (${valPlaceholders})`
        );
      }
    }

    // Date Range Filters
    if (params.date_from) {
      conditions.push(`leads.created_at >= @date_from`);
      queryParams.date_from = params.date_from;
    }
    if (params.date_to) {
      conditions.push(`leads.created_at <= @date_to`);
      queryParams.date_to = params.date_to;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereClause, queryParams };
  }

  /**
   * Calculates contextual dynamic facet value counts scoped by active filters and user permissions.
   * Employs disjunctive faceted search where each facet group calculates distributions
   * across all other active filters (so options never vanish when checked).
   * Backed by user-scoped filter-keyed LRU caching for sub-10ms response times.
   */
  private static computeDynamicFacets(params: FilterParams, userScope?: UserScope): FacetGroup[] {
    const scopeTag = userScope ? (userScope.canViewAllLeads ? "all" : `user_${userScope.userId}`) : "all";
    const cacheKey = JSON.stringify({
      scope: scopeTag,
      s: params.search || "",
      st: params.status || [],
      a: params.assigned_to || [],
      c: params.campaign_id || [],
      d: params.disposition_id || [],
      f: params.facets || {},
    });

    const now = Date.now();
    const cached = this._facetCacheMap.get(cacheKey);
    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const db = getDatabase();
    const filterableMeta = db
      .prepare(
        `SELECT key_name, display_label 
         FROM lead_schema_meta 
         WHERE is_filterable = 1 AND is_visible = 1 
         ORDER BY display_order ASC`
      )
      .all() as { key_name: string; display_label: string }[];

    const facetGroups: FacetGroup[] = [];

    // Helper to generate minimal JOINs only when necessary (ensuring highest SQLite scan speeds)
    const getJoinClause = (
      whereClause: string,
      extraJoins?: { users?: boolean; campaigns?: boolean; dispositions?: boolean }
    ) => {
      let joins = "";
      if (extraJoins?.users || whereClause.includes("users.")) {
        joins += " LEFT JOIN users ON leads.assigned_to = users.id";
      }
      if (extraJoins?.campaigns || whereClause.includes("campaigns.")) {
        joins += " LEFT JOIN campaigns ON leads.campaign_id = campaigns.id";
      }
      if (extraJoins?.dispositions || whereClause.includes("dispositions.")) {
        joins += " LEFT JOIN dispositions ON leads.disposition_id = dispositions.id";
      }
      return joins;
    };

    // 1. Core Status Facet (scoped by all filters except status, strictly constrained by userScope)
    const { whereClause: statusWhere, queryParams: statusParams } = this.buildWhereClause(params, "status", userScope);
    const statusJoins = getJoinClause(statusWhere);
    const statusRows = db
      .prepare(
        `SELECT leads.status as value, COUNT(*) as count 
         FROM leads 
         ${statusJoins}
         ${statusWhere} 
         GROUP BY leads.status 
         ORDER BY count DESC`
      )
      .all(statusParams) as { value: string; count: number }[];

    const standardStatuses = ["New", "Contacted", "Interested", "Follow-up", "Admitted", "Not Interested"];
    const statusMap = new Map(statusRows.map((r) => [r.value, r.count]));
    const finalStatusOptions = standardStatuses.map((s) => ({
      value: s,
      count: statusMap.get(s) || 0,
    }));
    for (const r of statusRows) {
      if (!standardStatuses.includes(r.value)) {
        finalStatusOptions.push(r);
      }
    }
    facetGroups.push({
      key_name: "status",
      display_label: "Lead Status",
      options: finalStatusOptions,
    });

    // 2. Core Assignment Facet
    if (userScope && !userScope.canViewAllLeads) {
      // Counselor/Telecaller: NEVER reveal other counselors or unassigned pool!
      const myCountRow = db
        .prepare("SELECT COUNT(*) as count FROM leads WHERE assigned_to = ?")
        .get(userScope.userId) as { count: number };
      const myName = userScope.name || "Assigned to You";
      facetGroups.push({
        key_name: "assigned_to",
        display_label: "Assigned Counselor",
        options: [
          {
            value: userScope.userId,
            label: `${myName} (You)`,
            count: myCountRow ? myCountRow.count : 0,
          },
        ],
      });
    } else {
      const { whereClause: assignWhere, queryParams: assignParams } = this.buildWhereClause(params, "assigned_to", userScope);
      const assignJoins = getJoinClause(assignWhere, { users: true });
      const assignRows = db
        .prepare(
          `SELECT 
            COALESCE(users.name, 'Unassigned') as label, 
            COALESCE(leads.assigned_to, 'unassigned') as value, 
            COUNT(*) as count 
           FROM leads 
           ${assignJoins}
           ${assignWhere} 
           GROUP BY leads.assigned_to 
           ORDER BY count DESC`
        )
        .all(assignParams) as { label: string; value: string; count: number }[];

      facetGroups.push({
        key_name: "assigned_to",
        display_label: "Assigned Counselor",
        options: assignRows.map((r) => ({
          value: r.value,
          label: r.label,
          count: r.count,
        })),
      });
    }

    // 3. Campaign Facet (scoped by all filters except campaign_id, strictly constrained by userScope)
    const { whereClause: campWhere, queryParams: campParams } = this.buildWhereClause(params, "campaign_id", userScope);
    const campJoins = getJoinClause(campWhere, { campaigns: true });
    const campRows = db
      .prepare(
        `SELECT 
          COALESCE(campaigns.name, 'Unassigned Campaign') as label, 
          COALESCE(leads.campaign_id, 'unassigned') as value, 
          COUNT(*) as count 
         FROM leads 
         ${campJoins}
         ${campWhere} 
         GROUP BY leads.campaign_id 
         ORDER BY count DESC`
      )
      .all(campParams) as { label: string; value: string; count: number }[];

    facetGroups.push({
      key_name: "campaign_id",
      display_label: "Campaign / Source",
      options: campRows.map((r) => ({
        value: r.value,
        label: r.label,
        count: r.count,
      })),
    });

    // 4. Call Disposition Facet (scoped by all filters except disposition_id, strictly constrained by userScope)
    const { whereClause: dispWhere, queryParams: dispParams } = this.buildWhereClause(params, "disposition_id", userScope);
    const dispJoins = getJoinClause(dispWhere, { dispositions: true });
    const dispRows = db
      .prepare(
        `SELECT 
          COALESCE(dispositions.name, 'No Disposition Logged') as label, 
          COALESCE(leads.disposition_id, 'none') as value, 
          COUNT(*) as count 
         FROM leads 
         ${dispJoins}
         ${dispWhere} 
         GROUP BY leads.disposition_id 
         ORDER BY count DESC`
      )
      .all(dispParams) as { label: string; value: string; count: number }[];

    facetGroups.push({
      key_name: "disposition_id",
      display_label: "Call Disposition",
      options: dispRows.map((r) => ({
        value: r.value,
        label: r.label,
        count: r.count,
      })),
    });

    // 5. Dynamic Schema Attribute Facets (scoped by all filters except the current attribute, strictly constrained by userScope)
    for (const meta of filterableMeta) {
      const cleanKey = meta.key_name.replace(/[^a-zA-Z0-9_]/g, "");
      const { whereClause: metaWhere, queryParams: metaParams } = this.buildWhereClause(params, meta.key_name, userScope);
      const metaJoins = getJoinClause(metaWhere);
      const facetQuery = `
        SELECT 
          json_extract(leads.raw_attributes, '$.' || '${cleanKey}') as value,
          COUNT(*) as count
        FROM leads
        ${metaJoins}
        ${metaWhere ? `${metaWhere} AND` : "WHERE"} 
          json_extract(leads.raw_attributes, '$.' || '${cleanKey}') IS NOT NULL
          AND json_extract(leads.raw_attributes, '$.' || '${cleanKey}') != ''
        GROUP BY value
        ORDER BY count DESC
        LIMIT 20
      `;
      try {
        const rows = db.prepare(facetQuery).all(metaParams) as { value: string; count: number }[];
        if (rows.length > 0) {
          facetGroups.push({
            key_name: meta.key_name,
            display_label: meta.display_label,
            options: rows,
          });
        }
      } catch (err) {
        console.error(`Facet query failed for ${cleanKey}:`, err);
      }
    }

    if (this._facetCacheMap.size > 200) {
      this._facetCacheMap.clear();
    }
    this._facetCacheMap.set(cacheKey, { data: facetGroups, timestamp: now });
    return facetGroups;
  }

  /**
   * Bulk Assign Leads to counselors (Auto balanced, Quota-based, or Single counselor).
   */
  static bulkAssign(
    request: BulkAssignRequest,
    currentUser?: User | null
  ): { affectedCount: number; skippedLockedCount?: number; message: string } {
    const db = getDatabase();

    // Determine target lead IDs
    let targetLeadIds: number[] = [];

    if (request.lead_ids && request.lead_ids.length > 0 && !request.apply_to_all_filtered) {
      targetLeadIds = request.lead_ids;
    } else {
      // Query target IDs based on current filters
      const filterParams = request.filter_params || {};
      const { whereClause, queryParams } = this.buildWhereClause(filterParams);
      const limit = request.total_to_assign ? `LIMIT ${Math.max(1, request.total_to_assign)}` : "";

      const sql = `
        SELECT leads.id 
        FROM leads 
        LEFT JOIN users ON leads.assigned_to = users.id 
        LEFT JOIN campaigns ON leads.campaign_id = campaigns.id 
        LEFT JOIN dispositions ON leads.disposition_id = dispositions.id 
        ${whereClause} 
        ORDER BY leads.id ASC 
        ${limit}
      `;
      const rows = db.prepare(sql).all(queryParams) as { id: number }[];
      targetLeadIds = rows.map((r) => r.id);
    }

    if (targetLeadIds.length === 0) {
      return { affectedCount: 0, message: "No matching leads found for assignment." };
    }

    // Validate target leads against Counselor Ownership Lock Policy
    const policyResult = PolicyService.validateBulkReassignment({
      leadIds: targetLeadIds,
      newUserId: request.single_user_id,
      currentUser,
      overridePolicy: request.override_policy,
    });

    const isPrivileged = Boolean(currentUser && (currentUser.role === "admin" || currentUser.role === "team_lead"));
    const lockedSet = new Set(policyResult.lockedIds);

    let finalLeadIds = targetLeadIds;
    let skippedLockedCount = 0;

    // Non-privileged users or requests without override cannot touch locked leads
    if (!isPrivileged || request.override_policy === false) {
      finalLeadIds = policyResult.allowedIds;
      skippedLockedCount = policyResult.lockedIds.length;
    }

    if (finalLeadIds.length === 0) {
      const firstMsg = policyResult.violations[0]?.message;
      return {
        affectedCount: 0,
        skippedLockedCount,
        message: firstMsg || `All ${targetLeadIds.length} selected leads are protected under the 7-day call lock policy.`,
      };
    }

    const updateLead = db.prepare(`
      UPDATE leads 
      SET assigned_to = @userId, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = @id
    `);

    let affectedCount = 0;
    const counselorList = db.prepare("SELECT id, name FROM users").all() as { id: string; name: string }[];
    const counselorMap = new Map<string, string>(counselorList.map((c) => [c.id, c.name]));

    const insertAssignActivity = db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, old_value, new_value, metadata, performed_by_name)
      VALUES (@lead_id, 'assigned', @title, @description, 'Unassigned', @new_value, @metadata, @performed_by)
    `);

    const performerName = currentUser?.name || "Admin";

    const assignTransaction = db.transaction(() => {
      if (request.mode === "single") {
        const userId = request.single_user_id || null;
        const cName = userId ? counselorMap.get(userId) || "Counselor" : "Unassigned";
        for (const id of finalLeadIds) {
          const isOverride = lockedSet.has(id);
          updateLead.run({ id, userId });
          insertAssignActivity.run({
            lead_id: id,
            title: isOverride ? `Assigned to Counselor: ${cName} (Lock Overridden)` : `Assigned to Counselor: ${cName}`,
            description: isOverride
              ? `Allocated via bulk assignment (Admin/Team Leader override of 7-day lock)`
              : `Allocated via bulk assignment (${request.mode})`,
            new_value: cName,
            metadata: JSON.stringify({ assigned_to: userId, mode: request.mode, is_override: isOverride }),
            performed_by: performerName,
          });
          affectedCount++;
        }
      } else if (request.mode === "auto") {
        const userIds = request.selected_user_ids || [];
        if (userIds.length === 0) throw new Error("No counselors selected for auto-assignment.");

        // Round-robin equal distribution
        finalLeadIds.forEach((id, index) => {
          const userId = userIds[index % userIds.length];
          const cName = counselorMap.get(userId) || "Counselor";
          const isOverride = lockedSet.has(id);
          updateLead.run({ id, userId });
          insertAssignActivity.run({
            lead_id: id,
            title: isOverride ? `Assigned to Counselor: ${cName} (Lock Overridden)` : `Assigned to Counselor: ${cName}`,
            description: isOverride
              ? `Auto-balanced distribution (Admin/Team Leader override of 7-day lock)`
              : `Auto-balanced round-robin distribution`,
            new_value: cName,
            metadata: JSON.stringify({ assigned_to: userId, mode: request.mode, is_override: isOverride }),
            performed_by: performerName,
          });
          affectedCount++;
        });
      } else if (request.mode === "quota") {
        const quotas = request.user_quotas || {};
        let currentIndex = 0;

        for (const [userId, quota] of Object.entries(quotas)) {
          const countToGive = Math.min(quota, finalLeadIds.length - currentIndex);
          const cName = counselorMap.get(userId) || "Counselor";
          for (let i = 0; i < countToGive; i++) {
            const id = finalLeadIds[currentIndex++];
            const isOverride = lockedSet.has(id);
            updateLead.run({ id, userId });
            insertAssignActivity.run({
              lead_id: id,
              title: isOverride ? `Assigned to Counselor: ${cName} (Lock Overridden)` : `Assigned to Counselor: ${cName}`,
              description: isOverride
                ? `Quota-allocated assignment (Admin/Team Leader override of 7-day lock)`
                : `Quota-allocated assignment (${countToGive} capacity target)`,
              new_value: cName,
              metadata: JSON.stringify({ assigned_to: userId, mode: request.mode, quota, is_override: isOverride }),
              performed_by: performerName,
            });
            affectedCount++;
          }
          if (currentIndex >= finalLeadIds.length) break;
        }
      }

      // Log bulk action
      db.prepare(`
        INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
        VALUES ('bulk_assign', @description, @affectedCount, @metadata, @performed_by)
      `).run({
        description: `Bulk assigned ${affectedCount} leads using mode: ${request.mode}`,
        affectedCount,
        metadata: JSON.stringify({
          mode: request.mode,
          finalLeadIdsCount: finalLeadIds.length,
          skippedLockedCount,
        }),
        performed_by: performerName,
      });
    });

    assignTransaction();
    this.invalidateCache();

    let resultMessage = `Successfully assigned ${affectedCount} student leads.`;
    if (skippedLockedCount > 0) {
      resultMessage += ` (${skippedLockedCount} protected leads contacted in the last 7 days were preserved).`;
    } else if (isPrivileged && policyResult.lockedIds.length > 0) {
      resultMessage += ` (Included ${policyResult.lockedIds.length} protected leads via Admin/Team Leader override).`;
    }

    return {
      affectedCount,
      skippedLockedCount,
      message: resultMessage,
    };
  }

  /**
   * Fast 1-click self-allocation for counselors: claims N fresh unassigned leads.
   */
  static claimUnassignedLeads(userId: string, count: number = 25): { claimedCount: number; message: string } {
    const db = getDatabase();
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as User | undefined;
    if (!user) throw new Error("Counselor not found");

    const unassignedRows = db.prepare(
      "SELECT id FROM leads WHERE assigned_to IS NULL ORDER BY id ASC LIMIT ?"
    ).all(count) as { id: number }[];

    if (unassignedRows.length === 0) {
      return { claimedCount: 0, message: "No unassigned leads available in the pool." };
    }

    const ids = unassignedRows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");

    db.prepare(`
      UPDATE leads 
      SET assigned_to = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id IN (${placeholders})
    `).run(userId, ...ids);

    const insertClaimActivity = db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, old_value, new_value, metadata, performed_by_id, performed_by_name)
      VALUES (?, 'assigned', ?, ?, 'Unassigned', ?, ?, ?, ?)
    `);

    for (const id of ids) {
      insertClaimActivity.run(
        id,
        `Claimed by Counselor: ${user.name}`,
        `Counselor self-allocated lead from the unassigned pool`,
        user.name,
        JSON.stringify({ userId: user.id }),
        user.id,
        user.name
      );
    }

    this.invalidateCache();

    db.prepare(`
      INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
      VALUES ('lead_claim', ?, ?, ?, ?)
    `).run(
      `Counselor ${user.name} claimed ${ids.length} unassigned leads`,
      ids.length,
      JSON.stringify({ userId, claimedIds: ids }),
      user.name
    );

    return {
      claimedCount: ids.length,
      message: `Successfully assigned ${ids.length} fresh leads to ${user.name}!`,
    };
  }

  /**
   * Bulk updates status of selected/filtered leads.
   */
  static bulkUpdateStatus(
    leadIds: number[],
    newStatus: string,
    applyToAllFiltered?: boolean,
    filterParams?: FilterParams
  ): number {
    const db = getDatabase();
    let targetIds = leadIds;

    if (applyToAllFiltered && filterParams) {
      const { whereClause, queryParams } = this.buildWhereClause(filterParams);
      const rows = db.prepare(`
        SELECT leads.id 
        FROM leads 
        LEFT JOIN users ON leads.assigned_to = users.id 
        LEFT JOIN campaigns ON leads.campaign_id = campaigns.id 
        LEFT JOIN dispositions ON leads.disposition_id = dispositions.id 
        ${whereClause}
      `).all(queryParams) as { id: number }[];
      targetIds = rows.map((r) => r.id);
    }

    if (targetIds.length === 0) return 0;

    const updateStmt = db.prepare(`UPDATE leads SET status = @status, updated_at = CURRENT_TIMESTAMP WHERE id = @id`);
    const insertStatusActivity = db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, old_value, new_value, performed_by_name)
      VALUES (?, 'stage_change', ?, ?, NULL, ?, 'Admin')
    `);

    const tx = db.transaction(() => {
      for (const id of targetIds) {
        updateStmt.run({ id, status: newStatus });
        insertStatusActivity.run(
          id,
          `Lifecycle Stage Changed: ${newStatus}`,
          `Status updated to "${newStatus}" via bulk status action`,
          newStatus
        );
      }
      db.prepare(`
        INSERT INTO activity_logs (action_type, description, affected_count)
        VALUES ('status_update', 'Updated status to ' || @status || ' for ' || @count || ' leads', @count)
      `).run({ status: newStatus, count: targetIds.length });
    });

    tx();
    this.invalidateCache();
    return targetIds.length;
  }

  /**
   * Bulk deletes selected/filtered leads.
   */
  static bulkDelete(
    leadIds: number[],
    applyToAllFiltered?: boolean,
    filterParams?: FilterParams
  ): number {
    const db = getDatabase();
    let targetIds = leadIds;

    if (applyToAllFiltered && filterParams) {
      const { whereClause, queryParams } = this.buildWhereClause(filterParams);
      const rows = db.prepare(`
        SELECT leads.id 
        FROM leads 
        LEFT JOIN users ON leads.assigned_to = users.id 
        LEFT JOIN campaigns ON leads.campaign_id = campaigns.id 
        LEFT JOIN dispositions ON leads.disposition_id = dispositions.id 
        ${whereClause}
      `).all(queryParams) as { id: number }[];
      targetIds = rows.map((r) => r.id);
    }

    if (targetIds.length === 0) return 0;

    const deleteStmt = db.prepare(`DELETE FROM leads WHERE id = @id`);
    const tx = db.transaction(() => {
      for (const id of targetIds) {
        deleteStmt.run({ id });
      }
      db.prepare(`
        INSERT INTO activity_logs (action_type, description, affected_count)
        VALUES ('bulk_delete', 'Deleted ' || @count || ' leads', @count)
      `).run({ count: targetIds.length });
    });

    tx();
    this.invalidateCache();
    return targetIds.length;
  }

  /**
   * High-speed bulk CSV lead ingestion engine with custom field mapping:
   * supports campaign attribution, custom/dynamic column mapping, and intelligent phone deduplication!
   */
  static importLeads(
    records: Record<string, any>[],
    sourceName = "Batch Upload",
    campaignId?: string,
    skipDuplicates = false,
    fieldMapping?: Record<string, string>,
    defaultStatus = "New"
  ): { importedCount: number; skippedDuplicates: number; newHeadersFound: string[] } {
    const db = getDatabase();
    if (!records || records.length === 0) return { importedCount: 0, skippedDuplicates: 0, newHeadersFound: [] };

    const existingMeta = db.prepare("SELECT key_name FROM lead_schema_meta").all() as { key_name: string }[];
    const existingSet = new Set(existingMeta.map((m) => m.key_name.toLowerCase()));
    const standardFields = new Set(["name", "phone", "email", "status", "assigned_to", "campaign_id", "__skip__"]);
    const newHeadersFound: string[] = [];

    const insertMeta = db.prepare(`
      INSERT INTO lead_schema_meta (id, key_name, display_label, data_type, is_filterable, filter_type, is_visible, display_order)
      VALUES (@id, @key_name, @display_label, 'string', 1, 'faceted', 1, @display_order)
    `);

    let nextOrder = (db.prepare("SELECT MAX(display_order) as m FROM lead_schema_meta").get() as any)?.m || 10;

    // 1. Discover target attributes from fieldMapping OR discovered keys
    const metaTx = db.transaction(() => {
      if (fieldMapping && Object.keys(fieldMapping).length > 0) {
        for (const targetKey of Object.values(fieldMapping)) {
          const cleanKey = targetKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
          if (!existingSet.has(cleanKey) && !standardFields.has(cleanKey) && cleanKey.length > 0 && cleanKey !== "__skip__") {
            const displayLabel = cleanKey
              .split("_")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");

            insertMeta.run({
              id: `meta_${cleanKey}_${Date.now()}`,
              key_name: cleanKey,
              display_label: displayLabel,
              display_order: ++nextOrder,
            });
            newHeadersFound.push(cleanKey);
            existingSet.add(cleanKey);
          }
        }
      } else {
        const discoveredKeys = new Set<string>();
        records.forEach((row) => {
          Object.keys(row).forEach((k) => discoveredKeys.add(k.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_")));
        });
        for (const key of discoveredKeys) {
          if (!existingSet.has(key) && !standardFields.has(key) && key.length > 0) {
            const displayLabel = key
              .split("_")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ");

            insertMeta.run({
              id: `meta_${key}_${Date.now()}`,
              key_name: key,
              display_label: displayLabel,
              display_order: ++nextOrder,
            });
            newHeadersFound.push(key);
            existingSet.add(key);
          }
        }
      }
    });
    metaTx();

    // 2. Batch insert leads with optional phone deduplication and campaign attribution
    const insertLead = db.prepare(`
      INSERT INTO leads (lead_code, name, phone, email, status, campaign_id, raw_attributes)
      VALUES (@lead_code, @name, @phone, @email, @status, @campaign_id, @raw_attributes)
    `);

    const insertCreatedActivity = db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, old_value, new_value, metadata, performed_by_name)
      VALUES (@lead_id, 'created', @title, @description, NULL, @new_value, @metadata, 'System')
    `);

    let importedCount = 0;
    let skippedDuplicates = 0;
    const currentMaxId = (db.prepare("SELECT MAX(id) as maxId FROM leads").get() as any)?.maxId || 0;

    // Cache existing phone numbers if deduplication is requested
    const existingPhones = new Set<string>();
    if (skipDuplicates) {
      const rows = db.prepare("SELECT phone FROM leads WHERE phone IS NOT NULL").all() as { phone: string }[];
      rows.forEach((r) => {
        const digits = r.phone.replace(/[^0-9]/g, "");
        if (digits.length >= 7) existingPhones.add(digits);
      });
    }

    const hasMapping = Boolean(fieldMapping && Object.keys(fieldMapping).length > 0);

    const batchInsert = db.transaction((rows: Record<string, any>[]) => {
      let codeIndex = currentMaxId + 1;
      for (const row of rows) {
        let name: string | null = null;
        let phone: string | null = null;
        let email: string | null = null;
        let status: string = defaultStatus || "New";
        let rowCampaignId: string | null = campaignId || null;
        const rawAttributes: Record<string, any> = {};

        if (hasMapping) {
          for (const [csvCol, rawVal] of Object.entries(row)) {
            const targetKey = fieldMapping![csvCol];
            if (!targetKey || targetKey === "__skip__") continue;
            const valStr = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";
            if (!valStr) continue;

            const cleanTarget = targetKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");

            if (cleanTarget === "name" || cleanTarget === "student_name") {
              name = valStr;
            } else if (cleanTarget === "phone" || cleanTarget === "mobile" || cleanTarget === "contact") {
              phone = valStr;
            } else if (cleanTarget === "email") {
              email = valStr;
            } else if (cleanTarget === "status") {
              status = valStr;
            } else if (cleanTarget === "campaign_id") {
              rowCampaignId = valStr;
            } else {
              rawAttributes[cleanTarget] = valStr;
            }
          }
        } else {
          name = row.name || row.student_name || row.full_name || null;
          phone = row.phone || row.mobile || row.contact || row.number || null;
          email = row.email || row.student_email || null;
          status = row.status || defaultStatus || "New";

          for (const [k, v] of Object.entries(row)) {
            const cleanK = k.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
            if (!["name", "student_name", "full_name", "phone", "mobile", "contact", "number", "email", "status", "campaign_id", "campaign"].includes(cleanK)) {
              if (v !== undefined && v !== null && String(v).trim() !== "") {
                rawAttributes[cleanK] = String(v).trim();
              }
            }
          }
        }

        // Check for duplicate phone
        if (skipDuplicates && phone) {
          const digits = String(phone).replace(/[^0-9]/g, "");
          if (digits.length >= 7) {
            if (existingPhones.has(digits)) {
              skippedDuplicates++;
              continue;
            }
            existingPhones.add(digits);
          }
        }

        const leadCode = `LD-${String(codeIndex++).padStart(6, "0")}`;

        const leadRes = insertLead.run({
          lead_code: leadCode,
          name,
          phone,
          email,
          status,
          campaign_id: rowCampaignId,
          raw_attributes: JSON.stringify(rawAttributes),
        });
        const newLeadId = Number(leadRes.lastInsertRowid);
        insertCreatedActivity.run({
          lead_id: newLeadId,
          title: "Lead Ingested / Created",
          description: `Acquired via ${sourceName}${rowCampaignId ? ` (${rowCampaignId})` : ""}`,
          new_value: status,
          metadata: JSON.stringify({ lead_code: leadCode, campaign_id: rowCampaignId }),
        });
        importedCount++;
      }

      this.logActivity(
        "IMPORT",
        `Imported ${importedCount} student leads from ${sourceName}${campaignId ? ` (${campaignId})` : ""}${skippedDuplicates > 0 ? ` [${skippedDuplicates} duplicates skipped]` : ""}`,
        importedCount,
        JSON.stringify({ newHeaders: newHeadersFound, skippedDuplicates }),
        "Admin"
      );
    });

    batchInsert(records);
    this.invalidateCache();
    return { importedCount, skippedDuplicates, newHeadersFound };
  }

  /**
   * Generates realistic Indian student leads for high-volume stress testing.
   */
  static generateSampleLeads(count: number): number {
    const firstNames = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Diya", "Saanvi", "Aanya", "Aadhya", "Pari", "Ananya", "Riya", "Myra", "Avani", "Meera", "Kavya", "Aryan", "Rohan", "Tanvi", "Pranav", "Nikhil", "Shreya", "Neha"];
    const lastNames = ["Sharma", "Verma", "Gupta", "Malhotra", "Mehta", "Patel", "Reddy", "Singh", "Nair", "Rao", "Iyer", "Chopra", "Bose", "Das", "Sengupta", "Kulkarni", "Deshmukh", "Joshi", "Agarwal", "Bansal", "Mishra", "Pandey"];
    const schools = [
      "Delhi Public School, R.K. Puram",
      "St. Xavier's Collegiate School",
      "The Mother's International School",
      "National Public School, Indiranagar",
      "Bombay Scottish School, Mahim",
      "Modern School, Barakhamba Road",
      "DAV Public School, Sector 14",
      "Amity International School",
      "Bishop Cotton Boys' School",
      "Kendriya Vidyalaya No. 1",
      "Ryan International School",
      "Don Bosco High School",
      "City Montessori School, Lucknow",
      "Heritage Experiential Learning School",
    ];
    const streams = ["Science (PCM)", "Science (PCB)", "Commerce with Maths", "Commerce without Maths", "Humanities / Arts", "Computer Science"];
    const boards = ["CBSE", "ICSE / ISC", "State Board", "IB (International Baccalaureate)", "Cambridge (IGCSE)"];
    const cities = ["Delhi NCR", "Mumbai", "Bengaluru", "Kolkata", "Hyderabad", "Pune", "Chennai", "Kota", "Jaipur", "Ahmedabad", "Lucknow", "Chandigarh", "Patna"];
    const preferredBranches = ["B.Tech Computer Science", "B.Tech AI & Data Science", "B.Tech Electronics", "MBBS / Pre-Med", "B.Com (Honours)", "BBA Finance", "BA Economics", "B.Des Product Design", "Law (BA LLB)"];

    const sampleRecords: Record<string, any>[] = [];

    for (let i = 0; i < count; i++) {
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const school = schools[Math.floor(Math.random() * schools.length)];
      const stream = streams[Math.floor(Math.random() * streams.length)];
      const board = boards[Math.floor(Math.random() * boards.length)];
      const city = cities[Math.floor(Math.random() * cities.length)];
      const branch = preferredBranches[Math.floor(Math.random() * preferredBranches.length)];
      
      const scoreNum = (68 + Math.random() * 30).toFixed(1);
      const score = `${scoreNum}%`;
      const phone = `+91 ${9000000000 + Math.floor(Math.random() * 999999999)}`;
      const parentPhone = `+91 ${8000000000 + Math.floor(Math.random() * 999999999)}`;
      const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${Math.floor(Math.random() * 900) + 100}@gmail.com`;

      const record: Record<string, any> = {
        name: `${fName} ${lName}`,
        phone,
        email,
        school,
        stream,
        board,
        city,
        score,
        preferred_branch: branch,
        parent_phone: parentPhone,
      };

      // Occasionally add random unexpected dynamic headers to simulate varied imports
      if (i % 5 === 0) {
        record["jee_percentile"] = (75 + Math.random() * 24.9).toFixed(2);
      }
      if (i % 7 === 0) {
        record["hostel_required"] = Math.random() > 0.5 ? "Yes" : "No";
      }
      if (i % 11 === 0) {
        record["scholarship_eligible"] = Math.random() > 0.6 ? "Tier 1" : "Tier 2";
      }

      sampleRecords.push(record);
    }

    const { importedCount } = this.importLeads(sampleRecords, `Synthetic Generator (${count} leads)`);
    return importedCount;
  }

  /**
   * Retrieves registered dynamic schema headers with live lead usage counts.
   */
  static getSchemaMeta(): SchemaMeta[] {
    const db = getDatabase();
    const headers = db
      .prepare(`SELECT * FROM lead_schema_meta ORDER BY display_order ASC`)
      .all() as SchemaMeta[];

    // Compute live count of leads utilizing each dynamic field
    return headers.map((h) => {
      const cleanKey = h.key_name.replace(/[^a-zA-Z0-9_]/g, "");
      let leadCount = 0;
      try {
        const countRow = db
          .prepare(
            `SELECT COUNT(*) as c 
             FROM leads 
             WHERE json_extract(raw_attributes, '$.' || '${cleanKey}') IS NOT NULL 
               AND json_extract(raw_attributes, '$.' || '${cleanKey}') != ''`
          )
          .get() as { c: number };
        leadCount = countRow?.c || 0;
      } catch {
        leadCount = 0;
      }

      return {
        ...h,
        lead_count: leadCount,
      };
    });
  }

  /**
   * Creates a new dynamic schema header.
   */
  static createSchemaMeta(data: {
    key_name: string;
    display_label: string;
    data_type?: 'string' | 'number' | 'date' | 'boolean';
    is_filterable?: number | boolean;
    filter_type?: 'faceted' | 'range' | 'search';
    is_visible?: number | boolean;
    display_order?: number;
  }): SchemaMeta {
    const db = getDatabase();
    const cleanKey = data.key_name.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
    if (!cleanKey) {
      throw new Error("Invalid key name");
    }

    const existing = db
      .prepare("SELECT key_name FROM lead_schema_meta WHERE key_name = ?")
      .get(cleanKey);
    if (existing) {
      throw new Error(`A field with key "${cleanKey}" already exists.`);
    }

    const maxOrderRow = db.prepare("SELECT MAX(display_order) as m FROM lead_schema_meta").get() as any;
    const display_order = data.display_order ?? (maxOrderRow?.m || 0) + 1;
    const id = `meta_${cleanKey}_${Date.now()}`;
    const dataType = data.data_type || "string";
    const isFilterable = data.is_filterable !== undefined ? (data.is_filterable ? 1 : 0) : 1;
    const filterType = data.filter_type || (dataType === "number" ? "range" : "faceted");
    const isVisible = data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : 1;

    db.prepare(`
      INSERT INTO lead_schema_meta (id, key_name, display_label, data_type, is_filterable, filter_type, is_visible, display_order)
      VALUES (@id, @key_name, @display_label, @data_type, @is_filterable, @filter_type, @is_visible, @display_order)
    `).run({
      id,
      key_name: cleanKey,
      display_label: data.display_label.trim(),
      data_type: dataType,
      is_filterable: isFilterable,
      filter_type: filterType,
      is_visible: isVisible,
      display_order,
    });

    db.prepare(`
      INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
      VALUES ('schema_create', @desc, 0, @meta, 'Admin')
    `).run({
      desc: `Created dynamic field "${data.display_label}" (${cleanKey})`,
      meta: JSON.stringify({ key_name: cleanKey, data_type: dataType }),
    });

    return {
      id,
      key_name: cleanKey,
      display_label: data.display_label.trim(),
      data_type: dataType,
      is_filterable: isFilterable,
      filter_type: filterType,
      is_visible: isVisible,
      display_order,
      lead_count: 0,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Deletes a dynamic schema header and optionally purges it from all existing leads' raw_attributes JSON.
   */
  static deleteSchemaMeta(keyName: string, purgeFromLeads = true): { affectedLeads: number } {
    const db = getDatabase();
    const cleanKey = keyName.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");

    let affectedLeads = 0;

    const tx = db.transaction(() => {
      // 1. Delete from lead_schema_meta
      db.prepare("DELETE FROM lead_schema_meta WHERE key_name = ?").run(cleanKey);

      // 2. If purgeFromLeads, remove the key from leads.raw_attributes JSON
      if (purgeFromLeads) {
        const updateResult = db.prepare(`
          UPDATE leads 
          SET raw_attributes = json_remove(raw_attributes, '$.' || '${cleanKey}'),
              updated_at = CURRENT_TIMESTAMP
          WHERE json_extract(raw_attributes, '$.' || '${cleanKey}') IS NOT NULL
        `).run();
        affectedLeads = updateResult.changes;
      }

      // 3. Log activity
      db.prepare(`
        INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
        VALUES ('schema_delete', @desc, @count, @meta, 'Admin')
      `).run({
        desc: `Deleted dynamic field "${cleanKey}" (purged from ${affectedLeads} leads)`,
        count: affectedLeads,
        meta: JSON.stringify({ key_name: cleanKey, purgeFromLeads }),
      });
    });

    tx();
    return { affectedLeads };
  }

  /**
   * Updates metadata settings (visibility, filterability, label).
   */
  static updateSchemaMeta(keyName: string, updates: Partial<SchemaMeta>): void {
    const db = getDatabase();
    const setClauses: string[] = [];
    const params: Record<string, any> = { keyName };

    if (updates.display_label !== undefined) {
      setClauses.push("display_label = @display_label");
      params.display_label = updates.display_label;
    }
    if (updates.data_type !== undefined) {
      setClauses.push("data_type = @data_type");
      params.data_type = updates.data_type;
    }
    if (updates.is_filterable !== undefined) {
      setClauses.push("is_filterable = @is_filterable");
      params.is_filterable = updates.is_filterable ? 1 : 0;
    }
    if (updates.filter_type !== undefined) {
      setClauses.push("filter_type = @filter_type");
      params.filter_type = updates.filter_type;
    }
    if (updates.is_visible !== undefined) {
      setClauses.push("is_visible = @is_visible");
      params.is_visible = updates.is_visible ? 1 : 0;
    }
    if (updates.display_order !== undefined) {
      setClauses.push("display_order = @display_order");
      params.display_order = Number(updates.display_order);
    }

    if (setClauses.length > 0) {
      db.prepare(`UPDATE lead_schema_meta SET ${setClauses.join(", ")} WHERE key_name = @keyName`).run(params);
    }
  }

  /**
   * Retrieves active users/counselors with their current assigned lead counts.
   */
  static getUsers(): User[] {
    const db = getDatabase();
    const users = db.prepare(`
      SELECT 
        users.*,
        COUNT(leads.id) as assigned_count
      FROM users
      LEFT JOIN leads ON users.id = leads.assigned_to
      GROUP BY users.id
      ORDER BY users.name ASC
    `).all() as any[];

    return users.map((u) => ({
      ...u,
      assigned_count: u.assigned_count || 0,
    }));
  }

  /**
   * Creates a new counselor / team member.
   */
  static createUser(data: { name: string; email: string; role?: string }): User {
    const db = getDatabase();
    const cleanEmail = data.email.toLowerCase().trim();
    const id = `usr_${Date.now()}`;
    const colors = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#9333ea", "#0891b2", "#d97706"];
    const avatar_color = colors[Math.floor(Math.random() * colors.length)];

    db.prepare(`
      INSERT INTO users (id, name, email, role, status, avatar_color)
      VALUES (@id, @name, @email, @role, 'active', @avatar_color)
    `).run({
      id,
      name: data.name.trim(),
      email: cleanEmail,
      role: data.role || "counselor",
      avatar_color,
    });

    db.prepare(`
      INSERT INTO activity_logs (action_type, description, affected_count, performed_by)
      VALUES ('user_create', @desc, 0, 'Admin')
    `).run({ desc: `Added counselor ${data.name.trim()} (${cleanEmail})` });

    return {
      id,
      name: data.name.trim(),
      email: cleanEmail,
      role: (data.role as any) || "counselor",
      status: "active",
      avatar_color,
      assigned_count: 0,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Retrieves audit activity logs.
   */
  static getActivityLogs(limit = 50): ActivityLog[] {
    const db = getDatabase();
    return db.prepare(`SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?`).all(limit) as ActivityLog[];
  }

  /**
   * Retrieves chronological audit trail activities for a specific lead.
   */
  static getLeadActivities(leadId: number): LeadActivity[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM lead_activities 
      WHERE lead_id = ? 
      ORDER BY created_at DESC, id DESC
    `).all(leadId) as LeadActivity[];
  }

  /**
   * Logs an immutable event to the individual lead audit trail.
   */
  static logLeadActivity(data: {
    lead_id: number;
    activity_type: string;
    title: string;
    description?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    metadata?: Record<string, any> | string | null;
    performed_by_id?: string | null;
    performed_by_name?: string | null;
    performed_by_role?: string | null;
    created_at?: string;
  }): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO lead_activities (
        lead_id, activity_type, title, description, old_value, new_value, metadata, performed_by_id, performed_by_name, performed_by_role, created_at
      ) VALUES (
        @lead_id, @activity_type, @title, @description, @old_value, @new_value, @metadata, @performed_by_id, @performed_by_name, @performed_by_role, COALESCE(@created_at, CURRENT_TIMESTAMP)
      )
    `).run({
      lead_id: data.lead_id,
      activity_type: data.activity_type,
      title: data.title,
      description: data.description || null,
      old_value: data.old_value || null,
      new_value: data.new_value || null,
      metadata: typeof data.metadata === 'object' && data.metadata !== null ? JSON.stringify(data.metadata) : (data.metadata || null),
      performed_by_id: data.performed_by_id || null,
      performed_by_name: data.performed_by_name || 'System',
      performed_by_role: data.performed_by_role || null,
      created_at: data.created_at || null,
    });
  }

  /**
   * High level summary statistics, strictly isolated by UserScope.
   */
  private static getSummaryStats(userScope?: UserScope) {
    const now = Date.now();
    const cacheKey = userScope && !userScope.canViewAllLeads ? `counselor_${userScope.userId}` : "global";
    const cached = this._summaryCacheMap.get(cacheKey);
    if (cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const db = getDatabase();

    // If user is counselor or telecaller, strictly isolate counts to assigned leads
    if (userScope && !userScope.canViewAllLeads) {
      const totalRow = db
        .prepare("SELECT COUNT(*) as count FROM leads WHERE assigned_to = ?")
        .get(userScope.userId) as { count: number };
      const statusRows = db
        .prepare("SELECT status, COUNT(*) as count FROM leads WHERE assigned_to = ? GROUP BY status")
        .all(userScope.userId) as { status: string; count: number }[];

      const statusBreakdown: Record<string, number> = {};
      statusRows.forEach((r) => {
        statusBreakdown[r.status] = r.count;
      });

      const userTotal = totalRow ? totalRow.count : 0;
      const result = {
        totalLeads: userTotal,
        unassignedCount: 0,
        assignedCount: userTotal,
        statusBreakdown,
      };
      this._summaryCacheMap.set(cacheKey, { data: result, timestamp: now });
      return result;
    }

    const totalRow = db.prepare("SELECT COUNT(*) as count FROM leads").get() as { count: number };
    const unassignedRow = db.prepare("SELECT COUNT(*) as count FROM leads WHERE assigned_to IS NULL").get() as { count: number };
    const assignedRow = db.prepare("SELECT COUNT(*) as count FROM leads WHERE assigned_to IS NOT NULL").get() as { count: number };

    const statusRows = db.prepare("SELECT status, COUNT(*) as count FROM leads GROUP BY status").all() as { status: string; count: number }[];
    const statusBreakdown: Record<string, number> = {};
    statusRows.forEach((r) => {
      statusBreakdown[r.status] = r.count;
    });

    const result = {
      totalLeads: totalRow.count,
      unassignedCount: unassignedRow.count,
      assignedCount: assignedRow.count,
      statusBreakdown,
    };
    this._summaryCacheMap.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  private static sanitizeSortColumn(column?: string): string {
    const allowed = ["id", "lead_code", "name", "phone", "email", "status", "assigned_to", "created_at", "updated_at"];
    if (column && allowed.includes(column)) {
      return `leads.${column}`;
    }
    return "leads.id";
  }

  private static safeParseJson(jsonString?: string): Record<string, any> {
    if (!jsonString) return {};
    try {
      return JSON.parse(jsonString);
    } catch {
      return {};
    }
  }

  private static safeParseArray(jsonString?: string | null): string[] {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves dispositions, optionally filtered by campaign.
   */
  static getDispositions(campaignId?: string): Disposition[] {
    const db = getDatabase();
    if (campaignId) {
      const rows = db
        .prepare(
          `SELECT d.* 
           FROM dispositions d
           INNER JOIN campaign_dispositions cd ON d.id = cd.disposition_id
           WHERE cd.campaign_id = ? AND d.is_active = 1
           ORDER BY d.display_order ASC, d.score DESC`
        )
        .all(campaignId) as any[];

      // If no campaign-specific dispositions found, fallback to all active
      if (rows.length === 0) {
        return db
          .prepare(`SELECT * FROM dispositions WHERE is_active = 1 ORDER BY display_order ASC, score DESC`)
          .all() as Disposition[];
      }
      return rows;
    }

    const rows = db
      .prepare(`SELECT * FROM dispositions ORDER BY display_order ASC, score DESC`)
      .all() as any[];

    // Fetch linked campaign IDs
    const links = db
      .prepare(`SELECT campaign_id, disposition_id FROM campaign_dispositions`)
      .all() as { campaign_id: string; disposition_id: string }[];

    const linkMap: Record<string, string[]> = {};
    for (const l of links) {
      if (!linkMap[l.disposition_id]) linkMap[l.disposition_id] = [];
      linkMap[l.disposition_id].push(l.campaign_id);
    }

    // Fetch active sub-dispositions
    const subDisps = db
      .prepare(`SELECT * FROM sub_dispositions WHERE is_active = 1 ORDER BY display_order ASC`)
      .all() as any[];

    const subDispMap: Record<string, SubDisposition[]> = {};
    for (const s of subDisps) {
      if (!subDispMap[s.disposition_id]) subDispMap[s.disposition_id] = [];
      subDispMap[s.disposition_id].push(s);
    }

    return rows.map((r) => ({
      ...r,
      linked_campaign_ids: linkMap[r.id] || [],
      sub_dispositions: subDispMap[r.id] || [],
    }));
  }

  /**
   * Creates a sub-disposition under a parent disposition.
   */
  static createSubDisposition(data: {
    disposition_id: string;
    name: string;
    code?: string;
    score?: number;
  }): SubDisposition {
    const db = getDatabase();
    const cleanCode = (data.code || data.name).trim().toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const id = `sub_${cleanCode.toLowerCase()}_${Date.now()}`;
    const score = Number(data.score ?? 0);
    const maxOrderRow = db.prepare("SELECT MAX(display_order) as m FROM sub_dispositions WHERE disposition_id = ?").get(data.disposition_id) as any;
    const display_order = (maxOrderRow?.m || 0) + 1;

    db.prepare(`
      INSERT INTO sub_dispositions (id, disposition_id, name, code, score, display_order)
      VALUES (@id, @disposition_id, @name, @code, @score, @display_order)
    `).run({
      id,
      disposition_id: data.disposition_id,
      name: data.name.trim(),
      code: cleanCode,
      score,
      display_order,
    });

    return {
      id,
      disposition_id: data.disposition_id,
      name: data.name.trim(),
      code: cleanCode,
      score,
      display_order,
      is_active: 1,
    };
  }

  /**
   * Deletes a sub-disposition.
   */
  static deleteSubDisposition(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM sub_dispositions WHERE id = ?").run(id);
    db.prepare("UPDATE leads SET sub_disposition_id = NULL WHERE sub_disposition_id = ?").run(id);
  }

  /**
   * Creates a new customizable disposition and optionally links it to campaigns.
   */
  static createDisposition(data: {
    name: string;
    code?: string;
    category: 'positive' | 'neutral' | 'negative' | 'unreachable';
    color: string;
    score?: number;
    requires_callback?: number | boolean;
    is_active?: number | boolean;
    linked_campaign_ids?: string[];
  }): Disposition {
    const db = getDatabase();
    const cleanCode = (data.code || data.name).trim().toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const id = `disp_${cleanCode.toLowerCase()}_${Date.now()}`;
    const score = Number(data.score ?? 0);
    const requires_callback = data.requires_callback ? 1 : 0;
    const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1;

    const maxOrderRow = db.prepare("SELECT MAX(display_order) as m FROM dispositions").get() as any;
    const display_order = (maxOrderRow?.m || 0) + 1;

    const insertDisp = db.prepare(`
      INSERT INTO dispositions (id, name, code, category, color, score, requires_callback, is_active, display_order)
      VALUES (@id, @name, @code, @category, @color, @score, @requires_callback, @is_active, @display_order)
    `);

    const insertLink = db.prepare(`
      INSERT OR IGNORE INTO campaign_dispositions (campaign_id, disposition_id)
      VALUES (?, ?)
    `);

    const tx = db.transaction(() => {
      insertDisp.run({
        id,
        name: data.name.trim(),
        code: cleanCode,
        category: data.category,
        color: data.color || "#3b82f6",
        score,
        requires_callback,
        is_active,
        display_order,
      });

      if (data.linked_campaign_ids && data.linked_campaign_ids.length > 0) {
        for (const campId of data.linked_campaign_ids) {
          insertLink.run(campId, id);
        }
      }
    });

    tx();

    return {
      id,
      name: data.name.trim(),
      code: cleanCode,
      category: data.category,
      color: data.color || "#3b82f6",
      score,
      requires_callback,
      is_active,
      display_order,
      linked_campaign_ids: data.linked_campaign_ids || [],
    };
  }

  /**
   * Updates an existing disposition and updates its campaign links.
   */
  static updateDisposition(
    id: string,
    updates: Partial<Disposition> & { linked_campaign_ids?: string[] }
  ): void {
    const db = getDatabase();
    const setClauses: string[] = [];
    const params: Record<string, any> = { id };

    if (updates.name !== undefined) {
      setClauses.push("name = @name");
      params.name = updates.name.trim();
    }
    if (updates.code !== undefined) {
      setClauses.push("code = @code");
      params.code = updates.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_");
    }
    if (updates.category !== undefined) {
      setClauses.push("category = @category");
      params.category = updates.category;
    }
    if (updates.color !== undefined) {
      setClauses.push("color = @color");
      params.color = updates.color;
    }
    if (updates.score !== undefined) {
      setClauses.push("score = @score");
      params.score = Number(updates.score);
    }
    if (updates.requires_callback !== undefined) {
      setClauses.push("requires_callback = @requires_callback");
      params.requires_callback = updates.requires_callback ? 1 : 0;
    }
    if (updates.is_active !== undefined) {
      setClauses.push("is_active = @is_active");
      params.is_active = updates.is_active ? 1 : 0;
    }
    if (updates.display_order !== undefined) {
      setClauses.push("display_order = @display_order");
      params.display_order = Number(updates.display_order);
    }

    const tx = db.transaction(() => {
      if (setClauses.length > 0) {
        db.prepare(`UPDATE dispositions SET ${setClauses.join(", ")} WHERE id = @id`).run(params);
      }

      if (updates.linked_campaign_ids !== undefined) {
        db.prepare("DELETE FROM campaign_dispositions WHERE disposition_id = ?").run(id);
        const insertLink = db.prepare(
          "INSERT OR IGNORE INTO campaign_dispositions (campaign_id, disposition_id) VALUES (?, ?)"
        );
        for (const campId of updates.linked_campaign_ids) {
          insertLink.run(campId, id);
        }
      }
    });

    tx();
  }

  /**
   * Deletes a disposition and clears references.
   */
  static deleteDisposition(id: string): void {
    const db = getDatabase();
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM campaign_dispositions WHERE disposition_id = ?").run(id);
      db.prepare("UPDATE leads SET disposition_id = NULL WHERE disposition_id = ?").run(id);
      db.prepare("DELETE FROM dispositions WHERE id = ?").run(id);
    });
    tx();
  }

  /**
   * Retrieves all campaigns with live lead counts, conversion counts, and linked disposition IDs.
   */
  static getCampaigns(): Campaign[] {
    const db = getDatabase();
    const campaigns = db.prepare(`SELECT * FROM campaigns ORDER BY created_at DESC`).all() as any[];

    // Compute live stats per campaign from leads table
    const stats = db
      .prepare(
        `SELECT 
          campaign_id,
          COUNT(*) as total_leads,
          SUM(CASE WHEN leads.status = 'Admitted' OR dispositions.category = 'positive' THEN 1 ELSE 0 END) as converted_leads
         FROM leads
         LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
         WHERE campaign_id IS NOT NULL
         GROUP BY campaign_id`
      )
      .all() as { campaign_id: string; total_leads: number; converted_leads: number }[];

    const statsMap = new Map(stats.map((s) => [s.campaign_id, s]));

    // Fetch linked dispositions per campaign
    const links = db
      .prepare(`SELECT campaign_id, disposition_id FROM campaign_dispositions`)
      .all() as { campaign_id: string; disposition_id: string }[];

    const linksMap: Record<string, string[]> = {};
    for (const l of links) {
      if (!linksMap[l.campaign_id]) linksMap[l.campaign_id] = [];
      linksMap[l.campaign_id].push(l.disposition_id);
    }

    return campaigns.map((c) => {
      const st = statsMap.get(c.id);
      return {
        id: c.id,
        name: c.name,
        description: c.description || "",
        channel: c.channel,
        target_audience: c.target_audience || "",
        status: c.status,
        total_leads: st?.total_leads || 0,
        converted_leads: st?.converted_leads || 0,
        linked_disposition_ids: linksMap[c.id] || [],
        created_at: c.created_at,
      };
    });
  }

  /**
   * Creates a new Campaign and associates its initial dispositions.
   */
  static createCampaign(data: {
    name: string;
    channel: string;
    description?: string;
    target_audience?: string;
    status?: 'active' | 'completed' | 'paused';
    linked_disposition_ids?: string[];
  }): Campaign {
    const db = getDatabase();
    const cleanId = `camp_${data.name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 20)}_${Date.now()}`;
    const status = data.status || "active";

    const insertCamp = db.prepare(`
      INSERT INTO campaigns (id, name, description, channel, target_audience, status)
      VALUES (@id, @name, @description, @channel, @target_audience, @status)
    `);

    const insertLink = db.prepare(`
      INSERT OR IGNORE INTO campaign_dispositions (campaign_id, disposition_id)
      VALUES (?, ?)
    `);

    const tx = db.transaction(() => {
      insertCamp.run({
        id: cleanId,
        name: data.name.trim(),
        description: data.description || "",
        channel: data.channel || "General",
        target_audience: data.target_audience || "",
        status,
      });

      if (data.linked_disposition_ids && data.linked_disposition_ids.length > 0) {
        for (const dispId of data.linked_disposition_ids) {
          insertLink.run(cleanId, dispId);
        }
      } else {
        // Link all standard active dispositions by default
        const allDisps = db.prepare("SELECT id FROM dispositions WHERE is_active = 1").all() as { id: string }[];
        for (const d of allDisps) {
          insertLink.run(cleanId, d.id);
        }
      }
    });

    tx();

    return {
      id: cleanId,
      name: data.name.trim(),
      description: data.description,
      channel: data.channel || "General",
      target_audience: data.target_audience,
      status,
      total_leads: 0,
      converted_leads: 0,
      linked_disposition_ids: data.linked_disposition_ids || [],
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Updates an existing campaign and its linked dispositions.
   */
  static updateCampaign(
    id: string,
    updates: Partial<Campaign> & { linked_disposition_ids?: string[] }
  ): void {
    const db = getDatabase();
    const setClauses: string[] = [];
    const params: Record<string, any> = { id };

    if (updates.name !== undefined) {
      setClauses.push("name = @name");
      params.name = updates.name.trim();
    }
    if (updates.description !== undefined) {
      setClauses.push("description = @description");
      params.description = updates.description;
    }
    if (updates.channel !== undefined) {
      setClauses.push("channel = @channel");
      params.channel = updates.channel;
    }
    if (updates.target_audience !== undefined) {
      setClauses.push("target_audience = @target_audience");
      params.target_audience = updates.target_audience;
    }
    if (updates.status !== undefined) {
      setClauses.push("status = @status");
      params.status = updates.status;
    }

    const tx = db.transaction(() => {
      if (setClauses.length > 0) {
        db.prepare(`UPDATE campaigns SET ${setClauses.join(", ")} WHERE id = @id`).run(params);
      }

      if (updates.linked_disposition_ids !== undefined) {
        db.prepare("DELETE FROM campaign_dispositions WHERE campaign_id = ?").run(id);
        const insertLink = db.prepare(
          "INSERT OR IGNORE INTO campaign_dispositions (campaign_id, disposition_id) VALUES (?, ?)"
        );
        for (const dispId of updates.linked_disposition_ids) {
          insertLink.run(id, dispId);
        }
      }
    });

    tx();
  }

  /**
   * Deletes a campaign.
   */
  static deleteCampaign(id: string): void {
    const db = getDatabase();
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM campaign_dispositions WHERE campaign_id = ?").run(id);
      db.prepare("UPDATE leads SET campaign_id = NULL WHERE campaign_id = ?").run(id);
      db.prepare("DELETE FROM campaigns WHERE id = ?").run(id);
    });
    tx();
  }

  /**
   * Fast Counselor Call Logging & Disposition Updater.
   */
  static updateLeadDisposition(
    leadId: number,
    dispositionId: string | null,
    notes?: string,
    callbackAt?: string | null,
    status?: string,
    subDispositionId?: string | null
  ): Lead {
    const db = getDatabase();

    const currentLead = db.prepare(`
      SELECT 
        leads.*,
        users.name as assigned_user_name,
        campaigns.name as campaign_name,
        dispositions.name as disposition_name,
        dispositions.color as disposition_color,
        dispositions.score as disposition_score
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
      LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
      WHERE leads.id = ?
    `).get(leadId) as any;
    if (!currentLead) {
      throw new Error(`Lead #${leadId} not found.`);
    }

    let targetStatus = status || currentLead.status;

    // If disposition is provided and status wasn't explicitly changed, auto-map status from disposition
    let disp: Disposition | undefined = undefined;
    if (dispositionId) {
      disp = db.prepare("SELECT * FROM dispositions WHERE id = ?").get(dispositionId) as Disposition | undefined;
      if (disp && !status) {
        if (disp.code === "ADM_SUBMITTED") targetStatus = "Admitted";
        else if (disp.code === "COUNS_BOOKED" || disp.code === "INT_HIGH") targetStatus = "Interested";
        else if (disp.requires_callback) targetStatus = "Follow-up";
        else if (disp.category === "negative") targetStatus = "Not Interested";
        else if (disp.category === "unreachable") targetStatus = "Contacted";
        else targetStatus = "Contacted";
      }
    }

    let subDisp: SubDisposition | undefined = undefined;
    if (subDispositionId) {
      subDisp = db.prepare("SELECT * FROM sub_dispositions WHERE id = ?").get(subDispositionId) as SubDisposition | undefined;
    }

    let updatedNotes = currentLead.notes;
    if (notes && notes.trim()) {
      const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
      const newEntry = `[${timestamp}] ${notes.trim()}`;
      updatedNotes = updatedNotes ? `${newEntry}\n${updatedNotes}` : newEntry;
    }

    db.prepare(`
      UPDATE leads
      SET 
        disposition_id = @dispositionId,
        sub_disposition_id = @subDispositionId,
        callback_at = @callbackAt,
        notes = @notes,
        status = @status,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @leadId
    `).run({
      leadId,
      dispositionId,
      subDispositionId: subDispositionId || null,
      callbackAt: callbackAt || null,
      notes: updatedNotes,
      status: targetStatus,
    });

    const counselorName = currentLead.assigned_user_name || "Counselor";

    // 1. Audit Trail: Call Disposition outcome
    if (dispositionId && disp) {
      const title = `Call Outcome: ${disp.name}${subDisp ? ` (${subDisp.name})` : ""}`;
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "disposition",
        title,
        description: notes && notes.trim() ? notes.trim() : `Call outcome recorded: ${disp.name}`,
        new_value: disp.name,
        metadata: {
          disposition_id: dispositionId,
          disposition_name: disp.name,
          sub_disposition_id: subDispositionId,
          sub_disposition_name: subDisp?.name,
          color: disp.color,
          score: disp.score,
          call_notes: notes || undefined,
        },
        performed_by_name: counselorName,
      });
    }

    // 2. Audit Trail: Lifecycle stage transition
    if (targetStatus && targetStatus !== currentLead.status) {
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "stage_change",
        title: `Stage Changed: ${currentLead.status} → ${targetStatus}`,
        description: `Lead status updated to "${targetStatus}"`,
        old_value: currentLead.status,
        new_value: targetStatus,
        performed_by_name: counselorName,
      });
    }

    // 3. Audit Trail: Scheduled callback
    if (callbackAt) {
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "callback_scheduled",
        title: "Follow-up Callback Scheduled",
        description: `Scheduled callback for ${new Date(callbackAt).toLocaleString()}`,
        new_value: callbackAt,
        metadata: { callback_at: callbackAt },
        performed_by_name: counselorName,
      });
    }

    // 4. Audit Trail: Standalone note if added without disposition
    if (notes && notes.trim() && !dispositionId) {
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "note",
        title: "Counselor Interaction Note",
        description: notes.trim(),
        performed_by_name: counselorName,
      });
    }

    // High level activity log
    db.prepare(`
      INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
      VALUES ('disposition_update', @desc, 1, @meta, 'Counselor')
    `).run({
      desc: `Logged disposition for Lead ${currentLead.lead_code}`,
      meta: JSON.stringify({ leadId, dispositionId, subDispositionId, callbackAt, status: targetStatus }),
    });

    // Return the updated lead
    const updated = db.prepare(`
      SELECT 
        leads.*,
        users.name as assigned_user_name,
        users.avatar_color as assigned_user_color,
        campaigns.name as campaign_name,
        dispositions.name as disposition_name,
        dispositions.color as disposition_color,
        dispositions.category as disposition_category,
        sub_dispositions.name as sub_disposition_name
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
      LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
      LEFT JOIN sub_dispositions ON leads.sub_disposition_id = sub_dispositions.id
      WHERE leads.id = ?
    `).get(leadId) as any;

    this.invalidateCache();

    return {
      id: updated.id,
      lead_code: updated.lead_code,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      status: updated.status,
      assigned_to: updated.assigned_to,
      assigned_user_name: updated.assigned_user_name,
      assigned_user_color: updated.assigned_user_color,
      assigned_at: updated.assigned_at,
      campaign_id: updated.campaign_id,
      campaign_name: updated.campaign_name,
      disposition_id: updated.disposition_id,
      disposition_name: updated.disposition_name,
      disposition_color: updated.disposition_color,
      sub_disposition_id: updated.sub_disposition_id,
      sub_disposition_name: updated.sub_disposition_name,
      callback_at: updated.callback_at,
      tags: this.safeParseArray(updated.tags),
      raw_attributes: this.safeParseJson(updated.raw_attributes),
      notes: updated.notes,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    };
  }

  /**
   * Logs a user or system action to activity_logs table.
   */
  static logActivity(
    actionType: string,
    description: string,
    affectedCount: number = 1,
    metadata?: string | null,
    performedBy: string = "system"
  ) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(actionType, description, affectedCount, metadata || null, performedBy);
  }

  /**
   * Fetches a single enriched lead by primary ID.
   */
  static getLeadById(leadId: number): Lead | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT 
        leads.*,
        users.name as assigned_user_name,
        users.avatar_color as assigned_user_color,
        campaigns.name as campaign_name,
        dispositions.name as disposition_name,
        dispositions.color as disposition_color,
        dispositions.category as disposition_category,
        sub_dispositions.name as sub_disposition_name
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
      LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
      LEFT JOIN sub_dispositions ON leads.sub_disposition_id = sub_dispositions.id
      WHERE leads.id = ?
    `).get(leadId) as any;

    if (!row) return null;

    return {
      id: row.id,
      lead_code: row.lead_code,
      name: row.name,
      phone: row.phone,
      email: row.email,
      status: row.status,
      assigned_to: row.assigned_to,
      assigned_user_name: row.assigned_user_name,
      assigned_user_color: row.assigned_user_color,
      assigned_at: row.assigned_at,
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      disposition_id: row.disposition_id,
      disposition_name: row.disposition_name,
      disposition_color: row.disposition_color,
      sub_disposition_id: row.sub_disposition_id,
      sub_disposition_name: row.sub_disposition_name,
      callback_at: row.callback_at,
      tags: this.safeParseArray(row.tags),
      raw_attributes: this.safeParseJson(row.raw_attributes),
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Retrieves all saved views for the filter toolbar.
   */
  static getSavedViews(): SavedView[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM saved_views ORDER BY is_default DESC, created_at DESC").all() as any[];
    return rows.map((r) => {
      let visibleCols: string[] | undefined = undefined;
      if (r.visible_columns) {
        try {
          const parsed = JSON.parse(r.visible_columns);
          if (Array.isArray(parsed)) visibleCols = parsed;
        } catch {
          // ignore
        }
      }
      return {
        id: r.id,
        name: r.name,
        filters: this.safeParseJson(r.filters),
        search: r.search || "",
        visible_columns: visibleCols,
        sort_by: r.sort_by || "created_at",
        sort_order: r.sort_order || "desc",
        is_default: r.is_default || 0,
        created_at: r.created_at,
      };
    });
  }

  /**
   * Creates a new saved filter preset view.
   */
  static createSavedView(view: {
    name: string;
    filters: Record<string, string[]>;
    search?: string;
    visible_columns?: string[];
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): SavedView {
    const db = getDatabase();
    const id = `view_${Date.now()}`;
    db.prepare(`
      INSERT INTO saved_views (id, name, filters, search, visible_columns, sort_by, sort_order)
      VALUES (@id, @name, @filters, @search, @visible_columns, @sort_by, @sort_order)
    `).run({
      id,
      name: view.name.trim(),
      filters: JSON.stringify(view.filters || {}),
      search: view.search || "",
      visible_columns: view.visible_columns ? JSON.stringify(view.visible_columns) : null,
      sort_by: view.sort_by || "created_at",
      sort_order: view.sort_order || "desc",
    });

    return {
      id,
      name: view.name.trim(),
      filters: view.filters || {},
      search: view.search || "",
      visible_columns: view.visible_columns,
      sort_by: view.sort_by || "created_at",
      sort_order: view.sort_order || "desc",
      is_default: 0,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Deletes a saved view.
   */
  static deleteSavedView(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM saved_views WHERE id = ?").run(id);
  }

  /**
   * Retrieves scheduled callbacks bucketed into Overdue, Today, and Upcoming.
   */
  static getScheduledCallbacks(counselorId?: string): {
    overdue: CallbackTask[];
    today: CallbackTask[];
    upcoming: CallbackTask[];
    totalCount: number;
  } {
    const db = getDatabase();
    let sql = `
      SELECT 
        leads.id as lead_id,
        leads.lead_code,
        leads.name,
        leads.phone,
        leads.status,
        leads.callback_at,
        leads.assigned_to,
        users.name as assigned_user_name,
        dispositions.name as disposition_name,
        sub_dispositions.name as sub_disposition_name,
        leads.notes
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
      LEFT JOIN sub_dispositions ON leads.sub_disposition_id = sub_dispositions.id
      WHERE leads.callback_at IS NOT NULL
    `;
    const params: any[] = [];
    if (counselorId) {
      sql += " AND leads.assigned_to = ?";
      params.push(counselorId);
    }
    sql += " ORDER BY leads.callback_at ASC LIMIT 100";

    const rows = db.prepare(sql).all(...params) as any[];

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 86400000;

    const overdue: CallbackTask[] = [];
    const today: CallbackTask[] = [];
    const upcoming: CallbackTask[] = [];

    for (const r of rows) {
      const taskTime = new Date(r.callback_at).getTime();
      const task: CallbackTask = {
        lead_id: r.lead_id,
        lead_code: r.lead_code,
        name: r.name,
        phone: r.phone,
        status: r.status,
        callback_at: r.callback_at,
        assigned_to: r.assigned_to,
        assigned_user_name: r.assigned_user_name,
        disposition_name: r.disposition_name,
        sub_disposition_name: r.sub_disposition_name,
        notes: r.notes,
      };

      if (taskTime < startOfToday) {
        overdue.push(task);
      } else if (taskTime <= endOfToday) {
        today.push(task);
      } else {
        upcoming.push(task);
      }
    }

    return {
      overdue,
      today,
      upcoming,
      totalCount: rows.length,
    };
  }

  /**
   * Retrieves all WhatsApp message templates.
   */
  static getWhatsAppTemplates(): WhatsAppTemplate[] {
    const db = getDatabase();
    return db.prepare("SELECT * FROM whatsapp_templates ORDER BY is_default DESC, name ASC").all() as WhatsAppTemplate[];
  }

  /**
   * Creates a new WhatsApp message template.
   */
  static createWhatsAppTemplate(tpl: { name: string; category?: string; template_body: string }): WhatsAppTemplate {
    const db = getDatabase();
    const id = `tpl_${Date.now()}`;
    db.prepare(`
      INSERT INTO whatsapp_templates (id, name, category, template_body, is_default)
      VALUES (@id, @name, @category, @template_body, 0)
    `).run({
      id,
      name: tpl.name.trim(),
      category: tpl.category?.trim() || "General",
      template_body: tpl.template_body.trim(),
    });
    return {
      id,
      name: tpl.name.trim(),
      category: tpl.category?.trim() || "General",
      template_body: tpl.template_body.trim(),
      is_default: 0,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Deletes a WhatsApp message template.
   */
  static deleteWhatsAppTemplate(id: string): void {
    const db = getDatabase();
    db.prepare("DELETE FROM whatsapp_templates WHERE id = ?").run(id);
  }

  /**
   * Finds duplicate lead clusters by phone number or email address.
   */
  static getDuplicateClusters(): { phoneDuplicates: DuplicateCluster[]; emailDuplicates: DuplicateCluster[]; totalDuplicateLeads: number } {
    const db = getDatabase();

    // 1. Phone duplicates
    const phoneRows = db.prepare(`
      SELECT phone, COUNT(*) as cnt 
      FROM leads 
      WHERE phone IS NOT NULL AND TRIM(phone) != '' 
      GROUP BY phone 
      HAVING cnt > 1 
      ORDER BY cnt DESC 
      LIMIT 100
    `).all() as { phone: string; cnt: number }[];

    const phoneDuplicates: DuplicateCluster[] = [];
    let leadCount = 0;

    for (const pr of phoneRows) {
      const clusterLeads = db.prepare(`
        SELECT leads.*, users.name as assigned_user_name, dispositions.name as disposition_name, campaigns.name as campaign_name
        FROM leads
        LEFT JOIN users ON leads.assigned_to = users.id
        LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
        LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
        WHERE leads.phone = ?
        ORDER BY leads.created_at DESC
      `).all(pr.phone) as any[];

      const mappedLeads: Lead[] = clusterLeads.map((r) => ({
        ...r,
        raw_attributes: this.safeParseJson(r.raw_attributes),
      }));

      leadCount += mappedLeads.length;
      phoneDuplicates.push({
        key: pr.phone,
        field: 'phone',
        count: pr.cnt,
        leads: mappedLeads,
      });
    }

    // 2. Email duplicates
    const emailRows = db.prepare(`
      SELECT email, COUNT(*) as cnt 
      FROM leads 
      WHERE email IS NOT NULL AND TRIM(email) != '' 
      GROUP BY email 
      HAVING cnt > 1 
      ORDER BY cnt DESC 
      LIMIT 100
    `).all() as { email: string; cnt: number }[];

    const emailDuplicates: DuplicateCluster[] = [];
    for (const er of emailRows) {
      const clusterLeads = db.prepare(`
        SELECT leads.*, users.name as assigned_user_name, dispositions.name as disposition_name, campaigns.name as campaign_name
        FROM leads
        LEFT JOIN users ON leads.assigned_to = users.id
        LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
        LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
        WHERE leads.email = ?
        ORDER BY leads.created_at DESC
      `).all(er.email) as any[];

      const mappedLeads: Lead[] = clusterLeads.map((r) => ({
        ...r,
        raw_attributes: this.safeParseJson(r.raw_attributes),
      }));

      leadCount += mappedLeads.length;
      emailDuplicates.push({
        key: er.email,
        field: 'email',
        count: er.cnt,
        leads: mappedLeads,
      });
    }

    return {
      phoneDuplicates,
      emailDuplicates,
      totalDuplicateLeads: leadCount,
    };
  }

  /**
   * Merges duplicate leads into a primary lead and removes duplicates.
   */
  static mergeLeads(primaryLeadId: number, duplicateLeadIds: number[]): { success: boolean; primaryLead: Lead } {
    const db = getDatabase();
    if (!duplicateLeadIds || duplicateLeadIds.length === 0) {
      throw new Error("No duplicate lead IDs provided for merge");
    }

    const mergeTx = db.transaction(() => {
      const primaryRow = db.prepare("SELECT * FROM leads WHERE id = ?").get(primaryLeadId) as any;
      if (!primaryRow) throw new Error(`Primary lead ID ${primaryLeadId} not found`);

      const placeholders = duplicateLeadIds.map(() => "?").join(",");
      const duplicateRows = db.prepare(`SELECT * FROM leads WHERE id IN (${placeholders})`).all(...duplicateLeadIds) as any[];

      // Consolidate raw_attributes
      const primaryAttrs = this.safeParseJson(primaryRow.raw_attributes);
      let consolidatedScore = primaryAttrs.score || 0;
      const consolidatedNotes: string[] = primaryRow.notes ? [primaryRow.notes] : [];

      for (const d of duplicateRows) {
        const dAttrs = this.safeParseJson(d.raw_attributes);
        for (const [k, v] of Object.entries(dAttrs)) {
          if (primaryAttrs[k] === undefined || primaryAttrs[k] === null || primaryAttrs[k] === "") {
            primaryAttrs[k] = v;
          }
        }
        if (typeof dAttrs.score === "number" && dAttrs.score > consolidatedScore) {
          consolidatedScore = dAttrs.score;
        }
        if (d.notes && !consolidatedNotes.includes(d.notes)) {
          consolidatedNotes.push(`[Merged from ${d.lead_code}]: ${d.notes}`);
        }
      }
      primaryAttrs.score = consolidatedScore;

      // Update primary lead
      db.prepare(`
        UPDATE leads 
        SET raw_attributes = @attrs, notes = @notes, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id
      `).run({
        id: primaryLeadId,
        attrs: JSON.stringify(primaryAttrs),
        notes: consolidatedNotes.join("\n\n"),
      });

      // Delete duplicate leads
      db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...duplicateLeadIds);

      // Log lead activity on primary surviving record
      const duplicateCodes = duplicateRows.map((d) => d.lead_code).join(", ");
      this.logLeadActivity({
        lead_id: primaryLeadId,
        activity_type: "field_update",
        title: `Duplicate Records Merged (${duplicateLeadIds.length})`,
        description: `Merged data and notes from duplicate records: ${duplicateCodes}`,
        new_value: `${duplicateLeadIds.length} records merged`,
        performed_by_name: "Admin",
      });

      // Log global system activity
      this.logActivity(
        "LEAD_MERGE",
        `Merged ${duplicateLeadIds.length} duplicate record(s) into primary lead ${primaryRow.lead_code}`,
        duplicateLeadIds.length + 1,
        JSON.stringify({ primaryLeadId, duplicateLeadIds }),
        "admin"
      );
    });

    mergeTx();
    this.invalidateCache();

    return {
      success: true,
      primaryLead: this.getLeadById(primaryLeadId)!,
    };
  }

  /**
   * Retrieves all assignment routing rules.
   */
  static getAssignmentRules(): AssignmentRule[] {
    const db = getDatabase();
    return db.prepare(`
      SELECT assignment_rules.*, users.name as assigned_user_name
      FROM assignment_rules
      LEFT JOIN users ON assignment_rules.assigned_to = users.id
      ORDER BY priority ASC, created_at ASC
    `).all() as AssignmentRule[];
  }

  /**
   * Executes automated lead distribution:
   * First applies active rules (e.g. stream/city matching), then round-robins remaining unassigned leads.
   */
  static autoDistributeLeads(maxCount: number = 250): {
    totalAssigned: number;
    ruleAssigned: number;
    roundRobinAssigned: number;
    counselorBreakdown: Record<string, number>;
  } {
    const db = getDatabase();
    const rules = db.prepare("SELECT * FROM assignment_rules WHERE is_active = 1 ORDER BY priority ASC").all() as any[];
    const counselors = db.prepare("SELECT id, name FROM users").all() as { id: string; name: string }[];
    if (counselors.length === 0) throw new Error("No counselors available for auto-distribution");

    const unassignedRows = db.prepare(`
      SELECT id, lead_code, raw_attributes 
      FROM leads 
      WHERE assigned_to IS NULL 
      ORDER BY id ASC 
      LIMIT ?
    `).all(maxCount) as { id: number; lead_code: string; raw_attributes: string }[];

    if (unassignedRows.length === 0) {
      return { totalAssigned: 0, ruleAssigned: 0, roundRobinAssigned: 0, counselorBreakdown: {} };
    }

    const counselorBreakdown: Record<string, number> = {};
    const counselorMap = new Map<string, string>(counselors.map((c) => [c.id, c.name]));
    let ruleAssigned = 0;
    let roundRobinAssigned = 0;

    const assignStmt = db.prepare(`
      UPDATE leads 
      SET assigned_to = @userId, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = @id
    `);

    const insertDistAct = db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, old_value, new_value, metadata, performed_by_name)
      VALUES (@lead_id, 'assigned', @title, @description, 'Unassigned', @new_value, @metadata, 'System')
    `);

    const autoTx = db.transaction(() => {
      let rrIndex = 0;
      for (const lead of unassignedRows) {
        const attrs = this.safeParseJson(lead.raw_attributes);
        let assignedToUserId: string | null = null;

        // Try rule matching
        for (const rule of rules) {
          const attrVal = attrs[rule.criteria_field];
          if (attrVal && String(attrVal).toLowerCase() === String(rule.criteria_value).toLowerCase()) {
            assignedToUserId = rule.assigned_to;
            ruleAssigned++;
            break;
          }
        }

        // Fallback to round-robin
        if (!assignedToUserId) {
          assignedToUserId = counselors[rrIndex % counselors.length].id;
          rrIndex++;
          roundRobinAssigned++;
        }

        const counselorName = counselorMap.get(assignedToUserId) || "Counselor";
        assignStmt.run({ userId: assignedToUserId, id: lead.id });
        insertDistAct.run({
          lead_id: lead.id,
          title: `Auto-Assigned to: ${counselorName}`,
          description: `Allocated via automated distribution engine`,
          new_value: counselorName,
          metadata: JSON.stringify({ assigned_to: assignedToUserId }),
        });
        counselorBreakdown[assignedToUserId] = (counselorBreakdown[assignedToUserId] || 0) + 1;
      }

      this.logActivity(
        "AUTO_DISTRIBUTE",
        `Auto-distributed ${unassignedRows.length} leads (${ruleAssigned} via rules, ${roundRobinAssigned} via round-robin)`,
        unassignedRows.length,
        JSON.stringify(counselorBreakdown),
        "system"
      );
    });

    autoTx();
    this.invalidateCache();

    return {
      totalAssigned: unassignedRows.length,
      ruleAssigned,
      roundRobinAssigned,
      counselorBreakdown,
    };
  }

  /**
   * Retrieves counselor performance metrics and conversion funnel.
   */
  static getPerformanceMetrics(): { leaderboard: CounselorMetric[]; funnel: FunnelStage[] } {
    const db = getDatabase();
    const counselors = db.prepare("SELECT id, name, avatar_color FROM users").all() as any[];

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayIso = startOfToday.toISOString().slice(0, 19).replace('T', ' ');

    const leaderboard: CounselorMetric[] = counselors.map((c) => {
      // 1. Total assigned leads
      const assignedCount = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE assigned_to = ?").get(c.id) as any)?.count || 0;

      // 2. Calls logged today
      const callsToday = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM activity_logs 
        WHERE (performed_by = ? OR metadata LIKE ?) 
        AND action_type IN ('DISPOSITION_LOGGED', 'CALL_LOGGED', 'WHATSAPP_SENT') 
        AND created_at >= ?
      `).get(c.name, `%"assigned_to":"${c.id}"%`, startOfTodayIso) as any)?.count || 0;

      // 3. Contacted leads count
      const contactedCount = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM leads 
        WHERE assigned_to = ? AND status != 'New'
      `).get(c.id) as any)?.count || 0;

      // 4. Admitted leads
      const admissionsCount = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM leads 
        WHERE assigned_to = ? AND status = 'Admitted'
      `).get(c.id) as any)?.count || 0;

      // 5. Avg lead score
      const avgScoreRow = db.prepare(`
        SELECT AVG(CAST(json_extract(raw_attributes, '$.score') AS INTEGER)) as avg_s
        FROM leads 
        WHERE assigned_to = ?
      `).get(c.id) as any;

      const contactRate = assignedCount > 0 ? Math.round((contactedCount / assignedCount) * 100) : 0;
      const avgScore = avgScoreRow?.avg_s ? Math.round(avgScoreRow.avg_s) : 0;

      return {
        counselor_id: c.id,
        name: c.name,
        avatar_color: c.avatar_color || "#3b82f6",
        total_assigned: assignedCount,
        calls_today: callsToday,
        contact_rate: contactRate,
        admissions_count: admissionsCount,
        avg_score: avgScore,
      };
    });

    leaderboard.sort((a, b) => b.admissions_count - a.admissions_count || b.calls_today - a.calls_today);

    // Conversion Funnel calculation
    const totalLeads = (db.prepare("SELECT COUNT(*) as count FROM leads").get() as any)?.count || 1;
    const contacted = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE status != 'New' AND (disposition_id NOT IN ('disp_rnr', 'disp_busy', 'disp_switched_off') OR disposition_id IS NULL)").get() as any)?.count || 0;
    const engaged = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE status IN ('Interested', 'Follow-up', 'Admitted')").get() as any)?.count || 0;
    const counselingBooked = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE disposition_id IN ('disp_couns_booked', 'disp_high_intent') OR status = 'Admitted'").get() as any)?.count || 0;
    const admitted = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'Admitted'").get() as any)?.count || 0;

    const stagesRaw = [
      { stage: "Total Registered Leads", count: totalLeads },
      { stage: "Contacted & Qualified", count: contacted },
      { stage: "Engaged & Evaluating", count: engaged },
      { stage: "Counseling Booked / High Intent", count: counselingBooked },
      { stage: "Final Admitted / Enrolled", count: admitted },
    ];

    const funnel: FunnelStage[] = stagesRaw.map((s, idx) => {
      const percentage = Math.round((s.count / totalLeads) * 100);
      const prevCount = idx === 0 ? s.count : stagesRaw[idx - 1].count;
      const drop_off = prevCount > 0 ? Math.round(((prevCount - s.count) / prevCount) * 100) : 0;
      return {
        stage: s.stage,
        count: s.count,
        percentage,
        drop_off,
      };
    });

    return { leaderboard, funnel };
  }

  /**
   * Fast inline single-field update (status, score, assigned_to, raw_attributes).
   */
  static updateLeadField(
    leadId: number,
    field: string,
    value: any,
    options?: { currentUser?: User | null; overridePolicy?: boolean }
  ): { success: boolean; lead: Lead } {
    const db = getDatabase();
    const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as any;
    if (!existing) throw new Error(`Lead ${leadId} not found`);

    if (field === "status") {
      db.prepare("UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(value, leadId);
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "stage_change",
        title: `Stage Changed: ${existing.status} → ${value}`,
        description: `Stage updated directly to "${value}"`,
        old_value: existing.status,
        new_value: String(value),
        performed_by_name: options?.currentUser?.name || "User",
      });
    } else if (field === "assigned_to") {
      // Enforce Counselor Lock Policy
      const policyCheck = PolicyService.validateReassignment({
        leadId,
        newUserId: value || null,
        currentUser: options?.currentUser,
        overridePolicy: options?.overridePolicy,
      });

      if (!policyCheck.allowed) {
        throw new Error(policyCheck.message || "Reassignment blocked by Counselor Ownership Lock Policy");
      }

      db.prepare("UPDATE leads SET assigned_to = ?, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(value || null, leadId);
      const user = value ? (db.prepare("SELECT name FROM users WHERE id = ?").get(value) as { name: string } | undefined) : undefined;
      const counselorName = user ? user.name : (value ? "Counselor" : "Unassigned");
      const performerRole = options?.currentUser?.role === "team_lead" ? "Team Leader" : "Admin";

      const title = policyCheck.is_override
        ? `Counselor Lock Overridden: Assigned to ${counselorName}`
        : `Assigned to: ${counselorName}`;

      const description = policyCheck.is_override
        ? `Manual override by ${performerRole} (previous call with ${policyCheck.counselor_name} was ${policyCheck.days_since_call}d ago)`
        : `Ownership updated to ${counselorName}`;

      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "assigned",
        title,
        description,
        old_value: existing.assigned_to ? String(existing.assigned_to) : "Unassigned",
        new_value: counselorName,
        metadata: policyCheck.is_override
          ? { is_override: true, days_since_call: policyCheck.days_since_call, previous_counselor: policyCheck.counselor_name }
          : null,
        performed_by_name: options?.currentUser?.name || performerRole,
      });
    } else if (field === "disposition_id") {
      db.prepare("UPDATE leads SET disposition_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(value || null, leadId);
      const disp = value ? (db.prepare("SELECT name, color, score FROM dispositions WHERE id = ?").get(value) as any) : null;
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "disposition",
        title: `Disposition: ${disp ? disp.name : "Cleared"}`,
        description: disp ? `Call outcome marked as ${disp.name}` : "Disposition removed",
        new_value: disp?.name || null,
        metadata: disp ? { color: disp.color, score: disp.score } : null,
        performed_by_name: "Counselor",
      });
    } else if (field === "campaign_id") {
      db.prepare("UPDATE leads SET campaign_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(value || null, leadId);
      const camp = value ? (db.prepare("SELECT name FROM campaigns WHERE id = ?").get(value) as { name: string } | undefined) : undefined;
      const newCampName = camp ? camp.name : (value ? "Campaign" : "None / Unassigned");
      const oldCamp = existing.campaign_id ? (db.prepare("SELECT name FROM campaigns WHERE id = ?").get(existing.campaign_id) as { name: string } | undefined)?.name : "None";
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "field_update",
        title: `Campaign Re-attributed: ${newCampName}`,
        description: `Lead transferred from "${oldCamp}" to "${newCampName}"`,
        old_value: oldCamp,
        new_value: newCampName,
        performed_by_name: "Admin",
      });
    } else if (field === "tags") {
      const tagsArr = Array.isArray(value) ? value : [];
      db.prepare("UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(tagsArr), leadId);
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "field_update",
        title: "Lead Tags Updated",
        description: tagsArr.length > 0 ? `Active tags: ${tagsArr.join(", ")}` : "All tags cleared",
        new_value: tagsArr.join(", "),
        performed_by_name: "Counselor",
      });
    } else {
      // Attribute field (e.g. score, school, city, stream)
      const attrs = this.safeParseJson(existing.raw_attributes);
      const oldValue = attrs[field];
      attrs[field] = value;
      db.prepare("UPDATE leads SET raw_attributes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(attrs), leadId);
      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "field_update",
        title: `Field Updated: ${field}`,
        description: `Changed from "${oldValue ?? "—"}" to "${value}"`,
        old_value: oldValue !== undefined ? String(oldValue) : null,
        new_value: String(value),
        performed_by_name: "User",
      });
    }

    this.invalidateCache();
    return {
      success: true,
      lead: this.getLeadById(leadId)!,
    };
  }

  /**
   * Updates tags on a single lead with rich audit trail tracking.
   */
  static updateLeadTags(leadId: number, tags: string[]): Lead {
    const db = getDatabase();
    const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as any;
    if (!existing) throw new Error(`Lead ${leadId} not found`);

    const oldTags = this.safeParseArray(existing.tags);
    const cleanTags = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
    const tagsJson = JSON.stringify(cleanTags);

    db.prepare("UPDATE leads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(tagsJson, leadId);

    // Compute diff for audit log
    const added = cleanTags.filter((t) => !oldTags.includes(t));
    const removed = oldTags.filter((t) => !cleanTags.includes(t));

    if (added.length > 0 || removed.length > 0) {
      let desc = "";
      if (added.length > 0 && removed.length > 0) {
        desc = `Added: [${added.join(", ")}], Removed: [${removed.join(", ")}]`;
      } else if (added.length > 0) {
        desc = `Added tags: ${added.join(", ")}`;
      } else {
        desc = `Removed tags: ${removed.join(", ")}`;
      }

      this.logLeadActivity({
        lead_id: leadId,
        activity_type: "field_update",
        title: added.length > 0 ? `Tags Updated (+${added.join(", ")})` : `Tags Removed (-${removed.join(", ")})`,
        description: desc,
        old_value: oldTags.join(", ") || null,
        new_value: cleanTags.join(", ") || null,
        performed_by_name: "Counselor",
      });
    }

    this.invalidateCache();
    return this.getLeadById(leadId)!;
  }

  /**
   * Bulk updates campaign attribution for selected or filtered leads.
   */
  static bulkUpdateCampaign(
    leadIds: number[],
    campaignId: string | null,
    applyToAllFiltered?: boolean,
    filterParams?: FilterParams,
    performedByName: string = "Admin"
  ): { affectedCount: number; message: string } {
    const db = getDatabase();
    let targetIds = leadIds;

    if (applyToAllFiltered && filterParams) {
      const { whereClause, queryParams } = this.buildWhereClause(filterParams);
      const rows = db.prepare(`
        SELECT leads.id 
        FROM leads 
        LEFT JOIN users ON leads.assigned_to = users.id 
        LEFT JOIN campaigns ON leads.campaign_id = campaigns.id 
        LEFT JOIN dispositions ON leads.disposition_id = dispositions.id 
        ${whereClause}
      `).all(queryParams) as { id: number }[];
      targetIds = rows.map((r) => r.id);
    }

    if (targetIds.length === 0) {
      return { affectedCount: 0, message: "No leads selected for campaign re-attribution." };
    }

    const cleanCampId =
      campaignId && campaignId !== "unassigned" && campaignId !== "none" && String(campaignId).trim() !== ""
        ? String(campaignId).trim()
        : null;

    let campName = "None / Unassigned";
    if (cleanCampId) {
      const camp = db.prepare("SELECT name FROM campaigns WHERE id = ?").get(cleanCampId) as { name: string } | undefined;
      if (!camp) {
        throw new Error(`Campaign "${cleanCampId}" not found.`);
      }
      campName = camp.name;
    }

    const updateStmt = db.prepare(`UPDATE leads SET campaign_id = @campaignId, updated_at = CURRENT_TIMESTAMP WHERE id = @id`);
    const insertActivity = db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, new_value, performed_by_name)
      VALUES (?, 'field_update', ?, ?, ?, ?)
    `);

    const tx = db.transaction(() => {
      for (const id of targetIds) {
        updateStmt.run({ id, campaignId: cleanCampId });
        insertActivity.run(
          id,
          `Campaign Re-attributed: ${campName}`,
          `Lead transferred to campaign "${campName}" via bulk action`,
          campName,
          performedByName
        );
      }
      db.prepare(`
        INSERT INTO activity_logs (action_type, description, affected_count, performed_by)
        VALUES ('bulk_campaign_update', 'Re-attributed ' || @count || ' leads to campaign ' || @campName, @count, @performedBy)
      `).run({ count: targetIds.length, campName, performedBy: performedByName });
    });

    tx();
    this.invalidateCache();

    return {
      affectedCount: targetIds.length,
      message: `Successfully re-attributed ${targetIds.length} leads to "${campName}"!`,
    };
  }

  /**
   * Bulk adds, removes, or sets tags for selected or filtered leads.
   */
  static bulkUpdateTags(request: {
    lead_ids?: number[];
    action: "add" | "remove" | "set";
    tags: string[];
    apply_to_all_filtered?: boolean;
    filter_params?: FilterParams;
  }): { affectedCount: number; message: string } {
    const db = getDatabase();
    let targetIds = request.lead_ids || [];

    if (request.apply_to_all_filtered && request.filter_params) {
      const { whereClause, queryParams } = this.buildWhereClause(request.filter_params);
      const rows = db.prepare(`
        SELECT leads.id 
        FROM leads 
        LEFT JOIN users ON leads.assigned_to = users.id 
        LEFT JOIN campaigns ON leads.campaign_id = campaigns.id 
        LEFT JOIN dispositions ON leads.disposition_id = dispositions.id 
        ${whereClause}
      `).all(queryParams) as { id: number }[];
      targetIds = rows.map((r) => r.id);
    }

    if (targetIds.length === 0) {
      return { affectedCount: 0, message: "No leads selected for tag modification." };
    }

    const targetTags = request.tags.map((t) => t.trim()).filter(Boolean);
    if (targetTags.length === 0) {
      return { affectedCount: 0, message: "No tags specified." };
    }

    const placeholders = targetIds.map(() => "?").join(",");
    const rows = db.prepare(`SELECT id, tags FROM leads WHERE id IN (${placeholders})`).all(...targetIds) as { id: number; tags: string }[];

    const updateStmt = db.prepare(`UPDATE leads SET tags = @tags, updated_at = CURRENT_TIMESTAMP WHERE id = @id`);
    const insertActivity = db.prepare(`
      INSERT INTO lead_activities (lead_id, activity_type, title, description, new_value, performed_by_name)
      VALUES (?, 'field_update', ?, ?, ?, 'Counselor')
    `);

    const tx = db.transaction(() => {
      for (const row of rows) {
        const curTags = LeadsService.safeParseArray(row.tags);
        let nextTags: string[] = [];

        if (request.action === "add") {
          nextTags = Array.from(new Set([...curTags, ...targetTags]));
        } else if (request.action === "remove") {
          nextTags = curTags.filter((t) => !targetTags.includes(t));
        } else {
          nextTags = targetTags;
        }

        const tagsJson = JSON.stringify(nextTags);
        updateStmt.run({ id: row.id, tags: tagsJson });

        const title = request.action === "add"
          ? `Bulk Tag Added (+${targetTags.join(", ")})`
          : `Bulk Tag Removed (-${targetTags.join(", ")})`;
        const desc = request.action === "add"
          ? `Added tags [${targetTags.join(", ")}] via bulk action. Active: [${nextTags.join(", ")}]`
          : `Removed tags [${targetTags.join(", ")}] via bulk action. Active: [${nextTags.join(", ")}]`;

        insertActivity.run(row.id, title, desc, nextTags.join(", "));
      }

      db.prepare(`
        INSERT INTO activity_logs (action_type, description, affected_count, performed_by)
        VALUES ('bulk_tags', 'Updated tags for ' || @count || ' leads', @count, 'Counselor')
      `).run({ count: targetIds.length });
    });

    tx();
    this.invalidateCache();

    return {
      affectedCount: targetIds.length,
      message: `Successfully updated tags for ${targetIds.length} leads (${request.action}: ${targetTags.join(", ")})!`,
    };
  }

  /**
   * Generates a comprehensive filtered analytics report with dynamic date/time ranges,
   * counselor workloads, conversion funnels, campaign ROI, dispositions, and tabular drilldowns.
   */
  static getFilteredAnalyticsReport(
    params: AnalyticsReportParams,
    userScope?: UserScope
  ): AnalyticsReportData {
    const db = getDatabase();

    // 1. Resolve date range from preset or explicit bounds
    let dateFrom = params.date_from || null;
    let dateTo = params.date_to || null;
    const preset = params.date_preset || "all";

    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === "today") {
      const startToday = new Date(now);
      startToday.setHours(0, 0, 0, 0);
      dateFrom = `${formatDate(startToday)} 00:00:00`;
      dateTo = `${formatDate(now)} 23:59:59`;
    } else if (preset === "yesterday") {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      dateFrom = `${formatDate(yest)} 00:00:00`;
      dateTo = `${formatDate(yest)} 23:59:59`;
    } else if (preset === "7days") {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 7);
      dateFrom = `${formatDate(d7)} 00:00:00`;
      dateTo = `${formatDate(now)} 23:59:59`;
    } else if (preset === "30days") {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      dateFrom = `${formatDate(d30)} 00:00:00`;
      dateTo = `${formatDate(now)} 23:59:59`;
    } else if (preset === "this_month") {
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFrom = `${formatDate(startMonth)} 00:00:00`;
      dateTo = `${formatDate(now)} 23:59:59`;
    } else if (preset === "last_month") {
      const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      dateFrom = `${formatDate(startLastMonth)} 00:00:00`;
      dateTo = `${formatDate(endLastMonth)} 23:59:59`;
    } else if (preset === "custom") {
      if (dateFrom && !dateFrom.includes(":")) dateFrom = `${dateFrom} 00:00:00`;
      if (dateTo && !dateTo.includes(":")) dateTo = `${dateTo} 23:59:59`;
    }

    // 2. Build WHERE clause for leads
    const conditions: string[] = [];
    const queryParams: Record<string, any> = {};

    // RBAC Security constraint
    if (userScope && !userScope.canViewAllLeads) {
      conditions.push("leads.assigned_to = @mandatory_user_id");
      queryParams.mandatory_user_id = userScope.userId;
    } else if (params.assigned_to && params.assigned_to !== "all") {
      if (params.assigned_to === "unassigned") {
        conditions.push("leads.assigned_to IS NULL");
      } else {
        conditions.push("leads.assigned_to = @assigned_to");
        queryParams.assigned_to = params.assigned_to;
      }
    }

    if (params.campaign_id && params.campaign_id !== "all") {
      conditions.push("leads.campaign_id = @campaign_id");
      queryParams.campaign_id = params.campaign_id;
    }

    if (params.status && params.status !== "all") {
      conditions.push("leads.status = @status");
      queryParams.status = params.status;
    }

    if (params.disposition_id && params.disposition_id !== "all") {
      conditions.push("leads.disposition_id = @disposition_id");
      queryParams.disposition_id = params.disposition_id;
    }

    if (params.stream && params.stream !== "all") {
      conditions.push("json_extract(leads.raw_attributes, '$.stream') = @stream");
      queryParams.stream = params.stream;
    }

    if (typeof params.min_score === "number" && params.min_score > 0) {
      conditions.push("CAST(json_extract(leads.raw_attributes, '$.score') AS INTEGER) >= @min_score");
      queryParams.min_score = params.min_score;
    }

    if (dateFrom) {
      conditions.push("leads.created_at >= @date_from");
      queryParams.date_from = dateFrom;
    }
    if (dateTo) {
      conditions.push("leads.created_at <= @date_to");
      queryParams.date_to = dateTo;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 3. Overall Summary Metrics
    const summaryRow = db.prepare(`
      SELECT 
        COUNT(*) as total_leads,
        SUM(CASE WHEN leads.assigned_to IS NOT NULL THEN 1 ELSE 0 END) as assigned_count,
        SUM(CASE WHEN leads.assigned_to IS NULL THEN 1 ELSE 0 END) as unassigned_count,
        SUM(CASE WHEN leads.status != 'New' THEN 1 ELSE 0 END) as contacted_count,
        SUM(CASE WHEN leads.status IN ('Interested', 'Follow-up', 'Admitted') THEN 1 ELSE 0 END) as interested_count,
        SUM(CASE WHEN leads.status = 'Admitted' THEN 1 ELSE 0 END) as admitted_count,
        AVG(CAST(json_extract(leads.raw_attributes, '$.score') AS INTEGER)) as avg_score
      FROM leads
      ${whereClause}
    `).get(queryParams) as any;

    const totalLeads = summaryRow?.total_leads || 0;
    const assignedCount = summaryRow?.assigned_count || 0;
    const unassignedCount = summaryRow?.unassigned_count || 0;
    const contactedCount = summaryRow?.contacted_count || 0;
    const interestedCount = summaryRow?.interested_count || 0;
    const admittedCount = summaryRow?.admitted_count || 0;
    const positiveCount = admittedCount + interestedCount;
    const conversionRate = totalLeads > 0 ? ((positiveCount / totalLeads) * 100).toFixed(1) : "0.0";
    const avgScore = summaryRow?.avg_score ? Math.round(summaryRow.avg_score) : 0;

    // Calls logged query in the same date range
    let callActivitySql = `
      SELECT COUNT(*) as count 
      FROM activity_logs 
      WHERE action_type IN ('DISPOSITION_LOGGED', 'CALL_LOGGED', 'WHATSAPP_SENT', 'disposition_update')
    `;
    const callParams: any = {};
    if (dateFrom) {
      callActivitySql += " AND created_at >= @c_from";
      callParams.c_from = dateFrom;
    }
    if (dateTo) {
      callActivitySql += " AND created_at <= @c_to";
      callParams.c_to = dateTo;
    }
    const callsLogged = (db.prepare(callActivitySql).get(callParams) as any)?.count || 0;

    // 4. Conversion Funnel calculation (strictly constrained by filters)
    const engagedCount = (db.prepare(`
      SELECT COUNT(*) as count FROM leads 
      ${whereClause ? `${whereClause} AND` : "WHERE"} leads.status IN ('Interested', 'Follow-up', 'Admitted')
    `).get(queryParams) as any)?.count || 0;

    const counselingBookedCount = (db.prepare(`
      SELECT COUNT(*) as count FROM leads 
      ${whereClause ? `${whereClause} AND` : "WHERE"} (leads.disposition_id IN ('disp_couns_booked', 'disp_high_intent') OR leads.status = 'Admitted')
    `).get(queryParams) as any)?.count || 0;

    const stagesRaw = [
      { stage: "Total Ingested Leads", count: totalLeads },
      { stage: "Contacted & Qualified", count: contactedCount },
      { stage: "Engaged & Evaluating", count: engagedCount },
      { stage: "Counseling Booked / High Intent", count: counselingBookedCount },
      { stage: "Final Admitted / Enrolled", count: admittedCount },
    ];

    const funnel: FunnelStage[] = stagesRaw.map((s, idx) => {
      const percentage = totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0;
      const prevCount = idx === 0 ? s.count : stagesRaw[idx - 1].count;
      const drop_off = prevCount > 0 ? Math.round(((prevCount - s.count) / prevCount) * 100) : 0;
      return { stage: s.stage, count: s.count, percentage, drop_off };
    });

    // 5. Status Breakdown
    const statusRows = db.prepare(`
      SELECT leads.status, COUNT(*) as count
      FROM leads
      ${whereClause}
      GROUP BY leads.status
      ORDER BY count DESC
    `).all(queryParams) as { status: string; count: number }[];

    const statusColors: Record<string, string> = {
      New: "#3b82f6",
      Contacted: "#f59e0b",
      Interested: "#10b981",
      "Follow-up": "#8b5cf6",
      Admitted: "#6366f1",
      "Not Interested": "#f43f5e",
      Invalid: "#94a3b8",
    };

    const statusBreakdown = statusRows.map((r) => ({
      name: r.status,
      value: r.count,
      color: statusColors[r.status] || "#64748b",
    }));

    // 6. Academic Stream Breakdown
    const streamRows = db.prepare(`
      SELECT json_extract(leads.raw_attributes, '$.stream') as stream, COUNT(*) as count
      FROM leads
      ${whereClause ? `${whereClause} AND` : "WHERE"} json_extract(leads.raw_attributes, '$.stream') IS NOT NULL
      GROUP BY stream
      ORDER BY count DESC
      LIMIT 8
    `).all(queryParams) as { stream: string; count: number }[];

    const streamColors = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#059669", "#0891b2", "#d97706", "#4f46e5"];
    const streamBreakdown = streamRows.map((r, idx) => ({
      name: r.stream ? r.stream.replace("Science ", "").replace("Commerce ", "Comm. ") : "General",
      fullName: r.stream || "General",
      count: r.count,
      color: streamColors[idx % streamColors.length],
    }));

    // 7. Campaign Attribution & ROI Breakdown
    const campaignRows = db.prepare(`
      SELECT 
        campaigns.id,
        campaigns.name,
        COUNT(leads.id) as total,
        SUM(CASE WHEN leads.status != 'New' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN leads.status = 'Admitted' THEN 1 ELSE 0 END) as admitted
      FROM leads
      JOIN campaigns ON leads.campaign_id = campaigns.id
      ${whereClause}
      GROUP BY campaigns.id
      ORDER BY total DESC
      LIMIT 8
    `).all(queryParams) as any[];

    const campaignBreakdown = campaignRows.map((r) => ({
      id: r.id,
      name: r.name,
      total: r.total || 0,
      contacted: r.contacted || 0,
      admitted: r.admitted || 0,
      conversionRate: r.total > 0 ? Math.round(((r.admitted || 0) / r.total) * 100) : 0,
    }));

    // 8. Disposition Breakdown
    const dispRows = db.prepare(`
      SELECT 
        dispositions.name,
        dispositions.color,
        dispositions.category,
        COUNT(leads.id) as count
      FROM leads
      JOIN dispositions ON leads.disposition_id = dispositions.id
      ${whereClause}
      GROUP BY dispositions.id
      ORDER BY count DESC
      LIMIT 8
    `).all(queryParams) as any[];

    const dispositionBreakdown = dispRows.map((r) => ({
      name: r.name.length > 20 ? r.name.slice(0, 18) + "..." : r.name,
      fullName: r.name,
      count: r.count,
      color: r.color || "#3b82f6",
      category: r.category || "neutral",
    }));

    // 9. Counselor Leaderboard Breakdown
    const counselors = db.prepare("SELECT id, name, avatar_color, status FROM users WHERE status = 'active'").all() as any[];
    const counselorBreakdown = counselors.map((c) => {
      const counselorParams = { ...queryParams, c_user_id: c.id };
      const cWhere = whereClause ? `${whereClause} AND leads.assigned_to = @c_user_id` : "WHERE leads.assigned_to = @c_user_id";

      const cLeadRow = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN leads.status != 'New' THEN 1 ELSE 0 END) as contacted,
          SUM(CASE WHEN leads.status = 'Admitted' THEN 1 ELSE 0 END) as admitted,
          AVG(CAST(json_extract(leads.raw_attributes, '$.score') AS INTEGER)) as avg_s
        FROM leads
        ${cWhere}
      `).get(counselorParams) as any;

      let cCallsSql = `
        SELECT COUNT(*) as count 
        FROM activity_logs 
        WHERE (performed_by = ? OR metadata LIKE ?) 
        AND action_type IN ('DISPOSITION_LOGGED', 'CALL_LOGGED', 'WHATSAPP_SENT', 'disposition_update')
      `;
      const cCallParams: any[] = [c.name, `%"assigned_to":"${c.id}"%`];
      if (dateFrom) {
        cCallsSql += " AND created_at >= ?";
        cCallParams.push(dateFrom);
      }
      if (dateTo) {
        cCallsSql += " AND created_at <= ?";
        cCallParams.push(dateTo);
      }
      const cCalls = (db.prepare(cCallsSql).get(...cCallParams) as any)?.count || 0;

      const cTotal = cLeadRow?.total || 0;
      const cContacted = cLeadRow?.contacted || 0;
      const cAdmitted = cLeadRow?.admitted || 0;
      const cContactRate = cTotal > 0 ? Math.round((cContacted / cTotal) * 100) : 0;
      const cConvRate = cTotal > 0 ? Math.round((cAdmitted / cTotal) * 100) : 0;
      const cAvgScore = cLeadRow?.avg_s ? Math.round(cLeadRow.avg_s) : 0;

      return {
        counselor_id: c.id,
        name: c.name,
        avatar_color: c.avatar_color || "#3b82f6",
        total_assigned: cTotal,
        calls_in_period: cCalls,
        contact_rate: cContactRate,
        admissions_count: cAdmitted,
        conversion_rate: cConvRate,
        avg_score: cAvgScore,
      };
    });

    counselorBreakdown.sort((a, b) => b.admissions_count - a.admissions_count || b.calls_in_period - a.calls_in_period);

    // 10. Daily / Timeline Intake Trend
    const trendRows = db.prepare(`
      SELECT 
        SUBSTR(leads.created_at, 1, 10) as date,
        COUNT(*) as leads,
        SUM(CASE WHEN leads.status = 'Admitted' THEN 1 ELSE 0 END) as admitted
      FROM leads
      ${whereClause}
      GROUP BY date
      ORDER BY date ASC
      LIMIT 30
    `).all(queryParams) as any[];

    const dailyIntakeTrend = trendRows.map((r) => ({
      date: r.date,
      leads: r.leads || 0,
      calls: Math.round(r.leads * 0.4),
      admitted: r.admitted || 0,
    }));

    // 11. Sample Filtered Leads (for detailed report table)
    const sampleRows = db.prepare(`
      SELECT 
        leads.id,
        leads.lead_code,
        leads.name,
        leads.phone,
        leads.status,
        json_extract(leads.raw_attributes, '$.school') as school,
        json_extract(leads.raw_attributes, '$.stream') as stream,
        CAST(json_extract(leads.raw_attributes, '$.score') AS INTEGER) as score,
        users.name as assigned_user_name,
        campaigns.name as campaign_name,
        dispositions.name as disposition_name,
        leads.created_at
      FROM leads
      LEFT JOIN users ON leads.assigned_to = users.id
      LEFT JOIN campaigns ON leads.campaign_id = campaigns.id
      LEFT JOIN dispositions ON leads.disposition_id = dispositions.id
      ${whereClause}
      ORDER BY leads.id DESC
      LIMIT 25
    `).all(queryParams) as any[];

    const sampleLeads = sampleRows.map((r) => ({
      id: r.id,
      lead_code: r.lead_code,
      name: r.name || "Student Applicant",
      phone: r.phone || "—",
      status: r.status,
      school: r.school || "Unspecified School",
      stream: r.stream || "General",
      score: r.score || 0,
      assigned_user_name: r.assigned_user_name || null,
      campaign_name: r.campaign_name || null,
      disposition_name: r.disposition_name || null,
      created_at: r.created_at,
    }));

    return {
      filters: {
        date_preset: preset,
        date_from: dateFrom,
        date_to: dateTo,
        assigned_to: params.assigned_to || null,
        campaign_id: params.campaign_id || null,
        status: params.status || null,
        stream: params.stream || null,
      },
      summary: {
        totalLeads,
        assignedCount,
        unassignedCount,
        contactedCount,
        interestedCount,
        admittedCount,
        positiveCount,
        conversionRate,
        callsLogged,
        avgScore,
      },
      funnel,
      statusBreakdown,
      streamBreakdown,
      campaignBreakdown,
      dispositionBreakdown,
      counselorBreakdown,
      dailyIntakeTrend,
      sampleLeads,
    };
  }
}

