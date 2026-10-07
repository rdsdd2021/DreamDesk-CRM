import { NextRequest, NextResponse } from "next/server";
import { LeadsService } from "@/lib/services/leadsService";
import { AuthService } from "@/lib/services/authService";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { field, value, override_policy } = body;

    if (!field) {
      return NextResponse.json({ error: "Field name is required" }, { status: 400 });
    }

    const sessionId = req.cookies.get("dreamdesk_session")?.value;
    const session = sessionId ? AuthService.getSession(sessionId) : null;
    const currentUser = session?.user || null;

    const result = LeadsService.updateLeadField(Number(id), field, value, {
      currentUser,
      overridePolicy: override_policy,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Failed to update lead field:", error);
    const isPolicyError =
      error?.message?.includes("Policy Restriction") ||
      error?.message?.includes("Counselor Ownership Lock");
    return NextResponse.json(
      {
        error: error.message || "Failed to update field",
        policyViolation: isPolicyError,
      },
      { status: isPolicyError ? 403 : 500 }
    );
  }
}
