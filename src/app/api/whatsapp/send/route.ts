import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json();
    const res = await KapsoWhatsappService.sendMessage({
      leadId: body?.lead_id ? Number(body.lead_id) : undefined,
      conversationId: body?.conversation_id ? Number(body.conversation_id) : undefined,
      toPhone: body?.to_phone ? String(body.to_phone) : undefined,
      messageType: ["template", "image", "document", "video"].includes(body?.message_type)
        ? body.message_type
        : "text",
      body: String(body?.body || body?.message || ""),
      templateName: body?.template_name ? String(body.template_name) : undefined,
      languageCode: body?.language_code ? String(body.language_code) : "en",
      parameterFormat: body?.parameter_format === "POSITIONAL" ? "POSITIONAL" : body?.parameter_format === "NAMED" ? "NAMED" : undefined,
      templateVariables: Array.isArray(body?.template_variables) ? body.template_variables : undefined,
      headerMediaType: body?.header_media_type || undefined,
      mediaUrl: body?.media_url ? String(body.media_url) : undefined,
      mediaId: body?.media_id ? String(body.media_id) : undefined,
      user: session.user,
    });

    return NextResponse.json({ success: true, ...res });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to send WhatsApp message" },
      { status: 400 }
    );
  }
}
