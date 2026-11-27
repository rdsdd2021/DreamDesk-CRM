import { NextRequest, NextResponse } from "next/server";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: true, service: "DreamDesk Kapso WhatsApp Webhook" });
}

export async function POST(request: NextRequest) {
  try {
    const cfg = KapsoWhatsappService.getRawConfig();
    if (cfg.webhook_secret) {
      const providedSecret =
        request.headers.get("x-webhook-secret") ||
        request.headers.get("x-kapso-secret") ||
        request.nextUrl.searchParams.get("secret") ||
        "";
      if (providedSecret && providedSecret !== cfg.webhook_secret) {
        return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
      }
    }

    const payload = await request.json();
    const eventHeader = request.headers.get("x-webhook-event");
    const result = KapsoWhatsappService.processWebhook(payload, eventHeader);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("Kapso webhook error:", err);
    return NextResponse.json({ error: err?.message || "Webhook processing failed" }, { status: 500 });
  }
}
