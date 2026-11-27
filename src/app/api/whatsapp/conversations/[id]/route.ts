import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  const { id } = await params;
  const convId = Number(id);
  if (!convId || Number.isNaN(convId)) {
    return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
  }

  const detail = KapsoWhatsappService.getConversationMessages(convId, {
    userId: session.user.id,
    role: session.user.role,
    canViewAllLeads: session.permissions.canViewAllLeads,
  });

  if (!detail) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  const { id } = await params;
  const convId = Number(id);
  if (!convId || Number.isNaN(convId)) {
    return NextResponse.json({ error: "Invalid conversation ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (body?.action === "create_lead") {
    try {
      const created = KapsoWhatsappService.createLeadFromConversation(convId, session.user);
      return NextResponse.json({ success: true, ...created });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Failed to create lead" }, { status: 400 });
    }
  }

  KapsoWhatsappService.updateConversation(convId, {
    status: body?.status,
    assigned_to: body?.assigned_to,
    unread_count: body?.unread_count,
  });

  return NextResponse.json({ success: true });
}
