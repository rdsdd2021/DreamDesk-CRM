import { getDatabase, withDbRetry } from "@/lib/db/database";
import { SyncService } from "@/lib/services/syncService";
import { BackgroundJob, BackgroundJobLogEntry, BackgroundJobType, User } from "@/types/crm";

export interface JobProgressHelpers {
  updateProgress: (processed: number, success?: number, skipped?: number, total?: number) => void;
  appendLog: (level: "info" | "warn" | "error", message: string) => void;
  isCancelled: () => boolean;
  yieldLoop: () => Promise<void>;
}

const g = globalThis as unknown as {
  __dreamdeskActiveJobs?: Set<string>;
  __dreamdeskCancelledJobs?: Set<string>;
  __dreamdeskJobsRecovered?: boolean;
};

function getActiveJobSet(): Set<string> {
  if (!g.__dreamdeskActiveJobs) g.__dreamdeskActiveJobs = new Set<string>();
  return g.__dreamdeskActiveJobs;
}

function getCancelledJobSet(): Set<string> {
  if (!g.__dreamdeskCancelledJobs) g.__dreamdeskCancelledJobs = new Set<string>();
  return g.__dreamdeskCancelledJobs;
}

export class JobsService {
  static recoverStaleJobs(): void {
    if (g.__dreamdeskJobsRecovered) return;
    g.__dreamdeskJobsRecovered = true;

    const db = getDatabase();
    const active = getActiveJobSet();
    const staleRows = db
      .prepare("SELECT id, logs FROM background_jobs WHERE status IN ('queued', 'running')")
      .all() as { id: string; logs?: string }[];

    for (const row of staleRows) {
      if (active.has(row.id)) continue;
      let logs: BackgroundJobLogEntry[] = [];
      try {
        logs = row.logs ? JSON.parse(row.logs) : [];
      } catch {
        logs = [];
      }
      logs.push({
        ts: new Date().toISOString(),
        level: "error",
        message: "Job interrupted because the server restarted or crashed. You can dismiss or retry.",
      });
      withDbRetry(() => {
        db.prepare(
          `
          UPDATE background_jobs
          SET status = 'failed',
              error_message = 'Interrupted by server restart or crash',
              logs = ?,
              updated_at = CURRENT_TIMESTAMP,
              completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        ).run(JSON.stringify(logs.slice(-100)), row.id);
      });
    }
  }
  private static mapRow(row: any): BackgroundJob {
    let summary: Record<string, any> | null = null;
    if (row.result_summary) {
      try {
        summary = typeof row.result_summary === "string" ? JSON.parse(row.result_summary) : row.result_summary;
      } catch {
        summary = null;
      }
    }
    let logs: BackgroundJobLogEntry[] = [];
    if (row.logs) {
      try {
        logs = typeof row.logs === "string" ? JSON.parse(row.logs) : row.logs;
      } catch {
        logs = [];
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
      logs: Array.isArray(logs) ? logs : [],
      created_by: row.created_by || null,
      created_by_name: row.created_by_name || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at || null,
    };
  }

  static getJob(jobId: string): BackgroundJob | null {
    this.recoverStaleJobs();
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM background_jobs WHERE id = ?").get(jobId) as any;
    return row ? this.mapRow(row) : null;
  }

  static listJobs(userId?: string | null, canViewAll: boolean = true): BackgroundJob[] {
    this.recoverStaleJobs();
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

    const initialLogs: BackgroundJobLogEntry[] = [
      { ts: new Date().toISOString(), level: "info", message: `Queued: ${params.title}` },
    ];

    withDbRetry(() => {
      db.prepare(`
        INSERT INTO background_jobs (id, job_type, title, status, total_items, processed_items, logs, created_by, created_by_name)
        VALUES (?, ?, ?, 'queued', ?, 0, ?, ?, ?)
      `).run(
        jobId,
        params.jobType,
        params.title,
        Math.max(0, params.totalItems),
        JSON.stringify(initialLogs),
        params.createdBy?.id || null,
        params.createdBy?.name || "System"
      );
    });

    const initialJob = this.getJob(jobId)!;
    getActiveJobSet().add(jobId);

    setTimeout(async () => {
      const workerDb = getDatabase();
      const pushLog = (level: "info" | "warn" | "error", message: string) => {
        withDbRetry(() => {
          const row = workerDb.prepare("SELECT logs FROM background_jobs WHERE id = ?").get(jobId) as { logs?: string } | undefined;
          let arr: BackgroundJobLogEntry[] = [];
          try {
            arr = row?.logs ? JSON.parse(row.logs) : [];
          } catch {
            arr = [];
          }
          arr.push({ ts: new Date().toISOString(), level, message });
          if (arr.length > 100) arr = arr.slice(-100);
          workerDb
            .prepare("UPDATE background_jobs SET logs = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(JSON.stringify(arr), jobId);
        });
      };

      try {
        withDbRetry(() => {
          workerDb.prepare(
            "UPDATE background_jobs SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).run(jobId);
        });
        pushLog("info", "Job started on server.");

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
          appendLog: pushLog,
          isCancelled: () => getCancelledJobSet().has(jobId),
          yieldLoop: () => new Promise((resolve) => setTimeout(resolve, 5)),
        };

        const result = await params.run(helpers);
        if (getCancelledJobSet().has(jobId)) {
          return;
        }
        const finalSummary = result || {};
        pushLog("info", "Job completed successfully.");

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
        if (!getCancelledJobSet().has(jobId)) {
          console.error(`Background job ${jobId} failed:`, err);
          pushLog("error", err?.message || "Job failed unexpectedly");
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
      } finally {
        getActiveJobSet().delete(jobId);
        getCancelledJobSet().delete(jobId);
      }
    }, 10);

    return initialJob;
  }

  static cancelJob(jobId: string, actorName: string): BackgroundJob | null {
    const db = getDatabase();
    const existing = this.getJob(jobId);
    if (!existing) return null;

    getCancelledJobSet().add(jobId);
    getActiveJobSet().delete(jobId);

    const logs = existing.logs ? [...existing.logs] : [];
    logs.push({
      ts: new Date().toISOString(),
      level: "warn",
      message: `Cancelled by ${actorName}.`,
    });

    withDbRetry(() => {
      db.prepare(
        `
        UPDATE background_jobs
        SET status = 'failed',
            error_message = 'Cancelled by user',
            logs = ?,
            updated_at = CURRENT_TIMESTAMP,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      ).run(JSON.stringify(logs.slice(-100)), jobId);
    });

    return this.getJob(jobId);
  }
}
