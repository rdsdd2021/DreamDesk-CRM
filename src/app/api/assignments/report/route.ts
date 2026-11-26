import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(req);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    if (session.user.role !== "admin" && session.user.role !== "team_lead") {
      return NextResponse.json(
        { error: "Access denied. Team Lead or Admin role required." },
        { status: 403 }
      );
    }

    const batches = LeadsService.getAssignmentReports();
    return NextResponse.json({ batches });
  } catch (error: any) {
    console.error("Failed to fetch assignment reports:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch assignment reports" },
      { status: 500 }
    );
  }
}
