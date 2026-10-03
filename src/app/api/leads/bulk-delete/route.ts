import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function POST(request: NextRequest) {
  try {
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
