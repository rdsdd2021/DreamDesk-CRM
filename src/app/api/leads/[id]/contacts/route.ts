import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    if (!leadId || isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const sessionId = req.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user;
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contact = LeadsService.getRawLeadContact(leadId);
    if (!contact) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (
      !session.permissions.canViewAllLeads &&
      contact.assigned_to &&
      contact.assigned_to !== currentUser.id
    ) {
      return NextResponse.json(
        { error: "Access denied: Lead is assigned to another counselor" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { phone, label, makePrimary } = body;

    const result = LeadsService.addLeadContact(
      leadId,
      { phone, label, makePrimary },
      currentUser
    );

    return NextResponse.json({
      success: true,
      lead: result.lead,
      duplicateMatches: result.duplicateMatches,
    });
  } catch (error: any) {
    console.error("Failed to add lead contact:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save contact number" },
      { status: 400 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    if (!leadId || isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const sessionId = req.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user;
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contact = LeadsService.getRawLeadContact(leadId);
    if (!contact) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (
      !session.permissions.canViewAllLeads &&
      contact.assigned_to &&
      contact.assigned_to !== currentUser.id
    ) {
      return NextResponse.json(
        { error: "Access denied: Lead is assigned to another counselor" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { contactId, action } = body;
    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const updatedLead =
      action === "set_whatsapp"
        ? LeadsService.setWhatsAppContact(leadId, String(contactId), currentUser)
        : LeadsService.promoteAlternateContact(leadId, String(contactId), currentUser);

    return NextResponse.json({
      success: true,
      lead: updatedLead,
    });
  } catch (error: any) {
    console.error("Failed to switch primary contact:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to switch primary contact" },
      { status: 400 }
    );
  }
}
