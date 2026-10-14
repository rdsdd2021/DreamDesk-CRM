import { getDatabase } from "@/lib/db/database";
import { LeadScoringPolicyConfig, Disposition, SubDisposition } from "@/types/crm";

export const DEFAULT_SCORING_CONFIG: LeadScoringPolicyConfig = {
  academic_weight: 40,
  disposition_weight: 60,
  attempt_penalty: 5,
  high_intent_threshold: 70,
  auto_recalculate_on_call: true,
};

export class ScoringService {
  /**
   * Retrieves the active Lead Scoring & Ranking Policy Configuration from database.
   */
  static getScoringConfig(): LeadScoringPolicyConfig {
    const db = getDatabase();
    try {
      const row = db
        .prepare("SELECT config, is_enabled FROM crm_policies WHERE id = 'lead_scoring_policy'")
        .get() as { config: string; is_enabled: number } | undefined;

      if (!row || !row.config) {
        return { ...DEFAULT_SCORING_CONFIG };
      }

      const parsed = typeof row.config === "string" ? JSON.parse(row.config) : row.config;
      return {
        academic_weight: Number(parsed.academic_weight ?? DEFAULT_SCORING_CONFIG.academic_weight),
        disposition_weight: Number(parsed.disposition_weight ?? DEFAULT_SCORING_CONFIG.disposition_weight),
        attempt_penalty: Number(parsed.attempt_penalty ?? DEFAULT_SCORING_CONFIG.attempt_penalty),
        high_intent_threshold: Number(parsed.high_intent_threshold ?? DEFAULT_SCORING_CONFIG.high_intent_threshold),
        auto_recalculate_on_call: parsed.auto_recalculate_on_call !== undefined ? Boolean(parsed.auto_recalculate_on_call) : true,
      };
    } catch (err) {
      console.error("Failed to load scoring policy config:", err);
      return { ...DEFAULT_SCORING_CONFIG };
    }
  }

  /**
   * Updates scoring policy weights and saves to crm_policies table.
   */
  static updateScoringConfig(
    updates: Partial<LeadScoringPolicyConfig>,
    performedBy = "Admin"
  ): LeadScoringPolicyConfig {
    const db = getDatabase();
    const current = this.getScoringConfig();

    const merged: LeadScoringPolicyConfig = {
      academic_weight: updates.academic_weight !== undefined ? Number(updates.academic_weight) : current.academic_weight,
      disposition_weight: updates.disposition_weight !== undefined ? Number(updates.disposition_weight) : current.disposition_weight,
      attempt_penalty: updates.attempt_penalty !== undefined ? Number(updates.attempt_penalty) : current.attempt_penalty,
      high_intent_threshold: updates.high_intent_threshold !== undefined ? Number(updates.high_intent_threshold) : current.high_intent_threshold,
      auto_recalculate_on_call: updates.auto_recalculate_on_call !== undefined ? Boolean(updates.auto_recalculate_on_call) : current.auto_recalculate_on_call,
    };

    db.prepare(`
      INSERT INTO crm_policies (id, name, description, policy_type, is_enabled, config, updated_at)
      VALUES (
        'lead_scoring_policy',
        'Lead Ranking & Composite Scoring Engine',
        'Calculates real-time 0–100 priority score from academic baseline, disposition engagement points, and unreachable attempt penalties.',
        'lead_scoring',
        1,
        @config,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT(id) DO UPDATE SET
        config = @config,
        updated_at = CURRENT_TIMESTAMP
    `).run({ config: JSON.stringify(merged) });

    db.prepare(`
      INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
      VALUES ('scoring_policy_update', @desc, 0, @meta, @by)
    `).run({
      desc: `Updated Lead Scoring Algorithm weights: Academic ${merged.academic_weight}%, Disposition ${merged.disposition_weight}%, Attempt Penalty -${merged.attempt_penalty}pts`,
      meta: JSON.stringify(merged),
      by: performedBy,
    });

    return merged;
  }

  /**
   * Pure calculation algorithm: Computes the 0–100 composite ranking score for a lead.
   *
   * Formula:
   * AcademicPart = (NormalizedAcademic / 100) * AcademicWeight
   * DispositionPart = (NormalizedDispositionPoints / 100) * DispositionWeight
   * Penalties = AttemptCount * AttemptPenalty
   * Score = Clamp(0, 100, Round(AcademicPart + DispositionPart - Penalties))
   */
  static calculateScore(
    lead: {
      raw_attributes?: any;
      disposition_id?: string | null;
      sub_disposition_id?: string | null;
      attempt_count?: number;
    },
    config?: LeadScoringPolicyConfig,
    dispCache?: Map<string, Disposition>,
    subDispCache?: Map<string, SubDisposition>
  ): number {
    const cfg = config || this.getScoringConfig();

    // 1. Academic baseline
    let rawAttrs: Record<string, any> = {};
    if (lead.raw_attributes) {
      if (typeof lead.raw_attributes === "string") {
        try {
          rawAttrs = JSON.parse(lead.raw_attributes);
        } catch {
          rawAttrs = {};
        }
      } else if (typeof lead.raw_attributes === "object") {
        rawAttrs = lead.raw_attributes;
      }
    }

    let academicNum = 50; // Neutral default baseline
    const candidates = [rawAttrs.academic_score, rawAttrs.score, rawAttrs.percentage, rawAttrs.jee_percentile, rawAttrs.marks];
    for (const cand of candidates) {
      if (cand !== undefined && cand !== null && cand !== "") {
        const parsed = parseFloat(String(cand).replace(/[^0-9.]/g, ""));
        if (!isNaN(parsed) && parsed > 0) {
          academicNum = Math.min(100, parsed);
          break;
        }
      }
    }
    const academicPart = (academicNum / 100) * cfg.academic_weight;

    // 2. Disposition engagement points
    let dispScore = 0;
    if (lead.disposition_id) {
      if (dispCache && dispCache.has(lead.disposition_id)) {
        dispScore = Number(dispCache.get(lead.disposition_id)?.score || 0);
      } else {
        const db = getDatabase();
        const dRow = db.prepare("SELECT score FROM dispositions WHERE id = ?").get(lead.disposition_id) as any;
        if (dRow) dispScore = Number(dRow.score || 0);
      }
    }

    if (lead.sub_disposition_id) {
      if (subDispCache && subDispCache.has(lead.sub_disposition_id)) {
        dispScore += Number(subDispCache.get(lead.sub_disposition_id)?.score || 0);
      } else {
        const db = getDatabase();
        const sdRow = db.prepare("SELECT score FROM sub_dispositions WHERE id = ?").get(lead.sub_disposition_id) as any;
        if (sdRow) dispScore += Number(sdRow.score || 0);
      }
    }

    // Map disposition score (-35 to +50) onto a 0-100 spectrum centered at 50
    const normalizedDispPoints = Math.max(0, Math.min(100, 50 + dispScore));
    const dispPart = (normalizedDispPoints / 100) * cfg.disposition_weight;

    // 3. Dial Attempt Penalties
    const attempts = Math.max(0, Number(lead.attempt_count || 0));
    const attemptPenalty = attempts * cfg.attempt_penalty;

    // 4. Composite clamped integer
    const finalScore = Math.max(0, Math.min(100, Math.round(academicPart + dispPart - attemptPenalty)));
    return finalScore;
  }

  /**
   * Recalculates and persists the lead's rank score in raw_attributes.score.
   */
  static recalculateLead(leadId: number, config?: LeadScoringPolicyConfig): number {
    const db = getDatabase();
    const lead = db.prepare(`
      SELECT id, raw_attributes, disposition_id, sub_disposition_id, attempt_count
      FROM leads
      WHERE id = ?
    `).get(leadId) as any;

    if (!lead) return 50;

    const newScore = this.calculateScore(lead, config);

    let rawAttrs: Record<string, any> = {};
    try {
      rawAttrs = typeof lead.raw_attributes === "string" ? JSON.parse(lead.raw_attributes) : lead.raw_attributes || {};
    } catch {}

    rawAttrs.score = newScore;

    db.prepare(`
      UPDATE leads
      SET raw_attributes = @rawAttrs,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @leadId
    `).run({
      leadId,
      rawAttrs: JSON.stringify(rawAttrs),
    });

    return newScore;
  }

  /**
   * High-speed batch recalculation of all leads across the CRM database.
   */
  static recalculateAllLeads(
    config?: LeadScoringPolicyConfig,
    performedBy = "Admin"
  ): { affectedCount: number; avgScore: number } {
    const db = getDatabase();
    const cfg = config || this.getScoringConfig();

    // Cache dispositions for rapid calculation in memory
    const disps = db.prepare("SELECT * FROM dispositions").all() as Disposition[];
    const subDisps = db.prepare("SELECT * FROM sub_dispositions").all() as SubDisposition[];
    const dispMap = new Map<string, Disposition>(disps.map((d) => [d.id, d]));
    const subDispMap = new Map<string, SubDisposition>(subDisps.map((s) => [s.id, s]));

    const leads = db.prepare(`
      SELECT id, raw_attributes, disposition_id, sub_disposition_id, attempt_count
      FROM leads
    `).all() as any[];

    if (leads.length === 0) {
      return { affectedCount: 0, avgScore: 0 };
    }

    const updateStmt = db.prepare(`
      UPDATE leads
      SET raw_attributes = @rawAttrs,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);

    let totalScoreSum = 0;
    const batchTx = db.transaction(() => {
      for (const lead of leads) {
        const calculated = this.calculateScore(lead, cfg, dispMap, subDispMap);
        totalScoreSum += calculated;

        let rawAttrs: Record<string, any> = {};
        try {
          rawAttrs = typeof lead.raw_attributes === "string" ? JSON.parse(lead.raw_attributes) : lead.raw_attributes || {};
        } catch {}

        rawAttrs.score = calculated;
        updateStmt.run({
          id: lead.id,
          rawAttrs: JSON.stringify(rawAttrs),
        });
      }

      db.prepare(`
        INSERT INTO activity_logs (action_type, description, affected_count, metadata, performed_by)
        VALUES ('batch_score_recalculate', @desc, @count, @meta, @by)
      `).run({
        desc: `Batch recalculated Lead Ranking Scores for ${leads.length} leads.`,
        count: leads.length,
        meta: JSON.stringify(cfg),
        by: performedBy,
      });
    });

    batchTx();

    const avgScore = Math.round(totalScoreSum / leads.length);
    return { affectedCount: leads.length, avgScore };
  }
}
