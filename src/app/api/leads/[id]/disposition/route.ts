import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

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
    const { disposition_id, sub_disposition_id, notes, callback_at, status } = body;

    const updatedLead = LeadsService.updateLeadDisposition(
      leadId,
      disposition_id !== undefined ? disposition_id : null,
      notes,
      callback_at,
      status,
      sub_disposition_id !== undefined ? sub_disposition_id : null
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
