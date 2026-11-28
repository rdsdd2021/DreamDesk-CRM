import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { AiLeadCopilotService } from "@/lib/services/aiLeadCopilotService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json();
    const leadId = Number(body?.lead_id);
    if (!leadId || !Number.isFinite(leadId)) {
      return NextResponse.json({ error: "lead_id is required" }, { status: 400 });
    }

    if (body?.mode === "parse_notes") {
      const roughNotes = String(body?.notes || "").trim();
      if (!roughNotes) {
        return NextResponse.json({ error: "Please enter rough call notes first." }, { status: 400 });
      }
      const result = await AiLeadCopilotService.parseRoughNotes({
        leadId,
        roughNotes,
        user: session.user,
      });
      return NextResponse.json({ success: true, result });
    }

    const result = await AiLeadCopilotService.generatePreCallBrief(leadId, session.user);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Lead AI Copilot failed" },
      { status: 400 }
    );
  }
}
