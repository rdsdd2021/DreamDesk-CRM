import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = Number(id);
    if (!leadId || isNaN(leadId)) {
      return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const { session, errorResponse } = AuthService.requireAuth(request);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.message && String(body.message).trim()) {
      const res = await KapsoWhatsappService.sendMessage({
        leadId,
        body: String(body.message).trim(),
        templateName: body?.templateName ? String(body.templateName) : undefined,
        user: session.user,
      });
      return NextResponse.json({
        success: true,
        mode: "integrated",
        conversationId: res.conversation.id,
        message: res.message,
      });
    }

    const conv = KapsoWhatsappService.getOrCreateConversationForLead(leadId);
    return NextResponse.json({
      success: true,
      mode: "integrated",
      leadId,
      conversationId: conv.id,
    });
  } catch (err: any) {
    console.error("POST /api/leads/[id]/whatsapp-intent error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to open integrated WhatsApp" },
      { status: 400 }
    );
  }
}
