import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { AiCopilotService } from "@/lib/services/aiCopilotService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }
  if (!["admin", "team_lead"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ settings: AiCopilotService.getPublicSettings() });
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Only Admins can update AI Copilot settings." }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (body?.action === "test") {
      const result = await AiCopilotService.testConnection(body?.gemini_api_key, body?.model);
      return NextResponse.json(result);
    }
    const settings = AiCopilotService.saveSettings(body || {});
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save AI settings" }, { status: 400 });
  }
}
