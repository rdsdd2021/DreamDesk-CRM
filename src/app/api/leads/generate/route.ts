import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.min(100000, Math.max(10, body.count || 2500));

    const generated = LeadsService.generateSampleLeads(count);

    return NextResponse.json({
      success: true,
      count: generated,
      message: `Generated and indexed ${generated} realistic student leads in database.`,
    });
  } catch (error: any) {
    console.error("Generator error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate leads" }, { status: 500 });
  }
}
