import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    if (!leadId || isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const { session, errorResponse } = AuthService.requireAuth(request);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const currentUser = session.user;
    const userScope = {
      userId: currentUser.id,
      role: currentUser.role,
      canViewAllLeads: session.permissions.canViewAllLeads,
      name: currentUser.name,
    };

    const lead = LeadsService.getLeadById(leadId, userScope);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead,
    });
  } catch (err: any) {
    console.error("GET /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to retrieve lead details" },
      { status: 500 }
    );
  }
}
