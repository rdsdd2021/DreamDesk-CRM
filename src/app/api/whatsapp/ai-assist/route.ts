import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { AiCopilotService } from "@/lib/services/aiCopilotService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json();
    const assist = await AiCopilotService.generateWhatsAppAssist({
      conversationId: body?.conversation_id ? Number(body.conversation_id) : undefined,
      leadId: body?.lead_id ? Number(body.lead_id) : undefined,
      is24hOpen: Boolean(body?.is_24h_open),
      user: session.user,
    });
    return NextResponse.json({ success: true, assist });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "AI Copilot failed to generate suggestions" },
      { status: 400 }
    );
  }
}
