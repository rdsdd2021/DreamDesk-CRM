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
    const { name, email, role, password, team_lead_id } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    if (password && password.trim().length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const newUser = LeadsService.createUser({ name, email, role, password, team_lead_id: team_lead_id || null });
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
    const {
      userId,
      status,
      newPassword,
      action,
      team_lead_id,
      name,
      email,
      role,
      max_leads_cap,
      permissions_override,
      leadAction,
      reassignToUserId,
    } = body;

    if (action === "assign_team_lead") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }
      LeadsService.updateUserTeamLead(userId, team_lead_id || null, session.user.name);
      return NextResponse.json({ success: true, message: "Team Lead assignment updated." });
    }

    if (action === "edit_user") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }
      LeadsService.updateUserProfile(
        userId,
        { name, email, role, team_lead_id, max_leads_cap, permissions_override },
        session.user.name
      );
      return NextResponse.json({ success: true, message: "User details & permissions updated." });
    }

    if (action === "force_logout") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }
      const res = AuthService.forceLogoutUser(userId, session.user.name);
      return NextResponse.json({
        success: true,
        terminatedSessions: res.terminatedSessions,
        message: `Terminated ${res.terminatedSessions} active session(s).`,
      });
    }

    if (action === "delete_user") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
      }
      if (userId === session.user.id || userId === "usr_admin") {
        return NextResponse.json(
          { error: "Security restriction: Cannot delete your own or primary Super Admin account." },
          { status: 400 }
        );
      }
      const res = AuthService.deleteUser(
        userId,
        leadAction === "reassign" ? "reassign" : "unassign",
        reassignToUserId || null,
        session.user.name
      );
      return NextResponse.json({
        success: true,
        movedLeads: res.movedLeads,
        message: `User permanently deleted (${res.movedLeads} leads handed off).`,
      });
    }

    // Handle Password Reset Request
    if (action === "reset_password" || newPassword) {
      if (!userId || !newPassword) {
        return NextResponse.json(
          { error: "Both userId and newPassword are required to reset a password." },
          { status: 400 }
        );
      }
      if (newPassword.trim().length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters long." },
          { status: 400 }
        );
      }

      const result = AuthService.resetPassword(userId, newPassword.trim(), session.user.name);
      return NextResponse.json({
        success: true,
        message: `Password reset successfully. Terminated ${result.terminatedSessions} active session(s).`,
        terminatedSessions: result.terminatedSessions,
      });
    }

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
      const result = AuthService.deactivateUser(
        userId,
        session.user.name,
        leadAction || "leave",
        reassignToUserId || null
      );
      return NextResponse.json({
        success: true,
        status: "inactive",
        terminatedSessions: result.terminatedSessions,
        movedLeads: result.movedLeads,
        message: `Account deactivated (${result.terminatedSessions} session(s) ended${
          result.movedLeads > 0 ? `, ${result.movedLeads} leads moved` : ""
        }).`,
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

