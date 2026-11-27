import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { PushNotificationService } from "@/lib/services/pushNotificationService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json();
    const token = String(body?.token || "").trim();
    const platform = String(body?.platform || "android").trim();
    const deviceName = body?.device_name ? String(body.device_name).trim() : null;

    if (!token) {
      return NextResponse.json({ error: "Push token is required" }, { status: 400 });
    }

    PushNotificationService.registerToken(session.user.id, token, platform, deviceName);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to register push token" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const token = body?.token ? String(body.token).trim() : undefined;
    PushNotificationService.unregisterToken(session.user.id, token);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to unregister push token" },
      { status: 500 }
    );
  }
}
