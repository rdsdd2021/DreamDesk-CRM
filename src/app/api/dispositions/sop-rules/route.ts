import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { DispositionSopService } from "@/lib/services/dispositionSopService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const rules = DispositionSopService.listRules();
    return NextResponse.json({ rules });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to load disposition SOP rules" },
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
    return NextResponse.json({ error: "Only Admin or Team Lead can manage SOP rules" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const title = String(body?.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Rule task title is required" }, { status: 400 });
    }
    if (!body?.disposition_id && !body?.sub_disposition_id) {
      return NextResponse.json(
        { error: "Select a Disposition or Sub-Disposition trigger" },
        { status: 400 }
      );
    }

    const rule = DispositionSopService.createRule({
      disposition_id: body?.disposition_id || null,
      sub_disposition_id: body?.sub_disposition_id || null,
      target_role: body?.target_role || "lead_owner",
      specific_user_id: body?.specific_user_id || null,
      task_mode: body?.task_mode || "call_task",
      template_id: body?.template_id ? Number(body.template_id) : null,
      title,
      description: body?.description,
      priority: body?.priority || "high",
      sla_hours: Number(body?.sla_hours || 4),
      requires_proof: Boolean(body?.requires_proof),
      requires_approval: Boolean(body?.requires_approval),
      created_by: session.user.id,
    });

    return NextResponse.json({ success: true, rule }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create disposition SOP rule" },
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
      return NextResponse.json({ error: "Invalid rule ID" }, { status: 400 });
    }
    DispositionSopService.deleteRule(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to delete disposition SOP rule" },
      { status: 500 }
    );
  }
}
