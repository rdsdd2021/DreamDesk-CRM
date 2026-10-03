import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    if (sessionId) {
      AuthService.deleteSession(sessionId);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    response.cookies.delete("dreamdesk_session");
    return response;
  } catch (error: any) {
    console.error("Logout failure:", error);
    const response = NextResponse.json({ success: true });
    response.cookies.delete("dreamdesk_session");
    return response;
  }
}
