import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, count = 25 } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Counselor user_id is required" }, { status: 400 });
    }

    const result = LeadsService.claimUnassignedLeads(user_id, Number(count) || 25);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to claim leads:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to claim unassigned leads" },
      { status: 500 }
    );
  }
}
