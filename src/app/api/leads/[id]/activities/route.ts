import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
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
    const { id } = await context.params;
    const leadId = parseInt(id, 10);
    if (isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const body = await request.json();
    const { title, description, activity_type, performed_by_name, metadata } = body;

    if (!description && !title) {
      return NextResponse.json(
        { error: "Activity title or description is required" },
        { status: 400 }
      );
    }

    LeadsService.logLeadActivity({
      lead_id: leadId,
      activity_type: activity_type || "note",
      title: title || "Counselor Interaction Note",
      description: description || null,
      metadata: metadata || null,
      performed_by_name: performed_by_name || "Counselor",
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
