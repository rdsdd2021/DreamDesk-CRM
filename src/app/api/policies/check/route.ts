import { NextRequest, NextResponse } from "next/server";
import { PolicyService } from "@/lib/services/policyService";

export const dynamic = "force-dynamic";

/**
 * GET /api/policies/check?lead_id=123
 * Evaluates whether a lead has an active counselor ownership lock.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const leadIdParam = searchParams.get("lead_id");

    if (!leadIdParam) {
      return NextResponse.json({ error: "Missing required parameter 'lead_id'" }, { status: 400 });
    }

    const leadId = Number(leadIdParam);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead_id parameter" }, { status: 400 });
    }

    const lockInfo = PolicyService.checkLeadLock(leadId);

    return NextResponse.json({
      success: true,
      lock: lockInfo,
    });
  } catch (error: any) {
    console.error("Failed to check lead lock status:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to check lead lock status" },
      { status: 500 }
    );
  }
}
