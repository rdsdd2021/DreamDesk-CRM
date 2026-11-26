import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(request, "canDeleteLeads");
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const body = await request.json();
    const { lead_ids, apply_to_all_filtered, filter_params } = body;

    const total = apply_to_all_filtered ? 0 : (lead_ids?.length || 0);
    const job = JobsService.enqueueJob({
      jobType: "bulk_delete",
      title: `Bulk Delete Leads`,
      totalItems: total,
      createdBy: session.user,
      run: async ({ updateProgress }) => {
        const affected = LeadsService.bulkDelete(
          lead_ids || [],
          apply_to_all_filtered,
          filter_params
        );
        updateProgress(affected, affected, 0, affected);
        return { affectedCount: affected };
      },
    });

    return NextResponse.json(
      {
        success: true,
        async: true,
        job,
        message: "Queued bulk delete in background.",
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: error?.message || "Failed to queue bulk delete" }, { status: 500 });
  }
}
