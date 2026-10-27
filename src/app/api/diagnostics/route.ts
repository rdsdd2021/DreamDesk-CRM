import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/database";
import { AuthService } from "@/lib/services/authService";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user;

    // Only Admin or Team Lead can inspect diagnostics
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "team_lead")) {
      return NextResponse.json({ error: "Unauthorized access to diagnostics" }, { status: 403 });
    }

    const db = getDatabase();

    // 1. Database file stats
    const dataDir = process.env.DATABASE_DIR || path.join(process.cwd(), "data");
    const dbPath = process.env.DATABASE_PATH || path.join(dataDir, "crm.db");
    const walPath = `${dbPath}-wal`;

    let dbSizeBytes = 0;
    let walSizeBytes = 0;

    try {
      if (fs.existsSync(dbPath)) dbSizeBytes = fs.statSync(dbPath).size;
      if (fs.existsSync(walPath)) walSizeBytes = fs.statSync(walPath).size;
    } catch {}

    // 2. Pragmas and database health
    let journalMode = "unknown";
    let busyTimeout = 0;
    try {
      journalMode = (db.pragma("journal_mode", { simple: true }) as string) || "unknown";
      busyTimeout = Number(db.pragma("busy_timeout", { simple: true }) || 0);
    } catch {}

    // 3. Table counts
    const leadCount = (db.prepare("SELECT COUNT(*) as c FROM leads").get() as any)?.c || 0;
    const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any)?.c || 0;
    const activityCount = (db.prepare("SELECT COUNT(*) as c FROM lead_activities").get() as any)?.c || 0;
    const taskCount = (db.prepare("SELECT COUNT(*) as c FROM crm_tasks").get() as any)?.c || 0;

    // 4. Recent Server Errors (last 50)
    let recentErrors: any[] = [];
    try {
      recentErrors = db.prepare(`
        SELECT * FROM system_errors 
        ORDER BY created_at DESC 
        LIMIT 50
      `).all();
    } catch {}

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        engine: "SQLite WAL (better-sqlite3)",
        path: dbPath,
        dbSizeMb: (dbSizeBytes / (1024 * 1024)).toFixed(2),
        walSizeMb: (walSizeBytes / (1024 * 1024)).toFixed(2),
        journalMode,
        busyTimeoutMs: busyTimeout,
      },
      counts: {
        leads: leadCount,
        users: userCount,
        activities: activityCount,
        tasks: taskCount,
        recentErrorsCount: recentErrors.length,
      },
      recentErrors,
    });
  } catch (error: any) {
    console.error("Diagnostics error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to retrieve diagnostics" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user;

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Only super administrators can purge diagnostic logs" }, { status: 403 });
    }

    const db = getDatabase();
    db.exec("DELETE FROM system_errors;");

    return NextResponse.json({ success: true, message: "System error logs purged successfully." });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to purge error logs" }, { status: 500 });
  }
}
