import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { logServerError } from "@/lib/db/database";
import { BulkAssignRequest } from "@/types/crm";

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get("dreamdesk_session")?.value;
  const session = sessionId ? AuthService.getSession(sessionId) : null;
  const currentUser = session?.user || null;

  try {
    const body = (await request.json()) as BulkAssignRequest;

    if (!body.mode) {
      return NextResponse.json(
        { error: "Assignment mode ('auto', 'quota', or 'single') is required.", code: "INVALID_MODE" },
        { status: 400 }
      );
    }

    const result = LeadsService.bulkAssign(body, currentUser);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Bulk assign error:", error);
    logServerError({
      errorCode: error?.code || "BULK_ASSIGN_ERROR",
      message: error?.message || "Failed to process bulk assignment",
      details: error?.stack,
      endpoint: "/api/leads/bulk-assign",
      httpStatus: 500,
      userId: currentUser?.id,
      userName: currentUser?.name,
    });

    return NextResponse.json(
      {
        error: error?.message || "Failed to process bulk assignment",
        code: error?.code || "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
