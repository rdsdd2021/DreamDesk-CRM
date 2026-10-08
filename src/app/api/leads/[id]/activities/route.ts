import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function GET(
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
        { error: "Access denied. You can only view activities for your assigned leads." },
        { status: 403 }
      );
    }

    const activities = LeadsService.getLeadActivities(leadId);
    return NextResponse.json(activities);
  } catch (error: any) {
    console.error("Failed to get lead activities:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch lead activities" },
      { status: 500 }
    );
  }
}

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
        { error: "Access denied. You can only log activities for your assigned leads." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, description, activity_type, metadata } = body;

    if (!description && !title) {
      return NextResponse.json(
        { error: "Activity title or description is required" },
        { status: 400 }
      );
    }

    // Always use authenticated user's trusted profile for tamper-proof auditing
    LeadsService.logLeadActivity({
      lead_id: leadId,
      activity_type: activity_type || "note",
      title: title || "Counselor Interaction Note",
      description: description || null,
      metadata: metadata || null,
      performed_by_id: session.user.id,
      performed_by_name: session.user.name,
      performed_by_role: session.user.role,
    });

    const updatedActivities = LeadsService.getLeadActivities(leadId);
    return NextResponse.json({
      success: true,
      message: "Lead activity logged successfully",
      activities: updatedActivities,
    });
  } catch (error: any) {
    console.error("Failed to log lead activity:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to log lead activity" },
      { status: 500 }
    );
  }
}

