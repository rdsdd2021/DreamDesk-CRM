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

    if (!contact.phone || !contact.phone.trim()) {
      return NextResponse.json(
        { error: "No phone number available for this student lead" },
        { status: 400 }
      );
    }

    // Role-based permission check: Counselors can only call leads assigned to them unless permitted
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

    const rawDigits = cleanPhoneDigits(contact.phone);
    const maskedPhone = maskPhoneNumber(contact.phone);

    // Format dial URI: If starts with + (e.g. +91), keep the +
    let dialNumber = rawDigits;
    if (contact.phone.trim().startsWith("+")) {
      dialNumber = `+${rawDigits}`;
    } else if (rawDigits.length === 10) {
      // Default to +91 if 10-digit Indian mobile
      dialNumber = `+91${rawDigits}`;
    }

    // Automatically record an outbound call attempt in the compliance audit trail
    LeadsService.logLeadActivity({
      lead_id: leadId,
      activity_type: "call_attempt",
      title: "Outbound Call Initiated",
      description: `Dialer intent activated by ${currentUser.name} (${currentUser.role})`,
      new_value: maskedPhone,
      performed_by_name: currentUser.name || "Counselor",
    });

    return NextResponse.json({
      success: true,
      dialUri: `tel:${dialNumber}`,
      maskedPhone,
    });
  } catch (error: any) {
    console.error("Failed to generate call intent:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to trigger call dialer" },
      { status: 500 }
    );
  }
}
