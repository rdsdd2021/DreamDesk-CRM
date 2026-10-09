import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(request);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const { id } = await context.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const lead = LeadsService.getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Strict counselor IDOR check
    if (!session.permissions.canViewAllLeads && lead.assigned_to !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied. You can only log dispositions for your assigned leads." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { disposition_id, sub_disposition_id, notes, callback_at, status, call_outcome } = body;

    const updatedLead = LeadsService.updateLeadDisposition(
      leadId,
      disposition_id !== undefined ? disposition_id : null,
      notes,
      callback_at,
      status,
      sub_disposition_id !== undefined ? sub_disposition_id : null,
      session.user,
      call_outcome !== undefined ? call_outcome : null
    );

    return NextResponse.json(updatedLead);
  } catch (error: any) {
    console.error("Failed to update lead disposition:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update lead disposition" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return POST(request, context);
}

