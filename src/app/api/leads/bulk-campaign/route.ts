import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.cookies.get("dreamdesk_session")?.value;
    let performedByName = "Admin";
    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session && !session.permissions.canManageCampaigns && !session.permissions.canAssignLeads) {
        return NextResponse.json(
          { error: "Access denied. Insufficient permissions to re-attribute campaigns." },
          { status: 403 }
        );
      }
      if (session?.user?.name) {
        performedByName = session.user.name;
      }
    }

    const body = await req.json();
    const { lead_ids, campaign_id, apply_to_all_filtered, filter_params, task_config } = body;

    const result = LeadsService.bulkUpdateCampaign(
      lead_ids || [],
      campaign_id || null,
      Boolean(apply_to_all_filtered),
      filter_params,
      performedByName,
      task_config
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to bulk update campaign:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to bulk update campaign" },
      { status: 500 }
    );
  }
}
