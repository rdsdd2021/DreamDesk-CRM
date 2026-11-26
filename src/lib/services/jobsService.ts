import { getDatabase, withDbRetry } from "@/lib/db/database";
import { SyncService } from "@/lib/services/syncService";
import { BackgroundJob, BackgroundJobType, User } from "@/types/crm";

export interface JobProgressHelpers {
  updateProgress: (processed: number, success?: number, skipped?: number, total?: number) => void;
  yieldLoop: () => Promise<void>;
}

export class JobsService {
  private static mapRow(row: any): BackgroundJob {
    let summary: Record<string, any> | null = null;
    if (row.result_summary) {
      try {
        summary = typeof row.result_summary === "string" ? JSON.parse(row.result_summary) : row.result_summary;
      } catch {
        summary = null;
      }
    }
    return {
      id: row.id,
      job_type: row.job_type,
      title: row.title,
      status: row.status,
      total_items: Number(row.total_items || 0),
      processed_items: Number(row.processed_items || 0),
      success_count: Number(row.success_count || 0),
      skipped_count: Number(row.skipped_count || 0),
      error_message: row.error_message || null,
      result_summary: summary,
      created_by: row.created_by || null,
      created_by_name: row.created_by_name || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at || null,
    };
  }

  static getJob(jobId: string): BackgroundJob | null {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM background_jobs WHERE id = ?").get(jobId) as any;
    return row ? this.mapRow(row) : null;
  }

  static listJobs(userId?: string | null, canViewAll: boolean = true): BackgroundJob[] {
    const db = getDatabase();
    const rows = canViewAll || !userId
      ? (db.prepare("SELECT * FROM background_jobs ORDER BY created_at DESC LIMIT 20").all() as any[])
      : (db.prepare("SELECT * FROM background_jobs WHERE created_by = ? ORDER BY created_at DESC LIMIT 20").all(userId) as any[]);
    return rows.map((r) => this.mapRow(r));
  }

  static enqueueJob(params: {
    jobType: BackgroundJobType;
    title: string;
    totalItems: number;
    createdBy?: User | null;
    run: (helpers: JobProgressHelpers) => Promise<Record<string, any> | void>;
  }): BackgroundJob {
    const db = getDatabase();
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    withDbRetry(() => {
      db.prepare(`
        INSERT INTO background_jobs (id, job_type, title, status, total_items, processed_items, created_by, created_by_name)
        VALUES (?, ?, ?, 'queued', ?, 0, ?, ?)
      `).run(
        jobId,
        params.jobType,
        params.title,
        Math.max(0, params.totalItems),
        params.createdBy?.id || null,
        params.createdBy?.name || "System"
      );
    });

    const initialJob = this.getJob(jobId)!;

    setTimeout(async () => {
      const workerDb = getDatabase();
      try {
        withDbRetry(() => {
          workerDb.prepare(
            "UPDATE background_jobs SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).run(jobId);
        });

        const helpers: JobProgressHelpers = {
          updateProgress: (processed: number, success?: number, skipped?: number, total?: number) => {
            withDbRetry(() => {
              workerDb.prepare(`
                UPDATE background_jobs
                SET processed_items = ?,
                    success_count = COALESCE(?, success_count),
                    skipped_count = COALESCE(?, skipped_count),
                    total_items = COALESCE(?, total_items),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).run(
                processed,
                success !== undefined ? success : null,
                skipped !== undefined ? skipped : null,
                total !== undefined ? total : null,
                jobId
              );
            });
          },
          yieldLoop: () => new Promise((resolve) => setTimeout(resolve, 5)),
        };

        const result = await params.run(helpers);
        const finalSummary = result || {};

        withDbRetry(() => {
          workerDb.prepare(`
            UPDATE background_jobs
            SET status = 'completed',
                processed_items = CASE WHEN total_items > 0 THEN total_items ELSE processed_items END,
                result_summary = ?,
                updated_at = CURRENT_TIMESTAMP,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(JSON.stringify(finalSummary), jobId);
        });

        try {
          SyncService.publish("leads_bulk_updated", params.jobType, {
            entityId: jobId,
            userId: params.createdBy?.id,
            data: finalSummary,
          });
        } catch {}
      } catch (err: any) {
        console.error(`Background job ${jobId} failed:`, err);
        withDbRetry(() => {
          workerDb.prepare(`
            UPDATE background_jobs
            SET status = 'failed',
                error_message = ?,
                updated_at = CURRENT_TIMESTAMP,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(err?.message || "Job failed", jobId);
        });
      }
    }, 10);

    return initialJob;
  }
}
