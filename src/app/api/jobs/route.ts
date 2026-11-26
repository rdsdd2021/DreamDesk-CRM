import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(req);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const canViewAll = session.user.role === "admin" || session.user.role === "team_lead";
    const jobs = JobsService.listJobs(session.user.id, canViewAll);

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error("Failed to list background jobs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load background jobs" },
      { status: 500 }
    );
  }
}
