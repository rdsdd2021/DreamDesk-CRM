import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    let currentUser = null;
    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session) currentUser = session.user;
    }

    let counselorId = request.nextUrl.searchParams.get("counselor_id") || undefined;
    if (currentUser && (currentUser.role === "counselor" || currentUser.role === "senior_counselor" || currentUser.role === "telecaller")) {
      counselorId = currentUser.id;
    }

    const tasks = LeadsService.getScheduledCallbacks(counselorId);
    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error("Failed to fetch scheduled tasks:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch scheduled tasks" },
      { status: 500 }
    );
  }
}
