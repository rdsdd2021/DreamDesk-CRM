import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { KapsoWhatsappService } from "@/lib/services/kapsoWhatsappService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const result = await KapsoWhatsappService.syncHistoryFromKapso();
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to sync Kapso chat history" },
      { status: 400 }
    );
  }
}
