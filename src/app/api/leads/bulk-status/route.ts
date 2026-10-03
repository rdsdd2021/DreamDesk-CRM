import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_ids, status, apply_to_all_filtered, filter_params } = body;

    if (!status) {
      return NextResponse.json({ error: "New status is required" }, { status: 400 });
    }

    const affected = LeadsService.bulkUpdateStatus(
      lead_ids || [],
      status,
      apply_to_all_filtered,
      filter_params
    );

    return NextResponse.json({
      success: true,
      affectedCount: affected,
      message: `Updated status to "${status}" for ${affected} leads`,
    });
  } catch (error: any) {
    console.error("Bulk status error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update status" }, { status: 500 });
  }
}
