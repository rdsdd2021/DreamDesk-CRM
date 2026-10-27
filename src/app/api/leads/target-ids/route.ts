import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { FilterParams } from "@/types/crm";

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user || null;

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const filterParams: FilterParams = body.filter_params || {};
    const limit: number | undefined = body.limit ? Number(body.limit) : undefined;

    const leadIds = LeadsService.getTargetLeadIds(filterParams, limit);
    return NextResponse.json({ leadIds, total: leadIds.length });
  } catch (error: any) {
    console.error("Failed to fetch target lead IDs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retrieve target lead IDs" },
      { status: 500 }
    );
  }
}
