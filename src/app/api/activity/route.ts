import { NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";

export async function GET() {
  try {
    const logs = LeadsService.getActivityLogs();
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch activity logs" }, { status: 500 });
  }
}
