import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export async function GET(request: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(request);
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }
    const users = LeadsService.getUsers();
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch counselors" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = AuthService.requireAuth(request, "canManageTeam");
    if (errorResponse) {
      return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
    }

    const body = await request.json();
    const { name, email, role } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const newUser = LeadsService.createUser({ name, email, role });
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create counselor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const session = AuthService.getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    if (!session.permissions.canManageTeam) {
      return NextResponse.json({ error: "Access denied. You do not have permission to manage team accounts." }, { status: 403 });
    }

    const body = await request.json();
    const { userId, status } = body;

    if (!userId || !["active", "inactive"].includes(status)) {
      return NextResponse.json({ error: "userId and status ('active' | 'inactive') are required." }, { status: 400 });
    }

    // Safety checks
    if (userId === session.user.id && status === "inactive") {
      return NextResponse.json({ error: "Security restriction: You cannot deactivate your own administrative account." }, { status: 400 });
    }

    if (userId === "usr_admin" && status === "inactive") {
      return NextResponse.json({ error: "Security restriction: The primary Super Admin account cannot be deactivated." }, { status: 400 });
    }

    if (status === "inactive") {
      const result = AuthService.deactivateUser(userId, session.user.name);
      return NextResponse.json({
        success: true,
        status: "inactive",
        terminatedSessions: result.terminatedSessions,
        message: `Account deactivated successfully. Instantly terminated ${result.terminatedSessions} active session(s).`,
      });
    } else {
      AuthService.reactivateUser(userId, session.user.name);
      return NextResponse.json({
        success: true,
        status: "active",
        message: "Account reactivated successfully. User may now log in.",
      });
    }
  } catch (error: any) {
    console.error("User status update error:", error);
    return NextResponse.json({ error: error?.message || "Failed to update user status" }, { status: 500 });
  }
}

