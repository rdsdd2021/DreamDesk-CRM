import { NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = LeadsService.getPerformanceMetrics();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to get performance metrics:", error);
    return NextResponse.json({ error: error.message || "Failed to load performance metrics" }, { status: 500 });
  }
}
