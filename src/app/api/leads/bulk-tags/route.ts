import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.cookies.get("dreamdesk_session")?.value;
    let performedByName = "Counselor";
    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session?.user?.name) {
        performedByName = session.user.name;
      }
    }

    const body = await req.json();
    const { lead_ids, action, tags, apply_to_all_filtered, filter_params, task_config } = body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json({ error: "At least one tag is required" }, { status: 400 });
    }

    const result = LeadsService.bulkUpdateTags({
      lead_ids,
      action: action || "add",
      tags,
      apply_to_all_filtered: Boolean(apply_to_all_filtered),
      filter_params,
      task_config,
      performed_by_name: performedByName,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to bulk update tags:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to bulk update tags" },
      { status: 500 }
    );
  }
}
