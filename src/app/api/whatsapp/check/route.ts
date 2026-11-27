import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { WhatsappCheckerService } from "@/lib/services/whatsappCheckerService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json();
    const phone = String(body?.phone || "").trim();
    if (!phone) {
      return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
    }
    const result = await WhatsappCheckerService.checkNumber(phone);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to check number" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json();
    const phone = String(body?.phone || "").trim();
    const status = body?.status;
    if (!phone || !["unknown", "valid", "invalid"].includes(status)) {
      return NextResponse.json({ error: "Valid phone and status (unknown|valid|invalid) required" }, { status: 400 });
    }
    WhatsappCheckerService.markStatus(phone, status, status === "invalid" ? "MANUAL" : null, "manual");
    return NextResponse.json({ success: true, ...WhatsappCheckerService.getStatus(phone) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update status" }, { status: 400 });
  }
}
