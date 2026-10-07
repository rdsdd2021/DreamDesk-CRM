import { NextRequest, NextResponse } from "next/server";
import { TasksService } from "@/lib/services/tasksService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    let userId = request.nextUrl.searchParams.get("user_id") || undefined;

    if (!userId && sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session?.user?.id) userId = session.user.id;
    }

    if (!userId) {
      // Default to first user or return empty
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "30", 10);
    const data = TasksService.getNotifications(userId, limit);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    let userId: string | undefined;

    if (sessionId) {
      const session = AuthService.getSession(sessionId);
      if (session?.user?.id) userId = session.user.id;
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = body.user_id || userId;

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    if (body.mark_all) {
      TasksService.markAllNotificationsRead(targetUserId);
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (body.id) {
      TasksService.markNotificationRead(Number(body.id), targetUserId);
      return NextResponse.json({ success: true, message: "Notification marked as read" });
    }

    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to update notifications:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update notifications" },
      { status: 500 }
    );
  }
}
