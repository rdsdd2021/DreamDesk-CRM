import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/lib/services/authService";
import { AiCommandService } from "@/lib/services/aiCommandService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const brief = await AiCommandService.getShiftBrief(session.user);
    return NextResponse.json({ success: true, result: brief });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI shift brief" },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { session, errorResponse } = AuthService.requireAuth(request);
  if (errorResponse) {
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.status });
  }

  try {
    const body = await request.json();
    if (body?.mode === "execute_workflow") {
      if (!Array.isArray(body?.steps) || body.steps.length === 0) {
        return NextResponse.json({ error: "Workflow steps are required" }, { status: 400 });
      }
      const res = await AiCommandService.executeWorkflow({
        steps: body.steps,
        user: session.user,
      });
      return NextResponse.json(res);
    }

    if (body?.mode === "execute") {
      if (!body?.action) {
        return NextResponse.json({ error: "Action payload is required" }, { status: 400 });
      }
      const res = await AiCommandService.executeAction({
        action: body.action,
        user: session.user,
      });
      return NextResponse.json(res);
    }

    const prompt = String(body?.prompt || "").trim();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const result = await AiCommandService.planCommand({
      prompt,
      currentView: body?.current_view ? String(body.current_view) : undefined,
      user: session.user,
    });
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    const status = /Forbidden/i.test(err?.message || "") ? 403 : 400;
    return NextResponse.json(
      { error: err?.message || "AI Copilot command failed" },
      { status }
    );
  }
}
