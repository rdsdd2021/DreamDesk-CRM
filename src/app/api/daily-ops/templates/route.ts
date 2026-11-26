import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { DailyOpsService } from "@/lib/services/dailyOpsService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const templates = DailyOpsService.listTemplates();
    return NextResponse.json({ templates });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load SOP templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (session.user.role !== "admin" && session.user.role !== "team_lead") {
    return NextResponse.json({ error: "Only Admin or Team Lead can create SOP templates" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title = String(body?.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Template title is required" }, { status: 400 });
    }

    const template = DailyOpsService.createTemplate({
      title,
      description: body?.description,
      task_type: body?.task_type || "one_time",
      recurrence_rule: body?.recurrence_rule || null,
      time_limit_minutes: body?.time_limit_minutes ? Number(body.time_limit_minutes) : null,
      priority: body?.priority || "normal",
      requires_proof: Boolean(body?.requires_proof),
      requires_approval: Boolean(body?.requires_approval),
      playbook_slot: body?.playbook_slot || "custom",
      checklist: Array.isArray(body?.checklist) ? body.checklist : [],
      created_by: session.user.id,
    });
    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create SOP template" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  if (session.user.role !== "admin" && session.user.role !== "team_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!id || isNaN(id)) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }
    DailyOpsService.deleteTemplate(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete SOP template" },
      { status: 500 }
    );
  }
}
