import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";
import { logServerError } from "@/lib/db/database";
import { BulkAssignRequest } from "@/types/crm";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("dreamdesk_session")?.value;
  const session = sessionId ? AuthService.getSession(sessionId) : null;
  const currentUser = session?.user || null;

  try {
    const body = (await request.json()) as BulkAssignRequest & { async?: boolean };

    if (!body.mode) {
      return NextResponse.json(
        { error: "Assignment mode ('auto', 'quota', or 'single') is required.", code: "INVALID_MODE" },
        { status: 400 }
      );
    }

    if (body.async) {
      const targetIds = body.lead_ids && body.lead_ids.length > 0 && !body.apply_to_all_filtered
        ? body.lead_ids
        : LeadsService.getTargetLeadIds(body.filter_params || {}, body.total_to_assign);

      const batchId =
        body.assignment_batch_id ||
        `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const batchName =
        body.assignment_name?.trim() ||
        `Batch — ${new Date().toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

      const job = JobsService.enqueueJob({
        jobType: "bulk_assign",
        title: `Assign ${targetIds.length.toLocaleString()} Leads (${batchName})`,
        totalItems: targetIds.length,
        createdBy: currentUser,
        run: async ({ updateProgress, yieldLoop }) => {
          const CHUNK_SIZE = 350;
          let affectedTotal = 0;
          let skippedTotal = 0;

          for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
            const chunkIds = targetIds.slice(i, i + CHUNK_SIZE);
            const res = LeadsService.bulkAssign(
              {
                ...body,
                assignment_batch_id: batchId,
                assignment_name: batchName,
                lead_ids: chunkIds,
                apply_to_all_filtered: false,
              },
              currentUser
            );
            affectedTotal += res.affectedCount || 0;
            skippedTotal += res.skippedLockedCount || 0;
            updateProgress(Math.min(i + chunkIds.length, targetIds.length), affectedTotal, skippedTotal);
            await yieldLoop();
          }

          return {
            affectedCount: affectedTotal,
            skippedLockedCount: skippedTotal,
            batchName,
          };
        },
      });

      return NextResponse.json(
        {
          success: true,
          async: true,
          job,
          message: `Queued "${batchName}" (${targetIds.length.toLocaleString()} leads) in background.`,
        },
        { status: 202 }
      );
    }

    const result = LeadsService.bulkAssign(body, currentUser);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Bulk assign error:", error);
    logServerError({
      errorCode: error?.code || "BULK_ASSIGN_ERROR",
      message: error?.message || "Failed to process bulk assignment",
      details: error?.stack,
      endpoint: "/api/leads/bulk-assign",
      httpStatus: 500,
      userId: currentUser?.id,
      userName: currentUser?.name,
    });

    return NextResponse.json(
      {
        error: error?.message || "Failed to process bulk assignment",
        code: error?.code || "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
