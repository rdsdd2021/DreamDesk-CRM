import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }
  if (!["admin", "team_lead"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ settings: KapsoWhatsappService.getPublicConfig() });
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Only Admins can update Kapso settings." }, { status: 403 });
  }

  try {
    const body = await request.json();
    if (body?.action === "register_webhook") {
      const res = await KapsoWhatsappService.registerWebhookWithKapso(String(body.webhook_url || ""));
      return NextResponse.json(res);
    }
    const settings = KapsoWhatsappService.saveConfig(body || {});
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save settings" }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Only Admins can test Kapso connection." }, { status: 403 });
  }

  const result = await KapsoWhatsappService.testConnection();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
