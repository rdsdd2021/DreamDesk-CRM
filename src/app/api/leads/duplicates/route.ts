import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(req, "canAssignLeads");
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }
    const data = LeadsService.getDuplicateClusters();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to get duplicates:", error);
    return NextResponse.json({ error: error.message || "Failed to scan duplicates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(req, "canAssignLeads");
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const body = await req.json();
    const { primary_lead_id, duplicate_lead_ids } = body;
    if (!primary_lead_id || !Array.isArray(duplicate_lead_ids) || duplicate_lead_ids.length === 0) {
      return NextResponse.json(
        { error: "primary_lead_id and duplicate_lead_ids array are required" },
        { status: 400 }
      );
    }
    const result = LeadsService.mergeLeads(Number(primary_lead_id), duplicate_lead_ids.map(Number));
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to merge leads:", error);
    return NextResponse.json({ error: error.message || "Failed to merge leads" }, { status: 500 });
  }
}
