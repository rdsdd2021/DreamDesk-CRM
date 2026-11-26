import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user || null;
    let performedByName = currentUser?.name || "Admin";

    if (session && !session.permissions.canManageCampaigns && !session.permissions.canAssignLeads) {
      return NextResponse.json(
        { error: "Access denied. Insufficient permissions to re-attribute campaigns." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { lead_ids, campaign_id, apply_to_all_filtered, filter_params, task_config } = body;

    const total = apply_to_all_filtered ? 0 : (lead_ids?.length || 0);
    const job = JobsService.enqueueJob({
      jobType: "bulk_campaign",
      title: `Bulk Campaign Attribution`,
      totalItems: total,
      createdBy: currentUser,
      run: async ({ updateProgress }) => {
        const result = LeadsService.bulkUpdateCampaign(
          lead_ids || [],
          campaign_id || null,
          Boolean(apply_to_all_filtered),
          filter_params,
          performedByName,
          task_config
        );
        const count = Number((result as any)?.affectedCount || total || 0);
        updateProgress(count, count, 0, count);
        return result as any;
      },
    });

    return NextResponse.json(
      {
        success: true,
        async: true,
        job,
        message: "Queued bulk campaign update in background.",
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Failed to queue bulk campaign update:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to queue bulk campaign update" },
      { status: 500 }
    );
  }
}
