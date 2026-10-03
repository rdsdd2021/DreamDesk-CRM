import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;

    if (!sessionId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = AuthService.getSession(sessionId);

    if (!session) {
      const res = NextResponse.json({ authenticated: false }, { status: 401 });
      res.cookies.delete("dreamdesk_session");
      return res;
    }

    const allUsers = AuthService.getAllActiveUsers();

    return NextResponse.json({
      authenticated: true,
      user: session.user,
      permissions: session.permissions,
      expiresAt: session.expiresAt,
      allUsers,
    });
  } catch (error: any) {
    console.error("Auth check failure:", error);
    return NextResponse.json({ authenticated: false, error: error?.message }, { status: 500 });
  }
}
