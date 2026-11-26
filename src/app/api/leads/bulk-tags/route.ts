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
    const performedByName = currentUser?.name || "Counselor";

    const body = await req.json();
    const { lead_ids, action, tags, apply_to_all_filtered, filter_params, task_config } = body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json({ error: "At least one tag is required" }, { status: 400 });
    }

    const total = apply_to_all_filtered ? 0 : (lead_ids?.length || 0);
    const job = JobsService.enqueueJob({
      jobType: "bulk_tags",
      title: `Bulk ${action === "remove" ? "Remove" : "Add"} Tags (${tags.join(", ")})`,
      totalItems: total,
      createdBy: currentUser,
      run: async ({ updateProgress }) => {
        const result = LeadsService.bulkUpdateTags({
          lead_ids,
          action: action || "add",
          tags,
          apply_to_all_filtered: Boolean(apply_to_all_filtered),
          filter_params,
          task_config,
          performed_by_name: performedByName,
        });
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
        message: "Queued bulk tag update in background.",
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Failed to queue bulk tag update:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to queue bulk tag update" },
      { status: 500 }
    );
  }
}
