import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  const sp = request.nextUrl.searchParams;
  const filter = (sp.get("filter") || "all") as "all" | "unread" | "open" | "resolved";
  const search = sp.get("search") || undefined;
  const leadIdParam = sp.get("lead_id");

  const userScope = {
    userId: session.user.id,
    role: session.user.role,
    canViewAllLeads: session.permissions.canViewAllLeads,
  };

  if (leadIdParam) {
    const leadId = Number(leadIdParam);
    if (leadId > 0) {
      try {
        const conv = KapsoWhatsappService.getOrCreateConversationForLead(leadId);
        const detail = KapsoWhatsappService.getConversationMessages(conv.id, userScope);
        return NextResponse.json({
          conversation: detail?.conversation || conv,
          messages: detail?.messages || [],
        });
      } catch (err: any) {
        return NextResponse.json({ error: err?.message || "Failed to load conversation" }, { status: 400 });
      }
    }
  }

  const conversations = KapsoWhatsappService.listConversations(userScope, { filter, search });
  return NextResponse.json({ conversations });
}
