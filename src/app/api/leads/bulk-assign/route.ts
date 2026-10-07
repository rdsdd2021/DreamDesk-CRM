import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { BulkAssignRequest } from "@/types/crm";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BulkAssignRequest;

    if (!body.mode) {
      return NextResponse.json(
        { error: "Assignment mode ('auto', 'quota', or 'single') is required." },
        { status: 400 }
      );
    }

    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user || null;

    const result = LeadsService.bulkAssign(body, currentUser);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Bulk assign error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process bulk assignment" },
      { status: 500 }
    );
  }
}
