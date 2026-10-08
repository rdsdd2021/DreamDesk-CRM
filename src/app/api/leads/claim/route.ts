import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(request);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const body = await request.json();
    let targetUserId = body.user_id || session.user.id;

    // Only Admin or Team Lead can claim leads on behalf of another user
    if (targetUserId !== session.user.id && !session.permissions.canAssignLeads) {
      return NextResponse.json(
        { error: "Access denied. You can only claim leads for yourself." },
        { status: 403 }
      );
    }

    const count = Math.min(100, Math.max(1, Number(body.count) || 25));
    const result = LeadsService.claimUnassignedLeads(targetUserId, count, session.user);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to claim leads:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to claim unassigned leads" },
      { status: 500 }
    );
  }
}

