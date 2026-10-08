import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(request, "canDeleteLeads");
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const body = await request.json();
    const { lead_ids, apply_to_all_filtered, filter_params } = body;

    const affected = LeadsService.bulkDelete(
      lead_ids || [],
      apply_to_all_filtered,
      filter_params
    );

    return NextResponse.json({
      success: true,
      affectedCount: affected,
      message: `Deleted ${affected} leads`,
    });
  } catch (error: any) {
    console.error("Bulk delete error:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete leads" }, { status: 500 });
  }
}
