import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }
  if (!["admin", "team_lead"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await KapsoWhatsappService.syncTemplatesFromKapso();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to sync Kapso templates" },
      { status: 400 }
    );
  }
}
