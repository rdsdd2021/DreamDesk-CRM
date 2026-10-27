import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    if (!leadId || isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user;

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Strict role check: Only admin and team_lead can unmask
    if (currentUser.role !== "admin" && currentUser.role !== "team_lead") {
      return NextResponse.json(
        { error: "Security Restriction: Only Admins and Team Leads have permission to unmask contact details." },
        { status: 403 }
      );
    }

    const contact = LeadsService.getRawLeadContact(leadId);
    if (!contact) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Record audit event for compliance tracking
    LeadsService.logLeadActivity({
      lead_id: leadId,
      activity_type: "security_audit",
      title: "Phone Number Unmasked",
      description: `Student phone number unmasked for compliance review by ${currentUser.name} (${currentUser.role})`,
      new_value: "Revealed on screen",
      performed_by_name: currentUser.name,
    });

    return NextResponse.json({
      success: true,
      phone: contact.phone || "Not Provided",
    });
  } catch (error: any) {
    console.error("Failed to unmask phone:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to unmask contact" },
      { status: 500 }
    );
  }
}
