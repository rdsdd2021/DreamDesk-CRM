import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";
import { JobsService } from "@/lib/services/jobsService";

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
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    if (session && !session.permissions.canAssignLeads) {
      return NextResponse.json(
        { error: "Access denied. Insufficient permissions to distribute leads." },
        { status: 403 }
      );
    }

    let count = 250;
    try {
      const body = await req.json();
      if (body.count) count = Number(body.count);
    } catch {
      // ignore
    }

    const job = JobsService.enqueueJob({
      jobType: "auto_distribute",
      title: `Auto-Distribute up to ${count.toLocaleString()} Leads`,
      totalItems: count,
      createdBy: session?.user || null,
      run: async ({ updateProgress }) => {
        const result = LeadsService.autoDistributeLeads(count);
        updateProgress(result.totalAssigned, result.totalAssigned, 0, result.totalAssigned);
        return result;
      },
    });

    return NextResponse.json(
      {
        success: true,
        async: true,
        job,
        message: `Queued auto-distribution of up to ${count} leads in background.`,
      },
      { status: 202 }
    );
  } catch (error: any) {
    console.error("Failed to queue auto-distribute leads:", error);
    return NextResponse.json({ error: error.message || "Failed to queue auto-distribution" }, { status: 500 });
  }
}
