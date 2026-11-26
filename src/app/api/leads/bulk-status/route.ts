import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user || null;

    const body = await request.json();
    const { lead_ids, status, apply_to_all_filtered, filter_params } = body;

    if (!status) {
      return NextResponse.json({ error: "New status is required" }, { status: 400 });
    }

    const total = apply_to_all_filtered ? 0 : (lead_ids?.length || 0);
    const job = JobsService.enqueueJob({
      jobType: "bulk_status",
      title: `Update Stage to "${status}"`,
      totalItems: total,
      createdBy: currentUser,
      run: async ({ updateProgress }) => {
        const affected = LeadsService.bulkUpdateStatus(
          lead_ids || [],
          status,
          apply_to_all_filtered,
          filter_params
        );
        updateProgress(affected, affected, 0, affected);
        return { affectedCount: affected, status };
      },
    });

    return NextResponse.json(
      {
        success: true,
        async: true,
        job,
        message: `Queued stage update to "${status}" in background.`,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Bulk status error:", error);
    return NextResponse.json({ error: error?.message || "Failed to queue status update" }, { status: 500 });
  }
}
