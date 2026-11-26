import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { maskPhoneNumber, cleanPhoneDigits } from "@/lib/utils/phoneMasker";

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

    const contact = LeadsService.getRawLeadContact(leadId);
    if (!contact) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Role-based permission check: Counselors can only message leads assigned to them unless permitted
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

    let templateText = "";
    let contactId = "";
    try {
      const body = await request.json();
      templateText = body.templateText || body.text || "";
      contactId = body.contactId ? String(body.contactId) : "";
    } catch {
      // empty body
    }

    const altContact = contactId
      ? contact.alternate_contacts.find((c) => c.id === contactId)
      : null;

    const targetPhone = altContact ? altContact.phone : contact.phone;
    const targetLabel = altContact ? altContact.label : (contact.phone_label || "Primary");

    if (!targetPhone || !targetPhone.trim()) {
      return NextResponse.json(
        { error: "No phone number available for this student lead" },
        { status: 400 }
      );
    }

    let cleanDigits = cleanPhoneDigits(targetPhone);
    if (cleanDigits.length === 10) {
      cleanDigits = `91${cleanDigits}`;
    }

    const maskedPhone = maskPhoneNumber(targetPhone);
    const queryParam = templateText ? `?text=${encodeURIComponent(templateText)}` : "";
    const launchUrl = `https://wa.me/${cleanDigits}${queryParam}`;

    // Log WhatsApp outreach activity in compliance audit trail
    LeadsService.logLeadActivity({
      lead_id: leadId,
      activity_type: "whatsapp",
      title: `WhatsApp Outreach Initiated (${targetLabel})`,
      description: templateText
        ? `Outreach via WhatsApp (${targetLabel}): "${templateText.slice(0, 100)}${templateText.length > 100 ? "..." : ""}"`
        : `Direct WhatsApp message started on ${targetLabel} number by ${currentUser.name}`,
      new_value: maskedPhone,
      performed_by_name: currentUser.name || "Counselor",
    });

    return NextResponse.json({
      success: true,
      launchUrl,
      maskedPhone,
    });
  } catch (error: any) {
    console.error("Failed to generate WhatsApp intent:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to trigger WhatsApp launch" },
      { status: 500 }
    );
  }
}
