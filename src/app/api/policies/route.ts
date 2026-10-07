import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { PolicyService } from "@/lib/services/policyService";

export const dynamic = "force-dynamic";

/**
 * GET /api/policies
 * Returns all active CRM governance policies and operational statistics.
 */
export async function GET(req: NextRequest) {
  try {
    const policies = PolicyService.getPolicies();
    const stats = PolicyService.getPolicyStats();

    return NextResponse.json({
      success: true,
      policies,
      stats,
    });
  } catch (error: any) {
    console.error("Failed to fetch policies:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch policies" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/policies
 * Updates a policy configuration (Admin or Team Leader only).
 */
export async function PATCH(req: NextRequest) {
  try {
    const sessionId = req.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;

    if (!session || !session.permissions?.canManagePolicies) {
      return NextResponse.json(
        { error: "Unauthorized. Policy modifications require Admin or Team Leader privileges." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, is_enabled, config } = body;

    if (!id) {
      return NextResponse.json({ error: "Policy ID is required" }, { status: 400 });
    }

    const updated = PolicyService.updatePolicy(
      id,
      { is_enabled, config },
      session.user.name || "Admin"
    );

    const stats = PolicyService.getPolicyStats();

    return NextResponse.json({
      success: true,
      policy: updated,
      stats,
    });
  } catch (error: any) {
    console.error("Failed to update policy:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update policy" },
      { status: 500 }
    );
  }
}
