import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rules = LeadsService.getAssignmentRules();
    return NextResponse.json(rules);
  } catch (error: any) {
    console.error("Failed to get assignment rules:", error);
    return NextResponse.json({ error: error.message || "Failed to get rules" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionId = req.cookies.get("dreamdesk_session")?.value;
    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session && !session.permissions.canAssignLeads) {
        return NextResponse.json(
          { error: "Access denied. Insufficient permissions to distribute leads." },
          { status: 403 }
        );
      }
    }

    let count = 250;
    try {
      const body = await req.json();
      if (body.count) count = Number(body.count);
    } catch {
      // ignore
    }

    const result = LeadsService.autoDistributeLeads(count);
    return NextResponse.json({
      success: true,
      message: `Successfully distributed ${result.totalAssigned} leads (${result.ruleAssigned} via rules, ${result.roundRobinAssigned} via round-robin)`,
      ...result,
    });
  } catch (error: any) {
    console.error("Failed to auto-distribute leads:", error);
    return NextResponse.json({ error: error.message || "Failed to auto-distribute leads" }, { status: 500 });
  }
}
